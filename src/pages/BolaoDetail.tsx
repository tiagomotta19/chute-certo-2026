import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ArrowLeft, Loader2, Trophy, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";
import { getFlag } from "@/lib/country-flags";
import SeasonPredictions from "@/components/SeasonPredictions";
import ScoringRulesModal from "@/components/ScoringRulesModal";
import BolaoFeed from "@/components/BolaoFeed";
import MatchPredictionsDialog from "@/components/MatchPredictionsDialog";
import { formatMatchScore } from "@/lib/match-score";
import {
  STAGE_LABELS,
  getClosestGroupName,
  getClosestStage,
  groupByName,
  groupByStage,
  orderedStages,
  getClosestRound,
  groupByRound,
  orderedRounds,
} from "@/lib/match-stages";
import squads from "@/data/squads.json";

type Match = Tables<"matches">;
type Prediction = Tables<"predictions">;

const BolaoDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [bolao, setBolao] = useState<Tables<"boloes"> | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Record<string, Prediction>>({});
  const [ranking, setRanking] = useState<{ username: string; total: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingMatch, setSavingMatch] = useState<string | null>(null);

  const fetchRanking = async (bolaoId: string, competition: string) => {
    const { data: allPreds } = await supabase
      .from("predictions")
      .select("user_id, points, scorer_points, bonus_points")
      .eq("bolao_id", bolaoId);

    const totals: Record<string, number> = {};
    (allPreds || []).forEach((p) => {
      totals[p.user_id] = (totals[p.user_id] || 0) + (p.points || 0) + (p.scorer_points || 0) + (p.bonus_points || 0);
    });

    // Season predictions only for Copa
    if (competition !== "brasileirao_2026") {
      const { data: seasonPreds } = await supabase
        .from("season_predictions")
        .select("*")
        .eq("bolao_id", bolaoId);

      (seasonPreds || []).forEach((sp) => {
        totals[sp.user_id] = (totals[sp.user_id] || 0) + (sp.champion_points || 0) + (sp.top_scorer_points || 0) + ((sp as any).best_player_points || 0);
      });
    }

    const userIds = Object.keys(totals);
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username")
        .in("user_id", userIds);

      const profileMap: Record<string, string> = {};
      (profiles || []).forEach((p) => {
        profileMap[p.user_id] = p.username;
      });

      setRanking(
        userIds
          .map((uid) => ({ username: profileMap[uid] || "?", total: totals[uid] }))
          .sort((a, b) => b.total - a.total)
      );
    } else {
      setRanking([]);
    }
  };

  useEffect(() => {
    if (!id || !user) return;
    const fetchData = async () => {
      const [bolaoRes, matchesRes, predsRes] = await Promise.all([
        supabase.from("boloes").select("*").eq("id", id).single(),
        supabase.from("matches").select("*").order("match_date", { ascending: true }),
        supabase.from("predictions").select("*").eq("bolao_id", id).eq("user_id", user.id),
      ]);
      setBolao(bolaoRes.data);
      
      // Filter matches by competition type.
      // Brasileirão: only matches that have a round_name NOT in Copa group rounds.
      // Copa: show all matches.
      const isBrasileraoComp = (bolaoRes.data as any)?.competition === "brasileirao_2026";
      const filteredMatches = (matchesRes.data || []).filter((m: any) =>
        isBrasileraoComp
          ? !!m.round_name && !['1ª Rodada','2ª Rodada','3ª Rodada'].includes(m.round_name!)
          : true
      );
      setMatches(filteredMatches);

      const predsMap: Record<string, Prediction> = {};
      (predsRes.data || []).forEach((p) => {
        predsMap[p.match_id] = p;
      });
      setPredictions(predsMap);

      // Fetch ranking
      await fetchRanking(id, (bolaoRes.data as any)?.competition || "copa_do_mundo_2026");

      setLoading(false);
    };
    fetchData();
  }, [id, user]);

  // Realtime subscription to refresh ranking when predictions change
  useEffect(() => {
    if (!id || !bolao) return;
    const channel = supabase
      .channel(`predictions-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'predictions', filter: `bolao_id=eq.${id}` },
        () => {
          fetchRanking(id, (bolao as any)?.competition || "copa_do_mundo_2026");
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, bolao]);

  const savePrediction = async (
    matchId: string,
    homeScore: number,
    awayScore: number,
    scorerName: string,
    bonusAnswer?: boolean | null
  ) => {
    if (!user || !id) return;
    setSavingMatch(matchId);

    const predData: any = {
      home_score: homeScore,
      away_score: awayScore,
      scorer_name: scorerName || null,
    };
    if (bonusAnswer !== undefined) predData.bonus_answer = bonusAnswer;

    const existing = predictions[matchId];
    if (existing) {
      await supabase
        .from("predictions")
        .update(predData)
        .eq("id", existing.id);
    } else {
      await supabase.from("predictions").insert({
        bolao_id: id,
        user_id: user.id,
        match_id: matchId,
        ...predData,
      } as any);
    }

    // Refresh predictions
    const { data } = await supabase
      .from("predictions")
      .select("*")
      .eq("bolao_id", id)
      .eq("user_id", user.id);
    const predsMap: Record<string, Prediction> = {};
    (data || []).forEach((p) => {
      predsMap[p.match_id] = p;
    });
    setPredictions(predsMap);
    setSavingMatch(null);
    toast({ title: "Palpite salvo!" });
  };

  const shareRanking = () => {
    if (!bolao || ranking.length === 0) return;
    const lines = [`🏆 Ranking ${bolao.name}\n`];
    ranking.forEach((r, i) => {
      lines.push(`${i + 1}. ${r.username} - ${r.total}pts`);
    });
    lines.push(`\nParticipe também: https://chute-certo-2026.lovable.app`);
    const text = lines.join("\n");
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, "_blank");
  };

  const shareInvite = () => {
    if (!bolao) return;
    const isLovableHost = /lovable(project)?\.app$/.test(window.location.hostname);
    const origin = isLovableHost ? "https://chute-certo-2026.lovable.app" : window.location.origin;
    const url = `${origin}/convite/${bolao.invite_code}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copiado!", description: "Compartilhe com seus amigos" });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!bolao) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Bolão não encontrado</p>
      </div>
    );
  }

  const isMatchLocked = (match: Match) => new Date(match.match_date) <= new Date();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b bg-primary px-4 py-4 text-primary-foreground">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="text-primary-foreground hover:bg-primary-foreground/10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">{bolao.name}</h1>
          </div>
          <div className="flex items-center gap-1">
            <ScoringRulesModal />
            <Button
              variant="ghost"
              size="icon"
              onClick={shareInvite}
              className="text-primary-foreground hover:bg-primary-foreground/10"
            >
              <Share2 className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 p-4">
        <Tabs defaultValue={searchParams.get("tab") || "palpites"}>
          <TabsList className="w-full">
            <TabsTrigger value="palpites" className="flex-1">Palpites</TabsTrigger>
            <TabsTrigger value="ranking" className="flex-1">Ranking</TabsTrigger>
            {(bolao as any).competition === "copa_do_mundo_2026" && (
              <TabsTrigger value="feed" className="flex-1">Feed</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="palpites" className="space-y-3 pt-4">
            {(bolao as any).competition !== "brasileirao_2026" && (
              <SeasonPredictions
                bolaoId={id!}
                userId={user!.id}
                firstMatchDate={matches.length > 0 ? matches[0].match_date : null}
              />
            )}
            {matches.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                Nenhum jogo cadastrado ainda
              </p>
            ) : (
              <RoundsAccordion
                matches={matches}
                predictions={predictions}
                savingMatch={savingMatch}
                onSave={savePrediction}
                isMatchLocked={isMatchLocked}
                isBrasileirao={(bolao as any).competition === "brasileirao_2026"}
                bolaoId={id!}
              />

            )}
          </TabsContent>


          <TabsContent value="ranking" className="pt-4">
            {ranking.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                Nenhuma pontuação ainda
              </p>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  {ranking.map((r, i) => (
                    <div
                      key={r.username}
                      className="flex items-center justify-between rounded-lg border bg-card p-3"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                            i === 0
                              ? "bg-accent text-accent-foreground"
                              : i === 1
                              ? "bg-muted text-muted-foreground"
                              : i === 2
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {i + 1}
                        </span>
                        <span className="font-medium">{r.username}</span>
                      </div>
                      <span className="text-lg font-bold text-accent">{r.total} pts</span>
                    </div>
                  ))}
                </div>
                <Button variant="outline" className="w-full" onClick={shareRanking}>
                  <Share2 className="mr-2 h-4 w-4" /> Compartilhar Ranking no WhatsApp
                </Button>
              </div>
            )}
          </TabsContent>

          {(bolao as any).competition === "copa_do_mundo_2026" && (
            <TabsContent value="feed" className="pt-4">
              <BolaoFeed bolaoId={id!} />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
};

const RoundsAccordion = ({
  matches,
  predictions,
  savingMatch,
  onSave,
  isMatchLocked,
  isBrasileirao,
  bolaoId,
}: {
  matches: Match[];
  predictions: Record<string, Prediction>;
  savingMatch: string | null;
  onSave: (matchId: string, home: number, away: number, scorer: string, bonusAnswer?: boolean | null) => void;
  isMatchLocked: (m: Match) => boolean;
  isBrasileirao: boolean;
  bolaoId: string;
}) => {
  // Brasileirão: group by round_name
  const byRound = useMemo(() => groupByRound(matches), [matches]);
  const rounds = useMemo(() => orderedRounds(byRound), [byRound]);
  const closestRound = useMemo(() => getClosestRound(matches), [matches]);

  // Copa: group by stage (+ subdivision by group_name within "group")
  const byStage = useMemo(() => groupByStage(matches), [matches]);
  const stages = useMemo(() => orderedStages(byStage), [byStage]);
  const closestStage = useMemo(() => getClosestStage(matches), [matches]);
  const closestGroup = useMemo(() => getClosestGroupName(matches), [matches]);
  const allGroupNames = useMemo(
    () => Object.keys(groupByName(byStage["group"] || [])),
    [byStage]
  );

  const [openRounds, setOpenRounds] = useState<string[]>([]);
  const [openStages, setOpenStages] = useState<string[]>([]);
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const [openGroupRounds, setOpenGroupRounds] = useState<string[]>([]);
  const [groupViewMode, setGroupViewMode] = useState<"round" | "group">("round");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized) return;
    if (isBrasileirao) {
      if (rounds.length === 0) return;
      setOpenRounds(closestRound ? [closestRound] : []);
    } else {
      if (stages.length === 0) return;
      setOpenStages(closestStage ? [closestStage] : []);
      setOpenGroups(closestGroup ? [closestGroup] : []);
      const groupStageMatches = byStage["group"] || [];
      if (groupStageMatches.length > 0) {
        const closestGroupRound = getClosestRound(groupStageMatches);
        setOpenGroupRounds(closestGroupRound ? [closestGroupRound] : []);
      }
    }
    setInitialized(true);
  }, [isBrasileirao, rounds, stages, closestRound, closestStage, closestGroup, initialized, byStage]);

  const allExpanded = isBrasileirao
    ? rounds.length > 0 && openRounds.length === rounds.length
    : stages.length > 0 &&
      openStages.length === stages.length &&
      openGroups.length === allGroupNames.length;

  const toggleAll = () => {
    if (isBrasileirao) {
      setOpenRounds(allExpanded ? [] : [...rounds]);
    } else if (allExpanded) {
      setOpenStages([]);
      setOpenGroups([]);
    } else {
      setOpenStages([...stages]);
      setOpenGroups([...allGroupNames]);
    }
  };

  const renderCard = (match: Match) => (
    <MatchPredictionCard
      key={match.id}
      match={match}
      prediction={predictions[match.id]}
      locked={isMatchLocked(match)}
      saving={savingMatch === match.id}
      onSave={onSave}
      isBrasileirao={isBrasileirao}
      bolaoId={bolaoId}
    />
  );

  const showGroupToggle = !isBrasileirao && (byStage["group"]?.length ?? 0) > 0;

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-2">
        {showGroupToggle ? (
          <div className="flex gap-1">
            <Button
              type="button"
              variant={groupViewMode === "round" ? "default" : "outline"}
              size="sm"
              onClick={() => setGroupViewMode("round")}
            >
              Por Rodada
            </Button>
            <Button
              type="button"
              variant={groupViewMode === "group" ? "default" : "outline"}
              size="sm"
              onClick={() => setGroupViewMode("group")}
            >
              Por Grupo
            </Button>
          </div>
        ) : <span />}
        <Button variant="outline" size="sm" onClick={toggleAll}>
          {allExpanded ? "Recolher tudo" : "Expandir tudo"}
        </Button>
      </div>
      {isBrasileirao ? (
        <Accordion
          type="multiple"
          value={openRounds}
          onValueChange={setOpenRounds}
          className="space-y-2"
        >
          {rounds.map((round) => {
            const roundMatches = byRound[round];
            return (
              <AccordionItem
                key={round}
                value={round}
                className="rounded-lg border bg-card px-3"
              >
                <AccordionTrigger className="hover:no-underline">
                  <span className="text-left font-semibold">
                    {round}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {roundMatches.length} jogos
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">{roundMatches.map(renderCard)}</div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      ) : (
        <Accordion
          type="multiple"
          value={openStages}
          onValueChange={setOpenStages}
          className="space-y-2"
        >
          {stages.map((stage) => {
            const stageMatches = byStage[stage];
            return (
              <AccordionItem
                key={stage}
                value={stage}
                className="rounded-lg border bg-card px-3"
              >
                <AccordionTrigger className="hover:no-underline">
                  <span className="text-left font-semibold">
                    {STAGE_LABELS[stage] || stage}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {stageMatches.length} jogos
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  {stage === "group" ? (
                    groupViewMode === "round" ? (
                      <Accordion
                        type="multiple"
                        value={openGroupRounds}
                        onValueChange={setOpenGroupRounds}
                        className="space-y-2"
                      >
                        {Object.entries(groupByRound(stageMatches))
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([roundName, roundMatches]) => (
                            <AccordionItem
                              key={roundName}
                              value={roundName}
                              className="rounded-md border bg-background px-3"
                            >
                              <AccordionTrigger className="hover:no-underline py-2 text-sm">
                                {roundName}
                                <span className="ml-2 text-xs font-normal text-muted-foreground">
                                  {roundMatches.length} jogos
                                </span>
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="space-y-2">
                                  {roundMatches.map(renderCard)}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                      </Accordion>
                    ) : (
                      <Accordion
                        type="multiple"
                        value={openGroups}
                        onValueChange={setOpenGroups}
                        className="space-y-2"
                      >
                        {Object.entries(groupByName(stageMatches))
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([groupName, groupMatches]) => (
                            <AccordionItem
                              key={groupName}
                              value={groupName}
                              className="rounded-md border bg-background px-3"
                            >
                              <AccordionTrigger className="hover:no-underline py-2 text-sm">
                                Grupo {groupName.replace(/^Grupo\s+/i, "")}
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="space-y-2">
                                  {groupMatches.map(renderCard)}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                      </Accordion>
                    )
                  ) : (
                    <div className="space-y-2">{stageMatches.map(renderCard)}</div>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </>
  );
};

// Sub-component for match prediction
const MatchPredictionCard = ({
  match,
  prediction,
  locked,
  saving,
  onSave,
  isBrasileirao = false,
  bolaoId,
}: {
  match: Tables<"matches">;
  prediction?: Tables<"predictions">;
  locked: boolean;
  saving: boolean;
  onSave: (matchId: string, home: number, away: number, scorer: string, bonusAnswer?: boolean | null) => void;
  isBrasileirao?: boolean;
  bolaoId: string;
}) => {
  const [showPredictions, setShowPredictions] = useState(false);
  const [homeScore, setHomeScore] = useState(prediction?.home_score?.toString() || "");
  const [awayScore, setAwayScore] = useState(prediction?.away_score?.toString() || "");
  const [scorer, setScorer] = useState(prediction?.scorer_name || "");
  const [bonusAnswer, setBonusAnswer] = useState<string>(
    (prediction as any)?.bonus_answer === true ? "sim" : (prediction as any)?.bonus_answer === false ? "nao" : ""
  );
  const awayScoreRef = useRef<HTMLInputElement>(null);
  const scorerRef = useRef<HTMLInputElement>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const squadPlayers = useMemo(() => {
    const s = squads as Record<string, string[]>;
    return [...(s[match.home_team] ?? []), ...(s[match.away_team] ?? [])]
      .sort((a, b) => a.localeCompare(b));
  }, [match.home_team, match.away_team]);

  const bonusQuestion = (match as any).bonus_question as string | null;

  const handleSave = () => {
    const h = parseInt(homeScore);
    const a = parseInt(awayScore);
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) return;
    const ba = bonusAnswer === "sim" ? true : bonusAnswer === "nao" ? false : null;
    onSave(match.id, h, a, scorer, ba);
  };

  const stageLabels: Record<string, string> = {
    group: "Fase de Grupos",
    round_of_32: "32 avos",
    round_of_16: "Oitavas",
    quarter_final: "Quartas",
    semi_final: "Semifinal",
    third_place: "3º Lugar",
    final: "Final",
  };

  const matchDate = new Date(match.match_date);

  return (
    <Card className={locked ? "opacity-70" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            {isBrasileirao
              ? ((match as any).round_name || "")
              : `${stageLabels[match.stage] || match.stage}${match.group_name ? ` • ${match.group_name}` : ""}`}
          </span>
          <span className="text-xs text-muted-foreground">
            {matchDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" })}
            {" "}
            {matchDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
          </span>
        </div>
        <CardTitle className="text-base">
          <span className="emoji-flag">{getFlag(match.home_team)}</span> {match.home_team} vs {match.away_team} <span className="emoji-flag">{getFlag(match.away_team)}</span>
        </CardTitle>
        {match.is_finished && (
          <p className="text-sm font-bold text-accent">
            Resultado: {formatMatchScore(match)}
          </p>
        )}
      </CardHeader>
      <CardContent>
        {locked ? (
          <div className="space-y-3">
            {prediction ? (
              <div className="space-y-1 text-sm">
                <p>
                  Seu palpite: <span className="font-bold">{prediction.home_score} × {prediction.away_score}</span>
                </p>
                {!isBrasileirao && prediction.scorer_name && (
                  <p>Goleador: <span className="font-medium">{prediction.scorer_name}</span></p>
                )}
                {isBrasileirao && bonusQuestion && (prediction as any)?.bonus_answer !== null && (
                  <p>{bonusQuestion} <span className="font-medium">{(prediction as any)?.bonus_answer ? "Sim" : "Não"}</span></p>
                )}
                {prediction.points !== null && (
                  <p className="font-bold text-accent">+{(prediction.points || 0) + (prediction.scorer_points || 0) + ((prediction as any)?.bonus_points || 0)} pts</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sem palpite (jogo travado)</p>
            )}
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowPredictions(true)}
              >
                Ver palpites do grupo
              </Button>
            </div>
            <MatchPredictionsDialog
              open={showPredictions}
              onOpenChange={setShowPredictions}
              match={match}
              bolaoId={bolaoId}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                max="20"
                placeholder="0"
                inputMode="numeric"
                value={homeScore}
                onChange={(e) => {
                  const val = e.target.value;
                  setHomeScore(val);
                  if (val.length >= 1 && /^\d+$/.test(val)) {
                    awayScoreRef.current?.focus();
                    awayScoreRef.current?.select();
                  }
                }}
                className="w-16 text-center"
              />
              <span className="text-sm font-bold">×</span>
              <Input
                ref={awayScoreRef}
                type="number"
                min="0"
                max="20"
                placeholder="0"
                inputMode="numeric"
                value={awayScore}
                onChange={(e) => {
                  const val = e.target.value;
                  setAwayScore(val);
                  if (val.length >= 1 && /^\d+$/.test(val) && !isBrasileirao) {
                    scorerRef.current?.focus();
                  }
                }}
                className="w-16 text-center"
              />
            </div>
            {isBrasileirao && bonusQuestion ? (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{bonusQuestion}</p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={bonusAnswer === "sim" ? "default" : "outline"}
                    onClick={() => setBonusAnswer(bonusAnswer === "sim" ? "" : "sim")}
                  >
                    Sim
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={bonusAnswer === "nao" ? "default" : "outline"}
                    onClick={() => setBonusAnswer(bonusAnswer === "nao" ? "" : "nao")}
                  >
                    Não
                  </Button>
                </div>
              </div>
            ) : !isBrasileirao ? (
              <div className="relative">
                <Input
                  ref={scorerRef}
                  placeholder="Jogador que marca (opcional)"
                  value={scorer}
                  onFocus={() => setSuggestions(squadPlayers)}
                  onChange={(e) => {
                    setScorer(e.target.value);
                    const q = e.target.value.toLowerCase();
                    setSuggestions(q.length === 0
                      ? squadPlayers
                      : squadPlayers.filter(p => p.toLowerCase().includes(q)).slice(0, 8));
                  }}
                  onBlur={() => setTimeout(() => setSuggestions([]), 150)}
                  onKeyDown={(e) => { if (e.key === "Escape") setSuggestions([]); }}
                />
                {suggestions.length > 0 && (
                  <ul className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md">
                    {suggestions.map((p) => (
                      <li
                        key={p}
                        className="cursor-pointer px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                        onMouseDown={(e) => { e.preventDefault(); setScorer(p); setSuggestions([]); }}
                      >
                        {p}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BolaoDetail;
