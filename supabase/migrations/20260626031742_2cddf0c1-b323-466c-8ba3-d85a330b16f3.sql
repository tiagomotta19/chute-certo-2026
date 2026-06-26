CREATE EXTENSION IF NOT EXISTS unaccent;

DO $$
DECLARE
  m RECORD;
  scored_set TEXT[];
BEGIN
  FOR m IN
    SELECT id, match_date FROM public.matches
    WHERE id IN (
      '16ac317f-e46b-48de-845f-589d8622b1a1',
      'd618a841-a8cd-479c-93f0-8a9e7103f575',
      '841abfec-d784-45d1-806b-5dc3192a4750',
      '2c24c6aa-e05f-4446-8452-8d21e12079cf',
      '379701ed-7838-4285-be19-1c9e03e2e71a',
      'f447e641-c356-4032-99d7-707435f59f89'
    )
  LOOP
    WITH bs AS (
      SELECT scorers FROM public.scorer_snapshots
      WHERE captured_at < m.match_date
      ORDER BY captured_at DESC LIMIT 1
    ),
    as_ AS (
      SELECT scorers FROM public.scorer_snapshots
      WHERE captured_at >= m.match_date + interval '110 minutes'
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
    WHERE p.match_id = m.id
      AND p.scorer_name IS NOT NULL
      AND p.scorer_name <> '';
  END LOOP;
END $$;