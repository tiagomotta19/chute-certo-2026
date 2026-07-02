ALTER TABLE public.matches
  ADD COLUMN extra_time_home integer,
  ADD COLUMN extra_time_away integer,
  ADD COLUMN penalty_home integer,
  ADD COLUMN penalty_away integer;