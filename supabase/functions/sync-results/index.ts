// sync-results — Mapeia api_football_id, sincroniza resultados e atribui pontos de goleador
// usando snapshots persistentes da artilharia (eliminando a corrida do approach antigo).
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

const norm = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();
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


// Fonte autoritativa: lista de gols do jogo específico. Retorna Map<nome_normalizado, nº_de_gols>.
async function fetchMatchScorers(apiMatchId: number): Promise<Map<string, number> | null> {
  try {
    const data = await apiGet(`/matches/${apiMatchId}`);
    const goals: any[] = data?.match?.goals ?? data?.goals ?? [];
    // Free-tier do football-data.org NÃO retorna `goals` por jogo (vem vazio).
    // Nesse caso, devolvemos null para o caller cair no fallback de snapshots.
    if (!Array.isArray(goals) || goals.length === 0) {
      console.warn(`[fetchMatchScorers] empty goals array for ${apiMatchId} — falling back to snapshots`);
      return null;
    }
    const map = new Map<string, number>();
    for (const g of goals) {
      if (g.type === "OWN") continue;
      const name = g.scorer?.name;
      if (!name) continue;
      const k = norm(name);
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return map.size > 0 ? map : null;
  } catch (e) {
    console.error(`[fetchMatchScorers] failed for ${apiMatchId} (non-fatal):`, String((e as Error).message ?? e));
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
        if (upErr) console.error("update api_football_id err", upErr);
        else { mapped++; match.api_football_id = apiM.id; }
      }
    }
    console.log(`[sync-results] mapped=${mapped}`);

    // ===== PASSO 2: Snapshot da artilharia ATUAL → grava no banco =====
    // Isso serve como "antes" para jogos que vierem a terminar no futuro.
    console.log("[sync-results] Step 2: capturing current scorers snapshot");
    const currentScorersList = await fetchScorersList();
    const currentScorersMap = buildScorersMap(currentScorersList);

    let snapshot_saved = false;
    if (currentScorersList && currentScorersList.length > 0) {
      const compact = currentScorersList.map((s: any) => ({
        name: s.player?.name,
        team: s.team?.name,
        goals: s.goals ?? s.numberOfGoals ?? 0,
      }));
      const { error: snapErr } = await supabase
        .from("scorer_snapshots")
        .insert({ scorers: compact });
      if (snapErr) console.error("snapshot insert err", snapErr);
      else snapshot_saved = true;
    }

    // ===== PASSO 3: Sincronizar resultados =====
    console.log("[sync-results] Step 3: syncing FINISHED matches");
    const finishedData = await apiGet(`/competitions/WC/matches?season=2026&status=FINISHED`);
    const finished: any[] = finishedData.matches ?? [];

    const { data: dbFull, error: dbFullErr } = await supabase
      .from("matches")
      .select("id, api_football_id, home_score, away_score, extra_time_home, extra_time_away, penalty_home, penalty_away, is_manual_override, home_team, away_team, match_date, stage");
    if (dbFullErr) throw dbFullErr;

    const scorerMultiplierFor = (stage: string | null | undefined): number => {
      switch (stage) {
        case "round_of_16":
        case "quarter_final":
          return 1.5;
        case "semi_final":
        case "third_place":
        case "final":
          return 2;
        default:
          return 1; // group e round_of_32: sem multiplicador de goleador
      }
    };

    const updatedMatches: Array<{ id: string; match_date: string; api_football_id: number; stage: string | null }> = [];
    let updated = 0;

    for (const apiM of finished) {
      // Placar oficial p/ pontuação = somente 90 min.
      // Em jogos eliminatórios com prorrogação/pênaltis, a API retorna o agregado em `fullTime`
      // e os 90 min em `regularTime`. Usamos `regularTime` quando disponível; caso contrário,
      // `fullTime` já representa os 90 min (jogos decididos no tempo normal).
      // Placar dos 90 min. A API às vezes retorna regularTime=null mesmo quando houve prorrogação
      // (ex.: 537422 Bélgica x Senegal veio duration=REGULAR, regularTime=null, extraTime=1-0).
      // Prioridade: regularTime → (fullTime - extraTime) se houve prorrogação → fullTime.
      const rt = apiM.score?.regularTime;
      const ft = apiM.score?.fullTime;
      const et = apiM.score?.extraTime;
      let homeScore: number | null | undefined;
      let awayScore: number | null | undefined;
      if (rt?.home != null && rt?.away != null) {
        homeScore = rt.home;
        awayScore = rt.away;
      } else if (ft?.home != null && ft?.away != null && et?.home != null && et?.away != null) {
        homeScore = ft.home - et.home;
        awayScore = ft.away - et.away;
      } else {
        homeScore = ft?.home;
        awayScore = ft?.away;
      }
      if (homeScore === null || homeScore === undefined) continue;

      // Prorrogação (placar TOTAL após ET = 90min + ET) e pênaltis (disputa)
      const pens = apiM.score?.penalties;
      const hasEt = et?.home != null && et?.away != null && (et.home !== 0 || et.away !== 0 || (pens?.home != null && pens?.away != null));
      const hasPens = pens?.home != null && pens?.away != null;
      const etHome = hasEt ? (homeScore + (et.home ?? 0)) : null;
      const etAway = hasEt ? (awayScore + (et.away ?? 0)) : null;
      const penHome = hasPens ? pens.home : null;
      const penAway = hasPens ? pens.away : null;

      const dbM = dbFull?.find((m) => m.api_football_id === apiM.id);
      if (!dbM) continue;
      if (dbM.is_manual_override) continue;
      if (
        dbM.home_score === homeScore &&
        dbM.away_score === awayScore &&
        (dbM as any).extra_time_home === etHome &&
        (dbM as any).extra_time_away === etAway &&
        (dbM as any).penalty_home === penHome &&
        (dbM as any).penalty_away === penAway
      ) continue;

      const { error: upErr } = await supabase
        .from("matches")
        .update({
          home_score: homeScore,
          away_score: awayScore,
          extra_time_home: etHome,
          extra_time_away: etAway,
          penalty_home: penHome,
          penalty_away: penAway,
          is_finished: true,
        })
        .eq("id", dbM.id);
      if (upErr) { console.error("update score err", upErr); continue; }

      const { error: rpcErr } = await supabase.rpc("calculate_match_points", { match_id_input: dbM.id });
      if (rpcErr) console.error("calculate_match_points err", rpcErr);

      updatedMatches.push({ id: dbM.id, match_date: dbM.match_date, api_football_id: apiM.id });
      updated++;
    }
    console.log(`[sync-results] updated=${updated}`);

    // ===== PASSO 4: Goleadores — fonte autoritativa via /matches/{id}, fallback p/ snapshots =====
    console.log("[sync-results] Step 4: scorer points (per-match goals, snapshot fallback)");
    let scorers_resolved = 0;
    let scorers_skipped = 0;

    const teamByPlayer = new Map<string, string>();
    for (const s of currentScorersList ?? []) {
      const name = s.player?.name;
      if (name) teamByPlayer.set(norm(name), s.team?.name ?? "");
    }

    for (const { id: matchId, match_date, api_football_id } of updatedMatches) {
      // 1) Tenta fonte autoritativa: lista de gols do jogo
      const matchGoals = await fetchMatchScorers(api_football_id);

      // 2) Fallback: comparar snapshots (lógica antiga)
      let beforeMap: Map<string, number> | null = null;
      if (!matchGoals) {
        const { data: snap, error: snapQErr } = await supabase
          .from("scorer_snapshots")
          .select("scorers, captured_at")
          .lt("captured_at", match_date)
          .order("captured_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (snapQErr) { console.error("snapshot query err", snapQErr); }
        if (snap) {
          beforeMap = new Map();
          for (const s of (snap.scorers as any[]) ?? []) {
            if (s.name) beforeMap.set(norm(s.name), s.goals ?? 0);
          }
        }
      }

      // Se nem fonte autoritativa nem snapshot estão disponíveis → adiar (próximo run tenta de novo)
      if (!matchGoals && (!beforeMap || !currentScorersMap)) {
        console.warn(`[sync-results] no scorer data for match ${matchId} — deferring`);
        scorers_skipped++;
        continue;
      }

      const { data: preds, error: predErr } = await supabase
        .from("predictions")
        .select("id, user_id, bolao_id, scorer_name")
        .eq("match_id", matchId)
        .not("scorer_name", "is", null);
      if (predErr) { console.error("preds query err", predErr); continue; }
      if (!preds || preds.length === 0) continue;

      const hitsByPlayer = new Map<string, { bolaoIds: Set<string>; count: number }>();

      for (const p of preds) {
        if (!p.scorer_name) continue;
        const key = norm(p.scorer_name);

        let scored: boolean;
        if (matchGoals) {
          scored = matchGoals.has(key);
        } else {
          const before = beforeMap!.get(key) ?? 0;
          const after = currentScorersMap!.get(key) ?? 0;
          scored = after > before;
        }
        const points = scored ? 2 : -1;

        const { error: updPredErr } = await supabase
          .from("predictions")
          .update({ scorer_points: points })
          .eq("id", p.id);
        if (updPredErr) { console.error("update pred err", updPredErr); continue; }
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


    // ===== PASSO 5: Generate feed events =====
    console.log("[sync-results] Step 5: invoking generate-feed-events");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    for (const { id: matchId } of updatedMatches) {
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
      JSON.stringify({ mapped, updated, scorers_resolved, scorers_skipped, snapshot_saved }),
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
