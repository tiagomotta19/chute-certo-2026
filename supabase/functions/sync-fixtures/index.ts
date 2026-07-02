// sync-fixtures v6 — Official FIFA World Cup 2026 schedule from fifa.com
// All times in UTC. Source: https://www.fifa.com/pt/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Match {
  home_team: string;
  away_team: string;
  match_date: string;
  stadium: string;
  city: string;
  stage: string;
  group_name: string | null;
}

// All 104 matches from official FIFA website (scraped Apr 2026)
// Times converted from EDT to UTC (+4h)
function getAllMatches(): Match[] {
  return [
    // ==================== GROUP STAGE (72 matches) ====================

    // --- June 11 (Day 1) ---
    { home_team: "México", away_team: "África do Sul", match_date: "2026-06-11T19:00:00Z", stadium: "Estádio da Cidade do México", city: "Cidade do México", stage: "group", group_name: "A" },
    { home_team: "Coreia do Sul", away_team: "Tchéquia", match_date: "2026-06-12T02:00:00Z", stadium: "Estádio de Guadalajara", city: "Guadalajara", stage: "group", group_name: "A" },

    // --- June 12 (Day 2) ---
    { home_team: "Canadá", away_team: "Bósnia e Herzegovina", match_date: "2026-06-12T19:00:00Z", stadium: "Estádio de Toronto", city: "Toronto", stage: "group", group_name: "B" },
    { home_team: "EUA", away_team: "Paraguai", match_date: "2026-06-13T01:00:00Z", stadium: "Estádio de Los Angeles", city: "Los Angeles", stage: "group", group_name: "D" },

    // --- June 13 (Day 3) ---
    { home_team: "Catar", away_team: "Suíça", match_date: "2026-06-13T19:00:00Z", stadium: "Estádio da Baía de São Francisco", city: "São Francisco", stage: "group", group_name: "B" },
    { home_team: "Brasil", away_team: "Marrocos", match_date: "2026-06-13T22:00:00Z", stadium: "Estádio de Nova York/Nova Jersey", city: "Nova Iorque", stage: "group", group_name: "C" },
    { home_team: "Haiti", away_team: "Escócia", match_date: "2026-06-14T01:00:00Z", stadium: "Estádio de Boston", city: "Boston", stage: "group", group_name: "C" },

    // --- June 14 (Day 4) ---
    { home_team: "Austrália", away_team: "Turquia", match_date: "2026-06-14T04:00:00Z", stadium: "BC Place de Vancouver", city: "Vancouver", stage: "group", group_name: "D" },
    { home_team: "Alemanha", away_team: "Curaçau", match_date: "2026-06-14T17:00:00Z", stadium: "Estádio de Houston", city: "Houston", stage: "group", group_name: "E" },
    { home_team: "Holanda", away_team: "Japão", match_date: "2026-06-14T20:00:00Z", stadium: "Estádio de Dallas", city: "Dallas", stage: "group", group_name: "F" },
    { home_team: "Costa do Marfim", away_team: "Equador", match_date: "2026-06-14T23:00:00Z", stadium: "Estádio de Filadélfia", city: "Filadélfia", stage: "group", group_name: "E" },
    { home_team: "Suécia", away_team: "Tunísia", match_date: "2026-06-15T02:00:00Z", stadium: "Estádio de Monterrey", city: "Monterrey", stage: "group", group_name: "F" },

    // --- June 15 (Day 5) ---
    { home_team: "Espanha", away_team: "Cabo Verde", match_date: "2026-06-15T16:00:00Z", stadium: "Estádio de Atlanta", city: "Atlanta", stage: "group", group_name: "H" },
    { home_team: "Bélgica", away_team: "Egito", match_date: "2026-06-15T19:00:00Z", stadium: "Estádio de Seattle", city: "Seattle", stage: "group", group_name: "G" },
    { home_team: "Arábia Saudita", away_team: "Uruguai", match_date: "2026-06-15T22:00:00Z", stadium: "Estádio de Miami", city: "Miami", stage: "group", group_name: "H" },
    { home_team: "Irã", away_team: "Nova Zelândia", match_date: "2026-06-16T01:00:00Z", stadium: "Estádio de Los Angeles", city: "Los Angeles", stage: "group", group_name: "G" },

    // --- June 16 (Day 6) ---
    { home_team: "França", away_team: "Senegal", match_date: "2026-06-16T19:00:00Z", stadium: "Estádio de Nova York/Nova Jersey", city: "Nova Iorque", stage: "group", group_name: "I" },
    { home_team: "Iraque", away_team: "Noruega", match_date: "2026-06-16T22:00:00Z", stadium: "Estádio de Boston", city: "Boston", stage: "group", group_name: "I" },
    { home_team: "Argentina", away_team: "Argélia", match_date: "2026-06-17T01:00:00Z", stadium: "Estádio de Kansas City", city: "Kansas City", stage: "group", group_name: "J" },

    // --- June 17 (Day 7) ---
    { home_team: "Áustria", away_team: "Jordânia", match_date: "2026-06-17T04:00:00Z", stadium: "Estádio da Baía de São Francisco", city: "São Francisco", stage: "group", group_name: "J" },
    { home_team: "Portugal", away_team: "RD do Congo", match_date: "2026-06-17T17:00:00Z", stadium: "Estádio de Houston", city: "Houston", stage: "group", group_name: "K" },
    { home_team: "Inglaterra", away_team: "Croácia", match_date: "2026-06-17T20:00:00Z", stadium: "Estádio de Dallas", city: "Dallas", stage: "group", group_name: "L" },
    { home_team: "Gana", away_team: "Panamá", match_date: "2026-06-17T23:00:00Z", stadium: "Estádio de Toronto", city: "Toronto", stage: "group", group_name: "L" },
    { home_team: "Uzbequistão", away_team: "Colômbia", match_date: "2026-06-18T02:00:00Z", stadium: "Estádio da Cidade do México", city: "Cidade do México", stage: "group", group_name: "K" },

    // --- June 18 (Day 8 - MD2 starts) ---
    { home_team: "Tchéquia", away_team: "África do Sul", match_date: "2026-06-18T16:00:00Z", stadium: "Estádio de Atlanta", city: "Atlanta", stage: "group", group_name: "A" },
    { home_team: "Suíça", away_team: "Bósnia e Herzegovina", match_date: "2026-06-18T19:00:00Z", stadium: "Estádio de Los Angeles", city: "Los Angeles", stage: "group", group_name: "B" },
    { home_team: "Canadá", away_team: "Catar", match_date: "2026-06-18T22:00:00Z", stadium: "BC Place de Vancouver", city: "Vancouver", stage: "group", group_name: "B" },
    { home_team: "México", away_team: "Coreia do Sul", match_date: "2026-06-19T01:00:00Z", stadium: "Estádio de Guadalajara", city: "Guadalajara", stage: "group", group_name: "A" },

    // --- June 19 (Day 9) ---
    { home_team: "EUA", away_team: "Austrália", match_date: "2026-06-19T19:00:00Z", stadium: "Estádio de Seattle", city: "Seattle", stage: "group", group_name: "D" },
    { home_team: "Escócia", away_team: "Marrocos", match_date: "2026-06-19T22:00:00Z", stadium: "Estádio de Boston", city: "Boston", stage: "group", group_name: "C" },
    { home_team: "Brasil", away_team: "Haiti", match_date: "2026-06-20T00:30:00Z", stadium: "Estádio de Filadélfia", city: "Filadélfia", stage: "group", group_name: "C" },
    { home_team: "Turquia", away_team: "Paraguai", match_date: "2026-06-20T03:00:00Z", stadium: "Estádio da Baía de São Francisco", city: "São Francisco", stage: "group", group_name: "D" },

    // --- June 20 (Day 10) ---
    { home_team: "Holanda", away_team: "Suécia", match_date: "2026-06-20T17:00:00Z", stadium: "Estádio de Houston", city: "Houston", stage: "group", group_name: "F" },
    { home_team: "Alemanha", away_team: "Costa do Marfim", match_date: "2026-06-20T20:00:00Z", stadium: "Estádio de Toronto", city: "Toronto", stage: "group", group_name: "E" },
    { home_team: "Equador", away_team: "Curaçau", match_date: "2026-06-21T00:00:00Z", stadium: "Estádio de Kansas City", city: "Kansas City", stage: "group", group_name: "E" },

    // --- June 21 (Day 11) ---
    { home_team: "Tunísia", away_team: "Japão", match_date: "2026-06-21T04:00:00Z", stadium: "Estádio de Monterrey", city: "Monterrey", stage: "group", group_name: "F" },
    { home_team: "Espanha", away_team: "Arábia Saudita", match_date: "2026-06-21T16:00:00Z", stadium: "Estádio de Atlanta", city: "Atlanta", stage: "group", group_name: "H" },
    { home_team: "Bélgica", away_team: "Irã", match_date: "2026-06-21T19:00:00Z", stadium: "Estádio de Los Angeles", city: "Los Angeles", stage: "group", group_name: "G" },
    { home_team: "Uruguai", away_team: "Cabo Verde", match_date: "2026-06-21T22:00:00Z", stadium: "Estádio de Miami", city: "Miami", stage: "group", group_name: "H" },
    { home_team: "Nova Zelândia", away_team: "Egito", match_date: "2026-06-22T01:00:00Z", stadium: "BC Place de Vancouver", city: "Vancouver", stage: "group", group_name: "G" },

    // --- June 22 (Day 12) ---
    { home_team: "Argentina", away_team: "Áustria", match_date: "2026-06-22T17:00:00Z", stadium: "Estádio de Dallas", city: "Dallas", stage: "group", group_name: "J" },
    { home_team: "França", away_team: "Iraque", match_date: "2026-06-22T21:00:00Z", stadium: "Estádio de Filadélfia", city: "Filadélfia", stage: "group", group_name: "I" },
    { home_team: "Noruega", away_team: "Senegal", match_date: "2026-06-23T00:00:00Z", stadium: "Estádio de Nova York/Nova Jersey", city: "Nova Iorque", stage: "group", group_name: "I" },
    { home_team: "Jordânia", away_team: "Argélia", match_date: "2026-06-23T03:00:00Z", stadium: "Estádio da Baía de São Francisco", city: "São Francisco", stage: "group", group_name: "J" },

    // --- June 23 (Day 13) ---
    { home_team: "Portugal", away_team: "Uzbequistão", match_date: "2026-06-23T17:00:00Z", stadium: "Estádio de Houston", city: "Houston", stage: "group", group_name: "K" },
    { home_team: "Inglaterra", away_team: "Gana", match_date: "2026-06-23T20:00:00Z", stadium: "Estádio de Boston", city: "Boston", stage: "group", group_name: "L" },
    { home_team: "Panamá", away_team: "Croácia", match_date: "2026-06-23T23:00:00Z", stadium: "Estádio de Toronto", city: "Toronto", stage: "group", group_name: "L" },
    { home_team: "Colômbia", away_team: "RD do Congo", match_date: "2026-06-24T02:00:00Z", stadium: "Estádio de Guadalajara", city: "Guadalajara", stage: "group", group_name: "K" },

    // --- June 24 (Day 14 - MD3 starts) ---
    { home_team: "Suíça", away_team: "Canadá", match_date: "2026-06-24T19:00:00Z", stadium: "BC Place de Vancouver", city: "Vancouver", stage: "group", group_name: "B" },
    { home_team: "Bósnia e Herzegovina", away_team: "Catar", match_date: "2026-06-24T19:00:00Z", stadium: "Estádio de Seattle", city: "Seattle", stage: "group", group_name: "B" },
    { home_team: "Escócia", away_team: "Brasil", match_date: "2026-06-24T22:00:00Z", stadium: "Estádio de Miami", city: "Miami", stage: "group", group_name: "C" },
    { home_team: "Marrocos", away_team: "Haiti", match_date: "2026-06-24T22:00:00Z", stadium: "Estádio de Atlanta", city: "Atlanta", stage: "group", group_name: "C" },
    { home_team: "Tchéquia", away_team: "México", match_date: "2026-06-25T01:00:00Z", stadium: "Estádio da Cidade do México", city: "Cidade do México", stage: "group", group_name: "A" },
    { home_team: "África do Sul", away_team: "Coreia do Sul", match_date: "2026-06-25T01:00:00Z", stadium: "Estádio de Monterrey", city: "Monterrey", stage: "group", group_name: "A" },

    // --- June 25 (Day 15) ---
    { home_team: "Curaçau", away_team: "Costa do Marfim", match_date: "2026-06-25T20:00:00Z", stadium: "Estádio de Filadélfia", city: "Filadélfia", stage: "group", group_name: "E" },
    { home_team: "Equador", away_team: "Alemanha", match_date: "2026-06-25T20:00:00Z", stadium: "Estádio de Nova York/Nova Jersey", city: "Nova Iorque", stage: "group", group_name: "E" },
    { home_team: "Japão", away_team: "Suécia", match_date: "2026-06-25T23:00:00Z", stadium: "Estádio de Dallas", city: "Dallas", stage: "group", group_name: "F" },
    { home_team: "Tunísia", away_team: "Holanda", match_date: "2026-06-25T23:00:00Z", stadium: "Estádio de Kansas City", city: "Kansas City", stage: "group", group_name: "F" },
    { home_team: "Turquia", away_team: "EUA", match_date: "2026-06-26T02:00:00Z", stadium: "Estádio de Los Angeles", city: "Los Angeles", stage: "group", group_name: "D" },
    { home_team: "Paraguai", away_team: "Austrália", match_date: "2026-06-26T02:00:00Z", stadium: "Estádio da Baía de São Francisco", city: "São Francisco", stage: "group", group_name: "D" },

    // --- June 26 (Day 16) ---
    { home_team: "Noruega", away_team: "França", match_date: "2026-06-26T19:00:00Z", stadium: "Estádio de Boston", city: "Boston", stage: "group", group_name: "I" },
    { home_team: "Senegal", away_team: "Iraque", match_date: "2026-06-26T19:00:00Z", stadium: "Estádio de Toronto", city: "Toronto", stage: "group", group_name: "I" },
    { home_team: "Cabo Verde", away_team: "Arábia Saudita", match_date: "2026-06-27T00:00:00Z", stadium: "Estádio de Houston", city: "Houston", stage: "group", group_name: "H" },
    { home_team: "Uruguai", away_team: "Espanha", match_date: "2026-06-27T00:00:00Z", stadium: "Estádio de Guadalajara", city: "Guadalajara", stage: "group", group_name: "H" },
    { home_team: "Egito", away_team: "Irã", match_date: "2026-06-27T03:00:00Z", stadium: "Estádio de Seattle", city: "Seattle", stage: "group", group_name: "G" },
    { home_team: "Nova Zelândia", away_team: "Bélgica", match_date: "2026-06-27T03:00:00Z", stadium: "BC Place de Vancouver", city: "Vancouver", stage: "group", group_name: "G" },

    // --- June 27 (Day 17) ---
    { home_team: "Panamá", away_team: "Inglaterra", match_date: "2026-06-27T21:00:00Z", stadium: "Estádio de Nova York/Nova Jersey", city: "Nova Iorque", stage: "group", group_name: "L" },
    { home_team: "Croácia", away_team: "Gana", match_date: "2026-06-27T21:00:00Z", stadium: "Estádio de Filadélfia", city: "Filadélfia", stage: "group", group_name: "L" },
    { home_team: "Colômbia", away_team: "Portugal", match_date: "2026-06-27T23:30:00Z", stadium: "Estádio de Miami", city: "Miami", stage: "group", group_name: "K" },
    { home_team: "RD do Congo", away_team: "Uzbequistão", match_date: "2026-06-27T23:30:00Z", stadium: "Estádio de Atlanta", city: "Atlanta", stage: "group", group_name: "K" },
    { home_team: "Argélia", away_team: "Áustria", match_date: "2026-06-28T02:00:00Z", stadium: "Estádio de Kansas City", city: "Kansas City", stage: "group", group_name: "J" },
    { home_team: "Jordânia", away_team: "Argentina", match_date: "2026-06-28T02:00:00Z", stadium: "Estádio de Dallas", city: "Dallas", stage: "group", group_name: "J" },

    // ==================== ROUND OF 32 (16 matches) ====================

    // --- June 28 ---
    { home_team: "2A", away_team: "2B", match_date: "2026-06-28T19:00:00Z", stadium: "Estádio de Los Angeles", city: "Los Angeles", stage: "round_of_32", group_name: null },

    // --- June 29 ---
    { home_team: "1C", away_team: "2F", match_date: "2026-06-29T17:00:00Z", stadium: "Estádio de Houston", city: "Houston", stage: "round_of_32", group_name: null },
    { home_team: "1E", away_team: "3ABCDF", match_date: "2026-06-29T20:30:00Z", stadium: "Estádio de Boston", city: "Boston", stage: "round_of_32", group_name: null },
    { home_team: "1F", away_team: "2C", match_date: "2026-06-30T01:00:00Z", stadium: "Estádio de Monterrey", city: "Monterrey", stage: "round_of_32", group_name: null },

    // --- June 30 ---
    { home_team: "2E", away_team: "2I", match_date: "2026-06-30T17:00:00Z", stadium: "Estádio de Dallas", city: "Dallas", stage: "round_of_32", group_name: null },
    { home_team: "1I", away_team: "3CDFGH", match_date: "2026-06-30T21:00:00Z", stadium: "Estádio de Nova York/Nova Jersey", city: "Nova Iorque", stage: "round_of_32", group_name: null },
    { home_team: "1A", away_team: "3CEFHI", match_date: "2026-07-01T01:00:00Z", stadium: "Estádio da Cidade do México", city: "Cidade do México", stage: "round_of_32", group_name: null },

    // --- July 1 ---
    { home_team: "1L", away_team: "3EHIJK", match_date: "2026-07-01T16:00:00Z", stadium: "Estádio de Atlanta", city: "Atlanta", stage: "round_of_32", group_name: null },
    { home_team: "1G", away_team: "3AEHIJ", match_date: "2026-07-01T20:00:00Z", stadium: "Estádio de Seattle", city: "Seattle", stage: "round_of_32", group_name: null },
    { home_team: "1D", away_team: "3BEFIJ", match_date: "2026-07-02T00:00:00Z", stadium: "Estádio da Baía de São Francisco", city: "São Francisco", stage: "round_of_32", group_name: null },

    // --- July 2 ---
    { home_team: "1H", away_team: "2J", match_date: "2026-07-02T19:00:00Z", stadium: "Estádio de Los Angeles", city: "Los Angeles", stage: "round_of_32", group_name: null },
    { home_team: "2K", away_team: "2L", match_date: "2026-07-02T23:00:00Z", stadium: "Estádio de Toronto", city: "Toronto", stage: "round_of_32", group_name: null },
    { home_team: "1B", away_team: "3EFGIJ", match_date: "2026-07-03T03:00:00Z", stadium: "BC Place de Vancouver", city: "Vancouver", stage: "round_of_32", group_name: null },

    // --- July 3 ---
    { home_team: "2D", away_team: "2G", match_date: "2026-07-03T18:00:00Z", stadium: "Estádio de Dallas", city: "Dallas", stage: "round_of_32", group_name: null },
    { home_team: "1J", away_team: "2H", match_date: "2026-07-03T22:00:00Z", stadium: "Estádio de Miami", city: "Miami", stage: "round_of_32", group_name: null },
    { home_team: "1K", away_team: "3DEIJL", match_date: "2026-07-04T01:30:00Z", stadium: "Estádio de Kansas City", city: "Kansas City", stage: "round_of_32", group_name: null },

    // ==================== ROUND OF 16 (8 matches) ====================

    // --- July 4 ---
    { home_team: "W73", away_team: "W76", match_date: "2026-07-04T17:00:00Z", stadium: "Estádio de Houston", city: "Houston", stage: "round_of_16", group_name: null },
    { home_team: "W74", away_team: "W77", match_date: "2026-07-04T21:00:00Z", stadium: "Estádio de Filadélfia", city: "Filadélfia", stage: "round_of_16", group_name: null },

    // --- July 5 ---
    { home_team: "W75", away_team: "W78", match_date: "2026-07-05T20:00:00Z", stadium: "Estádio de Nova York/Nova Jersey", city: "Nova Iorque", stage: "round_of_16", group_name: null },
    { home_team: "W79", away_team: "W80", match_date: "2026-07-06T00:00:00Z", stadium: "Estádio da Cidade do México", city: "Cidade do México", stage: "round_of_16", group_name: null },

    // --- July 6 ---
    { home_team: "W83", away_team: "W84", match_date: "2026-07-06T19:00:00Z", stadium: "Estádio de Dallas", city: "Dallas", stage: "round_of_16", group_name: null },
    { home_team: "W81", away_team: "W82", match_date: "2026-07-07T00:00:00Z", stadium: "Estádio de Seattle", city: "Seattle", stage: "round_of_16", group_name: null },

    // --- July 7 ---
    { home_team: "W85", away_team: "W86", match_date: "2026-07-07T16:00:00Z", stadium: "Estádio de Atlanta", city: "Atlanta", stage: "round_of_16", group_name: null },
    { home_team: "W87", away_team: "W88", match_date: "2026-07-07T20:00:00Z", stadium: "BC Place de Vancouver", city: "Vancouver", stage: "round_of_16", group_name: null },

    // ==================== QUARTER-FINALS (4 matches) ====================

    { home_team: "W89", away_team: "W90", match_date: "2026-07-09T20:00:00Z", stadium: "Estádio de Boston", city: "Boston", stage: "quarter_final", group_name: null },
    { home_team: "W93", away_team: "W94", match_date: "2026-07-10T19:00:00Z", stadium: "Estádio de Los Angeles", city: "Los Angeles", stage: "quarter_final", group_name: null },
    { home_team: "W91", away_team: "W92", match_date: "2026-07-11T21:00:00Z", stadium: "Estádio de Miami", city: "Miami", stage: "quarter_final", group_name: null },
    { home_team: "W95", away_team: "W96", match_date: "2026-07-12T01:00:00Z", stadium: "Estádio de Kansas City", city: "Kansas City", stage: "quarter_final", group_name: null },

    // ==================== SEMI-FINALS (2 matches) ====================

    { home_team: "W97", away_team: "W98", match_date: "2026-07-14T19:00:00Z", stadium: "Estádio de Dallas", city: "Dallas", stage: "semi_final", group_name: null },
    { home_team: "W99", away_team: "W100", match_date: "2026-07-15T19:00:00Z", stadium: "Estádio de Atlanta", city: "Atlanta", stage: "semi_final", group_name: null },

    // ==================== THIRD PLACE (1 match) ====================

    { home_team: "RU101", away_team: "RU102", match_date: "2026-07-18T21:00:00Z", stadium: "Estádio de Miami", city: "Miami", stage: "third_place", group_name: null },

    // ==================== FINAL (1 match) ====================

    { home_team: "W101", away_team: "W102", match_date: "2026-07-19T19:00:00Z", stadium: "Estádio de Nova York/Nova Jersey", city: "Nova Iorque", stage: "final", group_name: null },
  ];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[sync-fixtures] Loading official FIFA schedule...");

    const allMatches = getAllMatches();
    const groupMatches = allMatches.filter(m => m.stage === "group");
    const knockoutMatches = allMatches.filter(m => m.stage !== "group");

    console.log("[sync-fixtures] Total:", allMatches.length, "| Group:", groupMatches.length, "| Knockout:", knockoutMatches.length);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Delete existing non-manual matches and re-insert
    const { error: deleteError } = await supabaseAdmin
      .from("matches")
      .delete()
      .eq("is_manual_override", false);

    if (deleteError) {
      console.error("[sync-fixtures] Delete error:", deleteError);
    }

    let synced = 0;
    let skipped = 0;

    const batchRows = allMatches.map(m => ({
      home_team: m.home_team,
      away_team: m.away_team,
      match_date: m.match_date,
      stadium: m.stadium,
      city: m.city,
      stage: m.stage,
      group_name: m.group_name,
    }));

    // Batch insert in chunks of 50
    for (let i = 0; i < batchRows.length; i += 50) {
      const chunk = batchRows.slice(i, i + 50);
      const { error: insertError } = await supabaseAdmin.from("matches").insert(chunk);
      if (insertError) {
        console.error("[sync-fixtures] Insert error at chunk", i, insertError);
        skipped += chunk.length;
      } else {
        synced += chunk.length;
      }
    }

    console.log("[sync-fixtures] Done:", synced, "synced,", skipped, "skipped");

    return new Response(
      JSON.stringify({
        message: `${synced} jogos sincronizados com dados oficiais FIFA${skipped > 0 ? `, ${skipped} ignorados` : ""}`,
        synced,
        skipped,
        total: allMatches.length,
        source: "FIFA.com Official Schedule (Apr 2026)",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[sync-fixtures] Internal error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
