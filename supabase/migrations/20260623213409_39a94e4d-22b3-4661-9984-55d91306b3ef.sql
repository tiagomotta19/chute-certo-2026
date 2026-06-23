UPDATE public.predictions
SET scorer_points = 2
WHERE match_id = '4b7140ce-d519-42f5-b25b-06861b07d5cb'
  AND lower(scorer_name) = 'cristiano ronaldo'
  AND scorer_points = -1;