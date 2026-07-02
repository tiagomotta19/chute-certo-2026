import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Trophy } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { formatMatchScore } from "@/lib/match-score";

type Match = Tables<"matches">;
type Prediction = Tables<"predictions">;
type Profile = Pick<Tables<"profiles">, "user_id" | "username" | "avatar_url">;

type Row = {
  user_id: string;
  username: string;
  avatar_url: string | null;
  prediction?: Prediction;
};

const MatchPredictionsDialog = ({
  open,
  onOpenChange,
  match,
  bolaoId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  match: Match;
  bolaoId: string;
}) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data: members } = await supabase
        .from("bolao_members")
        .select("user_id")
        .eq("bolao_id", bolaoId);
      const userIds = (members || []).map((m) => m.user_id);
      if (userIds.length === 0) {
        if (!cancelled) {
          setRows([]);
          setLoading(false);
        }
        return;
      }
      const [{ data: profiles }, { data: preds }] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, username, avatar_url")
          .in("user_id", userIds),
        supabase
          .from("predictions")
          .select("*")
          .eq("bolao_id", bolaoId)
          .eq("match_id", match.id),
      ]);
      const predByUser = new Map<string, Prediction>(
        (preds || []).map((p) => [p.user_id, p as Prediction])
      );
      const built: Row[] = (profiles || []).map((p: Profile) => ({
        user_id: p.user_id,
        username: p.username,
        avatar_url: p.avatar_url,
        prediction: predByUser.get(p.user_id),
      }));
      built.sort((a, b) => {
        const ap = a.prediction;
        const bp = b.prediction;
        if (!ap && bp) return 1;
        if (ap && !bp) return -1;
        if (!ap && !bp) return a.username.localeCompare(b.username);
        if (match.is_finished) {
          const at = (ap!.points || 0) + (ap!.scorer_points || 0) + ((ap as any)?.bonus_points || 0);
          const bt = (bp!.points || 0) + (bp!.scorer_points || 0) + ((bp as any)?.bonus_points || 0);
          if (bt !== at) return bt - at;
        }
        return new Date(ap!.created_at).getTime() - new Date(bp!.created_at).getTime();
      });
      if (!cancelled) {
        setRows(built);
        setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [open, bolaoId, match.id, match.is_finished]);

  const isExact =
    match.is_finished &&
    match.home_score !== null &&
    match.away_score !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">
            Palpites do grupo
          </DialogTitle>
          <DialogDescription className="text-xs">
            {match.home_team} vs {match.away_team}
            {match.is_finished && (
              <> · Resultado: <span className="font-semibold text-accent">{match.home_score} × {match.away_score}</span></>
            )}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhum membro encontrado.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => {
              const p = r.prediction;
              const total = p
                ? (p.points || 0) + (p.scorer_points || 0) + ((p as any)?.bonus_points || 0)
                : 0;
              const exactMatch =
                isExact &&
                p &&
                p.home_score === match.home_score &&
                p.away_score === match.away_score;
              return (
                <li
                  key={r.user_id}
                  className="flex items-center gap-3 rounded-md border bg-card p-2"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={r.avatar_url || undefined} />
                    <AvatarFallback>
                      {r.username.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">
                      {r.username}
                      {exactMatch && (
                        <Trophy className="ml-1 inline h-3.5 w-3.5 text-accent" />
                      )}
                    </p>
                    {p ? (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          {p.home_score} × {p.away_score}
                        </span>
                        {p.scorer_name && <> · {p.scorer_name}</>}
                      </p>
                    ) : (
                      <p className="text-xs italic text-muted-foreground">
                        — sem palpite —
                      </p>
                    )}
                  </div>
                  {match.is_finished && p && (
                    <span className="text-sm font-bold text-accent">
                      +{total}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MatchPredictionsDialog;
