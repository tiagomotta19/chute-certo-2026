-- Final: Espanha 0×0 Argentina (90min), 1×0 após prorrogação. Gol: Ferran Torres 106'
UPDATE public.matches
SET home_score = 0,
    away_score = 0,
    extra_time_home = 1,
    extra_time_away = 0,
    penalty_home = NULL,
    penalty_away = NULL,
    is_finished = true,
    is_manual_override = true
WHERE id = '4adf63d2-d293-404a-bb09-cc29fcdf8ded';

SELECT public.calculate_match_points('4adf63d2-d293-404a-bb09-cc29fcdf8ded'::uuid);

-- Goleador com multiplicador ×2 (final): acerto +4, erro -2
UPDATE public.predictions
SET scorer_points = CASE
  WHEN scorer_name IS NULL THEN NULL
  WHEN lower(unaccent(scorer_name)) = lower(unaccent('Ferran Torres')) THEN 4
  ELSE -2
END
WHERE match_id = '4adf63d2-d293-404a-bb09-cc29fcdf8ded';