// sync-results — Mapeia api_football_id e sincroniza resultados + goleadores da Copa 2026
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BASE = "https://api.football-data.org/v4";

// PT (como gravado no DB) → nome exato retornado por football-data.org v4
const NAME_MAP: Record<string, string> = {
  "EUA": "United States", "Tchéquia": "Czechia", "Bósnia e Herzegovina": "Bosnia-Herzegovina",
  "Coreia do Sul": "South Korea", "África do Sul": "South Africa", "Holanda": "Netherlands",
  "Alemanha": "Germany", "França": "France", "Espanha": "Spain", "Brasil": "Brazil",
  "Inglaterra": "England", "Japão": "Japan", "Suécia": "Sweden", "Bélgica": "Belgium",
  "Arábia Saudita": "Saudi Arabia", "Marrocos": "Morocco", "Senegal": "Senegal",
  "Uruguai": "Uruguay", "Colômbia": "Colombia", "Croácia": "Croatia", "Equador": "Ecuador",
  "Austrália": "Australia", "Turquia": "Turkey", "Irã": "Iran", "Noruega": "Norway",
  "Argélia": "Algeria", "Áustria": "Austria", "Jordânia": "Jordan", "Escócia": "Scotland",
  "Panamá": "Panama", "Cabo Verde": "Cape Verde Islands", "Nova Zelândia": "New Zealand",
  "Costa do Marfim": "Ivory Coast", "RD Congo": "Congo DR", "RD do Congo": "Congo DR",
  "Uzbequistão": "Uzbekistan", "Curaçao": "Curaçao", "Curaçau": "Curaçao",
  "Paraguai": "Paraguay", "Catar": "Qatar", "Gana": "Ghana", "Suíça": "Switzerland",
  "Iraque": "Iraq", "Egito": "Egypt", "Tunísia": "Tunisia", "Haiti": "Haiti",
  "Portugal": "Portugal", "Argentina": "Argentina", "México": "Mexico", "Canadá": "Canada",
};

const norm = (s: string) => s.trim().toLowerCase();
const ptToEn = (pt: string) => NAME_MAP[pt] ?? pt;

async function apiGet(path: string, attempts = 3) {
  const key = Deno.env.get("FOOTBALL_DATA_API_KEY")!;
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    try {
      const res = await fetch(`${BASE}${path}`, {
        headers: { "X-Auth-Token": key, "Connection": "close" },
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`football-data ${path} → ${res.status}: ${txt}`);
      }
      return await res.json();
    } catch (e) {
      clearTimeout(t);
      lastErr = e;
      console.warn(`[apiGet] attempt ${i + 1}/${attempts} failed for ${path}: ${String((e as Error).message ?? e)}`);
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 500 * Math.pow(2, i)));
      }
    }
  }
  throw lastErr;
}

async function fetchScorersList(): Promise<any[] | null> {
  try {
    const data = await apiGet(`/competitions/WC/scorers?season=2026&limit=100`);
    return data.scorers ?? [];
  } catch (e) {
    console.error("[fetchScorersList] failed (non-fatal):", String((e as Error).message ?? e));
    return null;
  }
}

function buildScorersMap(scorers: any[] | null): Map<string, number> | null {
  if (!scorers) return null;
  const map = new Map<string, number>();
  for (const s of scorers) {
    const name = s.player?.name;
    const goals = s.goals ?? s.numberOfGoals ?? 0;
    if (name) map.set(norm(name), goals);
  }
  return map;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!Deno.env.get("FOOTBALL_DATA_API_KEY")) {
      return new Response(JSON.stringify({ error: "FOOTBALL_DATA_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ===== PASSO 1: Mapear api_football_id =====
    console.log("[sync-results] Step 1: mapping api_football_ids");
    const allMatchesData = await apiGet(`/competitions/WC/matches?season=2026`);
    const apiMatches: any[] = allMatchesData.matches ?? [];

    const { data: dbMatches, error: dbErr } = await supabase
      .from("matches")
      .select("id, home_team, away_team, match_date, api_football_id");
    if (dbErr) throw dbErr;

    let mapped = 0;
    const TWO_HOURS = 2 * 60 * 60 * 1000;

    // index API matches by normalized teams
    for (const apiM of apiMatches) {
      const apiHome = norm(apiM.homeTeam?.name ?? "");
      const apiAway = norm(apiM.awayTeam?.name ?? "");
      const apiDate = new Date(apiM.utcDate).getTime();

      const match = dbMatches?.find((db) => {
        const dbHome = norm(ptToEn(db.home_team));
        const dbAway = norm(ptToEn(db.away_team));
        if (dbHome !== apiHome || dbAway !== apiAway) return false;
        const dbDate = new Date(db.match_date).getTime();
        return Math.abs(dbDate - apiDate) <= TWO_HOURS;
      });

      if (match && !match.api_football_id) {
        const { error: upErr } = await supabase
          .from("matches")
          .update({ api_football_id: apiM.id })
          .eq("id", match.id);
        if (upErr) {
          console.error("update api_football_id err", upErr);
        } else {
          mapped++;
          match.api_football_id = apiM.id; // update local cache
        }
      }
    }
    console.log(`[sync-results] mapped=${mapped}`);

    // ===== PASSO 2: Snapshot artilharia (antes) — não-fatal =====
    console.log("[sync-results] Step 2: scorers snapshot (before)");
    const scorersBeforeList = await fetchScorersList();
    const scorersBefore = buildScorersMap(scorersBeforeList);

    // ===== PASSO 3: Sincronizar resultados =====
    console.log("[sync-results] Step 3: syncing FINISHED matches");
    const finishedData = await apiGet(`/competitions/WC/matches?season=2026&status=FINISHED`);
    const finished: any[] = finishedData.matches ?? [];

    // re-read db state with score/override
    const { data: dbFull, error: dbFullErr } = await supabase
      .from("matches")
      .select("id, api_football_id, home_score, away_score, is_manual_override, home_team, away_team");
    if (dbFullErr) throw dbFullErr;

    const updatedMatchIds: string[] = [];
    let updated = 0;

    for (const apiM of finished) {
      const homeScore = apiM.score?.fullTime?.home;
      const awayScore = apiM.score?.fullTime?.away;
      if (homeScore === null || homeScore === undefined) continue;

      const dbM = dbFull?.find((m) => m.api_football_id === apiM.id);
      if (!dbM) continue;
      if (dbM.is_manual_override) continue;
      if (dbM.home_score === homeScore && dbM.away_score === awayScore) continue;

      const { error: upErr } = await supabase
        .from("matches")
        .update({ home_score: homeScore, away_score: awayScore, is_finished: true })
        .eq("id", dbM.id);
      if (upErr) {
        console.error("update score err", upErr);
        continue;
      }

      const { error: rpcErr } = await supabase.rpc("calculate_match_points", { match_id_input: dbM.id });
      if (rpcErr) console.error("calculate_match_points err", rpcErr);

      updatedMatchIds.push(dbM.id);
      updated++;
    }
    console.log(`[sync-results] updated=${updated}`);

    // ===== PASSO 4: Goleadores — pula se scorers indisponível =====
    console.log("[sync-results] Step 4: scorer points");
    const scorersAfterList = await fetchScorersList();
    const scorersAfter = buildScorersMap(scorersAfterList);
    let scorers_resolved = 0;
    let scorers_skipped = false;

    if (!scorersBefore || !scorersAfter) {
      console.warn("[sync-results] scorers data unavailable — skipping scorer points this run");
      scorers_skipped = true;
    } else {
      // build team-name lookup once from latest snapshot
      const teamByPlayer = new Map<string, string>();
      for (const s of scorersAfterList ?? []) {
        const name = s.player?.name;
        if (name) teamByPlayer.set(norm(name), s.team?.name ?? "");
      }

      for (const matchId of updatedMatchIds) {
        const { data: preds, error: predErr } = await supabase
          .from("predictions")
          .select("id, user_id, bolao_id, scorer_name")
          .eq("match_id", matchId)
          .not("scorer_name", "is", null);
        if (predErr) {
          console.error("preds query err", predErr);
          continue;
        }
        if (!preds || preds.length === 0) continue;

        const hitsByPlayer = new Map<string, { bolaoIds: Set<string>; count: number }>();

        for (const p of preds) {
          if (!p.scorer_name) continue;
          const key = norm(p.scorer_name);
          const before = scorersBefore.get(key) ?? 0;
          const after = scorersAfter.get(key) ?? 0;
          const scored = after > before;
          const points = scored ? 2 : -1;

          const { error: updPredErr } = await supabase
            .from("predictions")
            .update({ scorer_points: points })
            .eq("id", p.id);
          if (updPredErr) {
            console.error("update pred err", updPredErr);
            continue;
          }
          scorers_resolved++;

          if (scored) {
            const entry = hitsByPlayer.get(p.scorer_name) ?? { bolaoIds: new Set(), count: 0 };
            entry.bolaoIds.add(p.bolao_id);
            entry.count++;
            hitsByPlayer.set(p.scorer_name, entry);
          }
        }

        for (const [playerName, info] of hitsByPlayer.entries()) {
          const teamName = teamByPlayer.get(norm(playerName)) ?? "";
          for (const bolaoId of info.bolaoIds) {
            const { error: feedErr } = await supabase.from("feed_events").insert({
              bolao_id: bolaoId,
              match_id: matchId,
              event_type: "scorer_hit",
              message: `⚽ ${playerName} marcou para ${teamName}! ${info.count} palpiteiro(s) acertaram o goleador.`,
            });
            if (feedErr) console.error("feed insert err", feedErr);
          }
        }
      }
    }

    // ===== PASSO 5: Generate feed events =====
    console.log("[sync-results] Step 5: invoking generate-feed-events");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    for (const matchId of updatedMatchIds) {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/generate-feed-events`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
            "apikey": serviceKey,
          },
          body: JSON.stringify({ match_id: matchId }),
        });
        await res.text();
      } catch (e) {
        console.error("generate-feed-events call err", e);
      }
    }

    return new Response(
      JSON.stringify({ mapped, updated, scorers_resolved, scorers_skipped }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[sync-results] fatal", e);
    return new Response(
      JSON.stringify({ error: String((e as Error).message ?? e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
