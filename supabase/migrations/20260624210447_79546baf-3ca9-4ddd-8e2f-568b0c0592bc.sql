CREATE OR REPLACE FUNCTION public.calculate_match_points(match_id_input uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  m RECORD;
  multiplier numeric;
BEGIN
  -- Permite chamada via service role (auth.uid() IS NULL) ou admin
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

  -- Multiplicador escalonado por fase
  multiplier := CASE m.stage
    WHEN 'round_of_32'    THEN 1.25
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
      CASE WHEN p.scorer_points IS NOT NULL THEN p.scorer_points ELSE 0 END
    ELSE 0
  END
  WHERE p.match_id = match_id_input;
END;
$function$;