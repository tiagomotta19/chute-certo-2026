import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ArrowLeft, Copy, Loader2, MapPin } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { getFlag } from "@/lib/country-flags";
import { formatMatchScore } from "@/lib/match-score";
import {
  STAGE_LABELS,
  getClosestGroupName,
  getClosestRound,
  getClosestStage,
  groupByName,
  groupByRound,
  groupByStage,
  orderedStages,
} from "@/lib/match-stages";

type Match = Tables<"matches">;

const Calendario = () => {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [openStages, setOpenStages] = useState<string[]>([]);
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const [openGroupRounds, setOpenGroupRounds] = useState<string[]>([]);
  const [groupViewMode, setGroupViewMode] = useState<"round" | "group">("round");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("matches")
        .select("*")
        .order("match_date", { ascending: true });
      setMatches(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const byStage = useMemo(() => groupByStage(matches), [matches]);
  const stages = useMemo(() => orderedStages(byStage), [byStage]);
  const closestStage = useMemo(() => getClosestStage(matches), [matches]);
  const closestGroup = useMemo(() => getClosestGroupName(matches), [matches]);
  const groupStageMatches = useMemo(() => byStage["group"] || [], [byStage]);
  const allGroupNames = useMemo(
    () => Object.keys(groupByName(groupStageMatches)),
    [groupStageMatches]
  );
  const allGroupRoundNames = useMemo(
    () => Object.keys(groupByRound(groupStageMatches)),
    [groupStageMatches]
  );
  const closestGroupRound = useMemo(
    () => getClosestRound(groupStageMatches),
    [groupStageMatches]
  );

  useEffect(() => {
    if (!initialized && stages.length > 0) {
      setOpenStages(closestStage ? [closestStage] : []);
      setOpenGroups(closestGroup ? [closestGroup] : []);
      setOpenGroupRounds(closestGroupRound ? [closestGroupRound] : []);
      setInitialized(true);
    }
  }, [stages, closestStage, closestGroup, closestGroupRound, initialized]);

  const allExpanded =
    stages.length > 0 &&
    openStages.length === stages.length &&
    openGroups.length === allGroupNames.length &&
    openGroupRounds.length === allGroupRoundNames.length;

  const toggleAll = () => {
    if (allExpanded) {
      setOpenStages([]);
      setOpenGroups([]);
      setOpenGroupRounds([]);
    } else {
      setOpenStages([...stages]);
      setOpenGroups([...allGroupNames]);
      setOpenGroupRounds([...allGroupRoundNames]);
    }
  };

  const showGroupToggle = groupStageMatches.length > 0;

  const buildShareText = () => {
    let text = "⚽ *Copa do Mundo 2026 — Calendário*\n\n";
    const sorted = [...matches].sort(
      (a, b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime()
    );
    sorted.forEach((match) => {
      const d = new Date(match.match_date).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        timeZone: "America/Sao_Paulo",
      });
      const time = new Date(match.match_date).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo",
      });
      const score = match.is_finished
        ? `  ${match.home_score} × ${match.away_score}`
        : "";
      text += `${d} ${time} — ${match.home_team} × ${match.away_team}${score}\n`;
    });
    text += "\n🕐 Horários em BRT";
    return text;
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(buildShareText());
      toast.success("Copiado! Cole no WhatsApp 📲");
    } catch {
      toast.error("Erro ao copiar");
    }
  };

  const renderMatch = (match: Match) => {
    const time = new Date(match.match_date).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });
    const date = new Date(match.match_date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      timeZone: "America/Sao_Paulo",
    });
    return (
      <Card key={match.id}>
        <CardContent className="p-4">
          <div className="flex items-center">
            <span className="flex-1 font-semibold">
              <span className="emoji-flag">{getFlag(match.home_team)}</span> {match.home_team}
            </span>
            {match.is_finished ? (
              <span className="mx-3 min-w-[60px] text-center text-lg font-bold text-accent">
                {match.home_score} × {match.away_score}
              </span>
            ) : (
              <span className="mx-3 min-w-[70px] text-center text-sm font-medium text-muted-foreground">
                {date} {time}
              </span>
            )}
            <span className="flex-1 text-right font-semibold">
              {match.away_team} <span className="emoji-flag">{getFlag(match.away_team)}</span>
            </span>
          </div>
          {(match.stadium || match.city) && (
            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {match.stadium && <span>{match.stadium}</span>}
              {match.city && <span>• {match.city}</span>}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      <header className="border-b bg-primary px-4 py-4 text-primary-foreground">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="text-primary-foreground hover:bg-primary-foreground/10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold flex-1">Calendário</h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyText}
            disabled={loading || matches.length === 0}
            className="text-primary-foreground hover:bg-primary-foreground/10 gap-1.5"
          >
            <Copy className="h-4 w-4" />
            Compartilhar
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : matches.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">
            Nenhum jogo cadastrado ainda
          </p>
        ) : (
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
              ) : (
                <span />
              )}
              <Button variant="outline" size="sm" onClick={toggleAll}>
                {allExpanded ? "Recolher tudo" : "Expandir tudo"}
              </Button>
            </div>
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
                                      {[...roundMatches]
                                        .sort(
                                          (a, b) =>
                                            new Date(a.match_date).getTime() -
                                            new Date(b.match_date).getTime()
                                        )
                                        .map(renderMatch)}
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
                                      {groupMatches.map(renderMatch)}
                                    </div>
                                  </AccordionContent>
                                </AccordionItem>
                              ))}
                          </Accordion>
                        )
                      ) : (
                        <div className="space-y-2">{stageMatches.map(renderMatch)}</div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
};

export default Calendario;
