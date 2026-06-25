
-- Corrige goleadores de ontem que ficaram -1 por mismatch de acento / corrida com a lista de artilheiros
WITH fixes AS (
  SELECT p.id, p.bolao_id, p.match_id, p.scorer_name
  FROM predictions p
  JOIN matches m ON m.id = p.match_id
  WHERE m.match_date >= '2026-06-24' AND m.match_date < '2026-06-25 12:00:00'
    AND p.scorer_name IN ('Ismaël Saibari','Julián Quiñones')
    AND p.scorer_points = -1
)
UPDATE predictions SET scorer_points = 2
WHERE id IN (SELECT id FROM fixes);

-- Feed events para os acertos (um por bolão/jogador/jogo)
INSERT INTO feed_events (bolao_id, match_id, event_type, message)
SELECT DISTINCT p.bolao_id, p.match_id, 'scorer_hit',
  CASE p.scorer_name
    WHEN 'Ismaël Saibari'  THEN '⚽ Ismaël Saibari marcou para Marrocos! Palpiteiros acertaram o goleador.'
    WHEN 'Julián Quiñones' THEN '⚽ Julián Quiñones marcou para México! Palpiteiros acertaram o goleador.'
  END
FROM predictions p
JOIN matches m ON m.id = p.match_id
WHERE m.match_date >= '2026-06-24' AND m.match_date < '2026-06-25 12:00:00'
  AND p.scorer_name IN ('Ismaël Saibari','Julián Quiñones')
  AND p.scorer_points = 2;
