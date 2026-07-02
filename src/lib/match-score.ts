// Formata o placar de um jogo, mostrando prorrogação e pênaltis quando houver.
// - 90 min: "2 × 1"
// - Prorrogação (sem pênaltis): "2 × 2 (após prorrogação: 3 × 2)"
// - Pênaltis sem gols na prorrogação: "1 × 1 (pên. 3 × 4)"
// - Pênaltis COM gols na prorrogação: "1 × 1 (2 × 2 após prorrogação, pên. 4 × 3)"
export type MatchScoreLike = {
  home_score: number | null | undefined;
  away_score: number | null | undefined;
  extra_time_home?: number | null;
  extra_time_away?: number | null;
  penalty_home?: number | null;
  penalty_away?: number | null;
};

export function formatMatchScore(m: MatchScoreLike): string {
  if (m.home_score == null || m.away_score == null) return "";
  const base = `${m.home_score} × ${m.away_score}`;
  const hasPens = m.penalty_home != null && m.penalty_away != null;
  const hasEt = m.extra_time_home != null && m.extra_time_away != null;
  const etChangedScore =
    hasEt && (m.extra_time_home !== m.home_score || m.extra_time_away !== m.away_score);

  if (hasPens) {
    if (etChangedScore) {
      return `${base} (${m.extra_time_home} × ${m.extra_time_away} após prorrogação, pên. ${m.penalty_home} × ${m.penalty_away})`;
    }
    return `${base} (pên. ${m.penalty_home} × ${m.penalty_away})`;
  }
  if (hasEt && etChangedScore) {
    return `${base} (após prorrogação: ${m.extra_time_home} × ${m.extra_time_away})`;
  }
  return base;
}

