
-- Remove duplicatas mantendo o registro mais antigo
DELETE FROM public.feed_events a
USING public.feed_events b
WHERE a.ctid > b.ctid
  AND a.bolao_id = b.bolao_id
  AND a.event_type = b.event_type
  AND a.match_id IS NOT DISTINCT FROM b.match_id
  AND a.user_id IS NOT DISTINCT FROM b.user_id;

-- Índice único pra evitar duplicatas futuras (NULLS NOT DISTINCT cobre user_id/match_id nulos)
CREATE UNIQUE INDEX IF NOT EXISTS feed_events_dedup_idx
ON public.feed_events (bolao_id, event_type, match_id, user_id)
NULLS NOT DISTINCT;
