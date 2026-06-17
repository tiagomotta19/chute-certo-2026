import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { match_id } = await req.json();
    if (!match_id || typeof match_id !== "string") {
      return new Response(JSON.stringify({ error: "match_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth: admin user OR service role (internal call from sync-results)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const isServiceRole = token === serviceKey;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceKey
    );

    if (!isServiceRole) {
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
      if (claimsErr || !claims?.claims) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const userId = claims.claims.sub;
      const { data: roles } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      if (!roles) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Load match
    const { data: match, error: mErr } = await admin
      .from("matches")
      .select("id, home_team, away_team, home_score, away_score, round_name")
      .eq("id", match_id)
      .maybeSingle();
    if (mErr || !match || match.home_score === null || match.away_score === null) {
      return new Response(JSON.stringify({ error: "Match not ready" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Distinct bolões of Copa that have predictions for this match
    const { data: preds } = await admin
      .from("predictions")
      .select("bolao_id")
      .eq("match_id", match_id);
    const bolaoIds = [...new Set((preds || []).map((p: any) => p.bolao_id))];
    if (bolaoIds.length === 0) {
      return new Response(JSON.stringify({ inserted: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: boloes } = await admin
      .from("boloes")
      .select("id, competition")
      .in("id", bolaoIds)
      .eq("competition", "copa_do_mundo_2026");
    const copaBolaoIds = (boloes || []).map((b: any) => b.id);

    const eventsToInsert: any[] = [];

    for (const bolaoId of copaBolaoIds) {
      // Predictions of this match for this bolão
      const { data: matchPreds } = await admin
        .from("predictions")
        .select("user_id, home_score, away_score, points, scorer_points, bonus_points")
        .eq("bolao_id", bolaoId)
        .eq("match_id", match_id);

      // All predictions of bolão (for ranking)
      const { data: allPreds } = await admin
        .from("predictions")
        .select("user_id, match_id, points, scorer_points, bonus_points")
        .eq("bolao_id", bolaoId);

      // Season predictions
      const { data: season } = await admin
        .from("season_predictions")
        .select("user_id, champion_points, top_scorer_points, best_player_points")
        .eq("bolao_id", bolaoId);

      const seasonMap: Record<string, number> = {};
      (season || []).forEach((s: any) => {
        seasonMap[s.user_id] =
          (s.champion_points || 0) + (s.top_scorer_points || 0) + (s.best_player_points || 0);
      });

      // Build current ranking
      const totals: Record<string, number> = {};
      const totalsBefore: Record<string, number> = {};
      (allPreds || []).forEach((p: any) => {
        const pts = (p.points || 0) + (p.scorer_points || 0) + (p.bonus_points || 0);
        totals[p.user_id] = (totals[p.user_id] || 0) + pts;
        if (p.match_id !== match_id) {
          totalsBefore[p.user_id] = (totalsBefore[p.user_id] || 0) + pts;
        }
      });
      Object.keys(seasonMap).forEach((u) => {
        totals[u] = (totals[u] || 0) + seasonMap[u];
        totalsBefore[u] = (totalsBefore[u] || 0) + seasonMap[u];
      });

      const rank = (map: Record<string, number>) => {
        const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
        const pos: Record<string, number> = {};
        sorted.forEach(([u], i) => (pos[u] = i + 1));
        return pos;
      };
      const posNow = rank(totals);
      const posBefore = rank(totalsBefore);

      // Resolve usernames
      const userIds = [...new Set((matchPreds || []).map((p: any) => p.user_id))];
      const { data: profs } = await admin
        .from("profiles")
        .select("user_id, username")
        .in("user_id", userIds);
      const nameOf: Record<string, string> = {};
      (profs || []).forEach((p: any) => (nameOf[p.user_id] = p.username));

      for (const pred of matchPreds || []) {
        const uname = nameOf[pred.user_id] || "Alguém";

        // exact_score
        if (pred.home_score === match.home_score && pred.away_score === match.away_score) {
          eventsToInsert.push({
            bolao_id: bolaoId,
            match_id,
            user_id: pred.user_id,
            event_type: "exact_score",
            message: `🎯 ${uname} acertou o placar exato! ${match.home_team} ${match.home_score}x${match.away_score} ${match.away_team}`,
          });
        }

        // streak: last 3 finished matches with points > 0
        const userPreds = (allPreds || [])
          .filter((p: any) => p.user_id === pred.user_id)
          .map((p: any) => ({
            match_id: p.match_id,
            total: (p.points || 0) + (p.scorer_points || 0) + (p.bonus_points || 0),
          }));
        // Need match dates to order — fetch
        if (userPreds.length >= 3) {
          const ids = userPreds.map((u) => u.match_id);
          const { data: ms } = await admin
            .from("matches")
            .select("id, match_date, is_finished")
            .in("id", ids)
            .eq("is_finished", true)
            .order("match_date", { ascending: false })
            .limit(3);
          if (ms && ms.length === 3) {
            const totalsByMatch: Record<string, number> = {};
            userPreds.forEach((u) => (totalsByMatch[u.match_id] = u.total));
            const last3 = ms.map((m: any) => totalsByMatch[m.id] || 0);
            if (last3.every((t) => t > 0) && ms[0].id === match_id) {
              eventsToInsert.push({
                bolao_id: bolaoId,
                match_id,
                user_id: pred.user_id,
                event_type: "streak",
                message: `🔥 ${uname} acertou 3 jogos seguidos!`,
              });
            }
          }
        }

        // podium: now top3, before not top3
        const pn = posNow[pred.user_id];
        const pb = posBefore[pred.user_id];
        if (pn && pn <= 3 && (!pb || pb > 3)) {
          eventsToInsert.push({
            bolao_id: bolaoId,
            match_id,
            user_id: pred.user_id,
            event_type: "podium",
            message: `🏆 ${uname} entrou no pódio!`,
          });
        }

        // climbed: moved up 2+ positions
        if (pn && pb && pb - pn >= 2) {
          eventsToInsert.push({
            bolao_id: bolaoId,
            match_id,
            user_id: pred.user_id,
            event_type: "climbed",
            message: `📈 ${uname} subiu ${pb - pn} posições no ranking!`,
          });
        }
      }
    }

    // De-dup at DB level via unique index (bolao_id, event_type, match_id, user_id)
    if (eventsToInsert.length > 0) {
      const { error: upsertErr } = await admin
        .from("feed_events")
        .upsert(eventsToInsert, {
          onConflict: "bolao_id,event_type,match_id,user_id",
          ignoreDuplicates: true,
        });
      if (upsertErr) console.error("feed upsert error", upsertErr);
      return new Response(JSON.stringify({ attempted: eventsToInsert.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ inserted: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
