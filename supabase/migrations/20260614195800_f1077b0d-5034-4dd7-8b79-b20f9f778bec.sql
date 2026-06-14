CREATE TABLE public.scorer_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  captured_at timestamptz NOT NULL DEFAULT now(),
  scorers jsonb NOT NULL
);

CREATE INDEX idx_scorer_snapshots_captured_at ON public.scorer_snapshots (captured_at DESC);

GRANT ALL ON public.scorer_snapshots TO service_role;

ALTER TABLE public.scorer_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON public.scorer_snapshots
  FOR ALL TO service_role USING (true) WITH CHECK (true);