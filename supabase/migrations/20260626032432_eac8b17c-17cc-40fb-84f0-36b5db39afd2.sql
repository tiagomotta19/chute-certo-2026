
CREATE OR REPLACE FUNCTION public.set_match_scorers(match_id_input uuid, scorer_names text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  normalized text[];
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Normaliza a lista (trim, lower, sem acentos), descartando vazios
  SELECT COALESCE(array_agg(lower(unaccent(trim(n)))) FILTER (WHERE trim(n) <> ''), ARRAY[]::text[])
    INTO normalized
  FROM unnest(scorer_names) n;

  UPDATE public.predictions p
  SET scorer_points = CASE
    WHEN lower(unaccent(p.scorer_name)) = ANY(normalized) THEN 2
    ELSE -1
  END
  WHERE p.match_id = match_id_input
    AND p.scorer_name IS NOT NULL
    AND p.scorer_name <> '';
END;
$$;

REVOKE ALL ON FUNCTION public.set_match_scorers(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_match_scorers(uuid, text[]) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.recompute_match_scorers_from_snapshots(match_id_input uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  m_date timestamptz;
  scored_set text[];
  affected int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT match_date INTO m_date FROM public.matches WHERE id = match_id_input;
  IF m_date IS NULL THEN
    RAISE EXCEPTION 'Match not found';
  END IF;

  WITH bs AS (
    SELECT scorers FROM public.scorer_snapshots
    WHERE captured_at < m_date
    ORDER BY captured_at DESC LIMIT 1
  ),
  as_ AS (
    SELECT scorers FROM public.scorer_snapshots
    WHERE captured_at >= m_date + interval '110 minutes'
    ORDER BY captured_at ASC LIMIT 1
  ),
  before_g AS (
    SELECT lower(unaccent(x->>'name')) AS k, COALESCE((x->>'goals')::int, 0) AS g
    FROM bs, jsonb_array_elements(bs.scorers) x
  ),
  after_g AS (
    SELECT lower(unaccent(x->>'name')) AS k, COALESCE((x->>'goals')::int, 0) AS g
    FROM as_, jsonb_array_elements(as_.scorers) x
  )
  SELECT COALESCE(array_agg(a.k), ARRAY[]::text[]) INTO scored_set
  FROM after_g a
  LEFT JOIN before_g b USING (k)
  WHERE a.g > COALESCE(b.g, 0);

  UPDATE public.predictions p
  SET scorer_points = CASE
    WHEN lower(unaccent(p.scorer_name)) = ANY(scored_set) THEN 2
    ELSE -1
  END
  WHERE p.match_id = match_id_input
    AND p.scorer_name IS NOT NULL
    AND p.scorer_name <> '';
  GET DIAGNOSTICS affected = ROW_COUNT;

  RETURN json_build_object('scored_count', COALESCE(array_length(scored_set, 1), 0), 'predictions_updated', affected);
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_match_scorers_from_snapshots(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recompute_match_scorers_from_snapshots(uuid) TO authenticated, service_role;
