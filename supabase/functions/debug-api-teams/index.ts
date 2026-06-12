import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const key = Deno.env.get("FOOTBALL_DATA_API_KEY")!;
  const res = await fetch("https://api.football-data.org/v4/competitions/WC/matches?season=2026", {
    headers: { "X-Auth-Token": key },
  });
  const data = await res.json();
  const teams = new Set<string>();
  for (const m of data.matches ?? []) {
    if (m.homeTeam?.name) teams.add(m.homeTeam.name);
    if (m.awayTeam?.name) teams.add(m.awayTeam.name);
  }
  return new Response(JSON.stringify({ count: data.matches?.length ?? 0, teams: [...teams].sort() }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
