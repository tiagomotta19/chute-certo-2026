
CREATE OR REPLACE FUNCTION public.calculate_match_points(match_id_input uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  m RECORD;
  multiplier numeric;
  scorer_mult numeric;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT home_score, away_score, stage, is_finished
  INTO m
  FROM public.matches
  WHERE id = match_id_input;

  IF m.home_score IS NULL OR m.away_score IS NULL THEN
    RETURN;
  END IF;

  multiplier := CASE m.stage
    WHEN 'round_of_32'    THEN 1.25
    WHEN 'round_of_16'    THEN 1.5
    WHEN 'quarter_final'  THEN 1.5
    WHEN 'semi_final'     THEN 2.0
    WHEN 'third_place'    THEN 2.0
    WHEN 'final'          THEN 2.0
    ELSE 1.0
  END;

  -- Goleador: multiplicador só a partir das oitavas
  scorer_mult := CASE m.stage
    WHEN 'round_of_16'    THEN 1.5
    WHEN 'quarter_final'  THEN 1.5
    WHEN 'semi_final'     THEN 2.0
    WHEN 'third_place'    THEN 2.0
    WHEN 'final'          THEN 2.0
    ELSE 1.0
  END;

  UPDATE public.predictions p
  SET points = CEIL(
    CASE
      WHEN p.home_score = m.home_score AND p.away_score = m.away_score THEN 5
      WHEN (
        SIGN(p.home_score - p.away_score) = SIGN(m.home_score - m.away_score)
        AND m.home_score <> m.away_score
        AND (p.home_score - p.away_score) = (m.home_score - m.away_score)
      ) THEN 3
      WHEN m.home_score = m.away_score AND p.home_score = p.away_score THEN 2
      WHEN SIGN(p.home_score - p.away_score) = SIGN(m.home_score - m.away_score) THEN 1
      ELSE 0
    END * multiplier
  ),
  scorer_points = CASE
    WHEN p.scorer_name IS NOT NULL AND p.scorer_name <> '' THEN
      SIGN(COALESCE(p.scorer_points, 0)) * CEIL(ABS(COALESCE(p.scorer_points, 0)) * scorer_mult)
    ELSE 0
  END
  WHERE p.match_id = match_id_input;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_match_scorers(match_id_input uuid, scorer_names text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  normalized text[];
  m_stage text;
  scorer_mult numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT stage INTO m_stage FROM public.matches WHERE id = match_id_input;

  scorer_mult := CASE m_stage
    WHEN 'round_of_16'    THEN 1.5
    WHEN 'quarter_final'  THEN 1.5
    WHEN 'semi_final'     THEN 2.0
    WHEN 'third_place'    THEN 2.0
    WHEN 'final'          THEN 2.0
    ELSE 1.0
  END;

  SELECT COALESCE(array_agg(lower(unaccent(trim(n)))) FILTER (WHERE trim(n) <> ''), ARRAY[]::text[])
    INTO normalized
  FROM unnest(scorer_names) n;

  UPDATE public.predictions p
  SET scorer_points = CASE
    WHEN lower(unaccent(p.scorer_name)) = ANY(normalized) THEN CEIL(2 * scorer_mult)
    ELSE -CEIL(1 * scorer_mult)
  END
  WHERE p.match_id = match_id_input
    AND p.scorer_name IS NOT NULL
    AND p.scorer_name <> '';
END;
$function$;

CREATE OR REPLACE FUNCTION public.recompute_match_scorers_from_snapshots(match_id_input uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  m_date timestamptz;
  m_stage text;
  scorer_mult numeric;
  scored_set text[];
  affected int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT match_date, stage INTO m_date, m_stage FROM public.matches WHERE id = match_id_input;
  IF m_date IS NULL THEN
    RAISE EXCEPTION 'Match not found';
  END IF;

  scorer_mult := CASE m_stage
    WHEN 'round_of_16'    THEN 1.5
    WHEN 'quarter_final'  THEN 1.5
    WHEN 'semi_final'     THEN 2.0
    WHEN 'third_place'    THEN 2.0
    WHEN 'final'          THEN 2.0
    ELSE 1.0
  END;

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
    WHEN lower(unaccent(p.scorer_name)) = ANY(scored_set) THEN CEIL(2 * scorer_mult)
    ELSE -CEIL(1 * scorer_mult)
  END
  WHERE p.match_id = match_id_input
    AND p.scorer_name IS NOT NULL
    AND p.scorer_name <> '';
  GET DIAGNOSTICS affected = ROW_COUNT;

  RETURN json_build_object('scored_count', COALESCE(array_length(scored_set, 1), 0), 'predictions_updated', affected);
END;
$function$;
