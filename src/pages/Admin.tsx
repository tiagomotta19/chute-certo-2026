import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Loader2, Copy, Save, RefreshCw, AlertTriangle, Trash2, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";
import { Constants } from "@/integrations/supabase/types";
import { format, addDays, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";

type Match = Tables<"matches">;
type Bolao = Tables<"boloes"> & { invite_created_at?: string };

const stageOptions = Constants.public.Enums.match_stage;
const stageLabels: Record<string, string> = {
  group: "Fase de Grupos",
  round_of_32: "32 avos",
  round_of_16: "Oitavas",
  quarter_final: "Quartas",
  semi_final: "Semifinal",
  third_place: "3º Lugar",
  final: "Final",
};

const isInviteExpired = (inviteCreatedAt: string | undefined) => {
  if (!inviteCreatedAt) return false;
  return isPast(addDays(new Date(inviteCreatedAt), 7));
};

const Admin = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [boloes, setBoloes] = useState<Bolao[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<{ bolao_id: string; bolao_name: string; user_id: string; username: string; joined_at: string; member_id: string }[]>([]);
  const [removingMember, setRemovingMember] = useState<string | null>(null);

  // New bolao form
  const [newBolaoName, setNewBolaoName] = useState("");
  const [newBolaoCompetition, setNewBolaoCompetition] = useState("copa_do_mundo_2026");
  const [creatingBolao, setCreatingBolao] = useState(false);

  const bonusQuestionOptions = [
    "Nenhuma",
    "Vai ter gol no primeiro tempo?",
    "Vai ter gol no segundo tempo?",
    "Vai ter cartão vermelho?",
    "Vai ter pênalti?",
    "Vai ter gol nos acréscimos?",
    "O time mandante vai marcar?",
    "Vai ter mais de 2 gols no jogo?",
  ];

  // New match form
  const [matchForm, setMatchForm] = useState({
    home_team: "",
    away_team: "",
    match_date: "",
    stadium: "",
    city: "",
    stage: "group" as string,
    group_name: "",
    round_name: "",
  });
  const [creatingMatch, setCreatingMatch] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [regenerating, setRegenerating] = useState<string | null>(null);

  // Round bonus
  const [bonusRound, setBonusRound] = useState("");
  const [bonusRoundQuestion, setBonusRoundQuestion] = useState("Nenhuma");
  const [savingBonusRound, setSavingBonusRound] = useState(false);

  const availableRounds = [...new Set(matches.filter(m => m.round_name).map(m => m.round_name!))].sort();

  const saveRoundBonus = async () => {
    if (!bonusRound) return;
    setSavingBonusRound(true);
    const questionValue = bonusRoundQuestion !== "Nenhuma" ? bonusRoundQuestion : null;
    const { error } = await supabase
      .from("matches")
      .update({ bonus_question: questionValue } as any)
      .eq("round_name", bonusRound);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setMatches(prev => prev.map(m => m.round_name === bonusRound ? { ...m, bonus_question: questionValue } : m));
      toast({ title: "Pergunta bônus salva para " + bonusRound + "!" });
    }
    setSavingBonusRound(false);
  };


  const syncFixtures = async () => {
    setSyncing(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("Não autenticado");

      const res = await supabase.functions.invoke("sync-fixtures");
      if (res.error) throw res.error;
      const body = res.data;
      toast({ title: "Sincronizado!", description: body.message || `${body.synced} jogos` });

      const { data: freshMatches } = await supabase.from("matches").select("*").order("match_date", { ascending: true });
      if (freshMatches) setMatches(freshMatches);
    } catch (err: any) {
      toast({ title: "Erro ao sincronizar", description: err.message || String(err), variant: "destructive" });
    }
    setSyncing(false);
  };

  const [syncingResults, setSyncingResults] = useState(false);
  const syncResults = async () => {
    setSyncingResults(true);
    try {
      const res = await supabase.functions.invoke("sync-results", { method: "POST" });
      if (res.error) throw res.error;
      toast({ title: "sync-results", description: JSON.stringify(res.data) });
      alert("sync-results:\n" + JSON.stringify(res.data, null, 2));
    } catch (err: any) {
      toast({ title: "Erro sync-results", description: err.message || String(err), variant: "destructive" });
    }
    setSyncingResults(false);
  };

  useEffect(() => {
    if (!isAdmin) {
      navigate("/");
      return;
    }
    const fetchData = async () => {
      const [boloesRes, matchesRes, membersRes] = await Promise.all([
        supabase.from("boloes").select("*").order("created_at", { ascending: false }),
        supabase.from("matches").select("*").order("match_date", { ascending: true }),
        supabase.from("bolao_members").select("*"),
      ]);
      const boloesData = (boloesRes.data || []) as Bolao[];
      setBoloes(boloesData);
      setMatches(matchesRes.data || []);

      // Load profiles for members
      const memberData = membersRes.data || [];
      const userIds = [...new Set(memberData.map((m) => m.user_id))];
      let profileMap: Record<string, { username: string }> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("user_id, username").in("user_id", userIds);
        (profiles || []).forEach((p) => { profileMap[p.user_id] = { username: p.username }; });
      }
      const bolaoNameMap: Record<string, string> = {};
      boloesData.forEach((b) => { bolaoNameMap[b.id] = b.name; });

      setMembers(memberData.map((m) => ({
        bolao_id: m.bolao_id,
        bolao_name: bolaoNameMap[m.bolao_id] || "?",
        user_id: m.user_id,
        username: profileMap[m.user_id]?.username || "?",
        
        joined_at: m.joined_at,
        member_id: m.id,
      })));
      setLoading(false);
    };
    fetchData();
  }, [isAdmin, navigate]);

  const createBolao = async () => {
    if (!user || !newBolaoName.trim()) return;
    setCreatingBolao(true);
    const { data, error } = await supabase
      .from("boloes")
      .insert({ name: newBolaoName.trim(), created_by: user.id, competition: newBolaoCompetition } as any)
      .select()
      .single();

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else if (data) {
      await supabase.from("bolao_members").insert({ bolao_id: data.id, user_id: user.id });
      setBoloes((prev) => [data as Bolao, ...prev]);
      setNewBolaoName("");
      setNewBolaoCompetition("copa_do_mundo_2026");
      toast({ title: "Bolão criado!" });
    }
    setCreatingBolao(false);
  };

  const createMatch = async () => {
    if (!matchForm.home_team || !matchForm.away_team || !matchForm.match_date) return;
    setCreatingMatch(true);
    const { data, error } = await supabase
      .from("matches")
      .insert({
        home_team: matchForm.home_team,
        away_team: matchForm.away_team,
        match_date: new Date(matchForm.match_date).toISOString(),
        stadium: matchForm.stadium || null,
        city: matchForm.city || null,
        stage: matchForm.stage as any,
        group_name: matchForm.group_name || null,
        round_name: matchForm.round_name || null,
      } as any)
      .select()
      .single();

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else if (data) {
      setMatches((prev) => [...prev, data].sort((a, b) => a.match_date.localeCompare(b.match_date)));
      setMatchForm({ home_team: "", away_team: "", match_date: "", stadium: "", city: "", stage: "group", group_name: "", round_name: "" });
      toast({ title: "Jogo criado!" });
    }
    setCreatingMatch(false);
  };

  const updateMatchResult = async (matchId: string, homeScore: number, awayScore: number, bonusResult?: boolean | null): Promise<void> => {
    const updateData: any = { home_score: homeScore, away_score: awayScore, is_finished: true, is_manual_override: true };
    if (bonusResult !== undefined) updateData.bonus_result = bonusResult;
    const { error } = await supabase
      .from("matches")
      .update(updateData)
      .eq("id", matchId);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }

    // Recalculate match points for all predictions
    const { error: pointsError } = await supabase.rpc("calculate_match_points", {
      match_id_input: matchId,
    } as any);
    if (pointsError) {
      toast({ title: "Erro ao calcular pontos", description: pointsError.message, variant: "destructive" });
    }

    // Recalculate bonus points if bonus result is set
    if (bonusResult !== undefined && bonusResult !== null) {
      const { error: rpcError } = await supabase.rpc("calculate_bonus_points", {
        match_id_input: matchId,
        bonus_result_input: bonusResult,
      } as any);
      if (rpcError) {
        toast({ title: "Erro ao calcular bônus", description: rpcError.message, variant: "destructive" });
      }
    }

    // Generate feed events (fire-and-forget, errors don't block)
    try {
      await supabase.functions.invoke("generate-feed-events", {
        body: { match_id: matchId },
      });
    } catch (e) {
      console.warn("generate-feed-events failed", e);
    }

    setMatches((prev) =>
      prev.map((m) =>
        m.id === matchId
          ? { ...m, home_score: homeScore, away_score: awayScore, is_finished: true, is_manual_override: true, ...(bonusResult !== undefined ? { bonus_result: bonusResult } : {}) }
          : m
      )
    );
    toast({ title: "Resultado salvo e pontos recalculados!" });
  };

  const copyInviteLink = (code: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/convite/${code}`);
    toast({ title: "Link copiado!" });
  };

  const removeMember = async (memberId: string) => {
    setRemovingMember(memberId);
    const { error } = await supabase.from("bolao_members").delete().eq("id", memberId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setMembers((prev) => prev.filter((m) => m.member_id !== memberId));
      toast({ title: "Usuário removido do bolão!" });
    }
    setRemovingMember(null);
  };

  const handleRegenerateInvite = async (bolaoId: string) => {
    setRegenerating(bolaoId);
    try {
      const { data, error } = await supabase.rpc("regenerate_invite_code", {
        bolao_id_input: bolaoId,
      });

      if (error) throw error;

      const result = data as unknown as { invite_code: string; invite_created_at: string };
      setBoloes((prev) =>
        prev.map((b) =>
          b.id === bolaoId
            ? { ...b, invite_code: result.invite_code, invite_created_at: result.invite_created_at }
            : b
        )
      );
      toast({ title: "Novo link de convite gerado!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setRegenerating(null);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
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
          <h1 className="text-xl font-bold">Painel Admin</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 p-4">
        <Tabs defaultValue="boloes">
          <TabsList className="w-full">
            <TabsTrigger value="boloes" className="flex-1">Bolões</TabsTrigger>
            <TabsTrigger value="usuarios" className="flex-1">Usuários</TabsTrigger>
            <TabsTrigger value="jogos" className="flex-1">Jogos</TabsTrigger>
            <TabsTrigger value="resultados" className="flex-1">Resultados</TabsTrigger>
          </TabsList>

          {/* Bolões Tab */}
          <TabsContent value="boloes" className="space-y-4 pt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Criar Bolão</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  placeholder="Nome do bolão"
                  value={newBolaoName}
                  onChange={(e) => setNewBolaoName(e.target.value)}
                />
                <div>
                  <Label className="text-xs">Competição</Label>
                  <Select value={newBolaoCompetition} onValueChange={setNewBolaoCompetition}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="copa_do_mundo_2026">Copa do Mundo 2026</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={createBolao} disabled={creatingBolao || !newBolaoName.trim()}>
                  {creatingBolao ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Criar
                </Button>
              </CardContent>
            </Card>

            {boloes.map((bolao) => {
              const inviteExpired = isInviteExpired(bolao.invite_created_at);
              const expiresAt = bolao.invite_created_at
                ? addDays(new Date(bolao.invite_created_at), 7)
                : null;

              return (
                <Card key={bolao.id}>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{bolao.name}</p>
                        <p className="text-xs text-muted-foreground">Código: {bolao.invite_code}</p>
                      </div>
                      {!inviteExpired && (
                        <Button variant="outline" size="sm" onClick={() => copyInviteLink(bolao.invite_code)}>
                          <Copy className="mr-1 h-3 w-3" /> Link
                        </Button>
                      )}
                    </div>

                    {expiresAt && (
                      <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs ${
                        inviteExpired
                          ? "bg-destructive/10 text-destructive"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {inviteExpired && <AlertTriangle className="h-3.5 w-3.5" />}
                        <span>
                          {inviteExpired
                            ? `Convite expirou em ${format(expiresAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
                            : `Convite expira em ${format(expiresAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`}
                        </span>
                      </div>
                    )}

                    {inviteExpired && (
                      <Button
                        variant="default"
                        size="sm"
                        className="w-full"
                        onClick={() => handleRegenerateInvite(bolao.id)}
                        disabled={regenerating === bolao.id}
                      >
                        {regenerating === bolao.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-2 h-4 w-4" />
                        )}
                        Gerar novo link de convite
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          {/* Usuários Tab */}
          <TabsContent value="usuarios" className="space-y-4 pt-4">
            {boloes.map((bolao) => {
              const bolaoMembers = members.filter((m) => m.bolao_id === bolao.id);
              if (bolaoMembers.length === 0) return null;
              return (
                <Card key={bolao.id}>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="h-4 w-4" /> {bolao.name}
                      <span className="text-xs font-normal text-muted-foreground">({bolaoMembers.length} membros)</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {bolaoMembers.map((m) => (
                      <div key={m.member_id} className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <p className="text-sm font-medium">{m.username}</p>
                          <p className="text-xs text-muted-foreground">
                            Entrou em {format(new Date(m.joined_at), "dd/MM/yyyy", { locale: ptBR })}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => removeMember(m.member_id)}
                          disabled={removingMember === m.member_id}
                        >
                          {removingMember === m.member_id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="jogos" className="space-y-4 pt-4">
            <Button onClick={syncFixtures} disabled={syncing} className="w-full" variant="outline">
              {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Sincronizar jogos (API-Football)
            </Button>
            <Button onClick={syncResults} disabled={syncingResults} className="w-full" variant="secondary">
              {syncingResults ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Sincronizar Resultados (Teste)
            </Button>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Adicionar Jogo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Mandante</Label>
                    <Input
                      placeholder="Brasil"
                      value={matchForm.home_team}
                      onChange={(e) => setMatchForm({ ...matchForm, home_team: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Visitante</Label>
                    <Input
                      placeholder="Argentina"
                      value={matchForm.away_team}
                      onChange={(e) => setMatchForm({ ...matchForm, away_team: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Data e hora</Label>
                  <Input
                    type="datetime-local"
                    value={matchForm.match_date}
                    onChange={(e) => setMatchForm({ ...matchForm, match_date: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Estádio</Label>
                    <Input
                      placeholder="MetLife Stadium"
                      value={matchForm.stadium}
                      onChange={(e) => setMatchForm({ ...matchForm, stadium: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Cidade</Label>
                    <Input
                      placeholder="Nova York"
                      value={matchForm.city}
                      onChange={(e) => setMatchForm({ ...matchForm, city: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Fase</Label>
                    <Select
                      value={matchForm.stage}
                      onValueChange={(v) => setMatchForm({ ...matchForm, stage: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {stageOptions.map((s) => (
                          <SelectItem key={s} value={s}>
                            {stageLabels[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Grupo</Label>
                    <Input
                      placeholder="A"
                      value={matchForm.group_name}
                      onChange={(e) => setMatchForm({ ...matchForm, group_name: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Rodada (Brasileirão)</Label>
                  <Input
                    placeholder="Ex: Rodada 11"
                    value={matchForm.round_name}
                    onChange={(e) => setMatchForm({ ...matchForm, round_name: e.target.value })}
                  />
                </div>
                <Button onClick={createMatch} disabled={creatingMatch}>
                  {creatingMatch ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Adicionar
                </Button>
              </CardContent>
            </Card>

            {/* Round bonus section */}
            {availableRounds.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Pergunta bônus por rodada</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground font-medium">Definir pergunta</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Rodada</Label>
                        <Select value={bonusRound} onValueChange={(v) => {
                          setBonusRound(v);
                          const roundMatch = matches.find(m => m.round_name === v && m.bonus_question);
                          setBonusRoundQuestion(roundMatch?.bonus_question || "Nenhuma");
                        }}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecionar" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableRounds.map(r => (
                              <SelectItem key={r} value={r}>{r}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Pergunta</Label>
                        <Select value={bonusRoundQuestion} onValueChange={setBonusRoundQuestion}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {bonusQuestionOptions.map(q => (
                              <SelectItem key={q} value={q}>{q}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button size="sm" onClick={saveRoundBonus} disabled={savingBonusRound || !bonusRound}>
                      {savingBonusRound ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Salvar pergunta da rodada
                    </Button>
                  </div>

                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Resultados Tab */}
          <TabsContent value="resultados" className="space-y-3 pt-4">
            <ResultsTab matches={matches} onSave={updateMatchResult} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

const ResultsTab = ({
  matches,
  onSave,
}: {
  matches: Match[];
  onSave: (id: string, home: number, away: number, bonusResult?: boolean | null) => Promise<void>;
}) => {
  // Fase de grupos: agrupar por round_name (1ª, 2ª, 3ª Rodada)
  const groupMatches = matches.filter((m) => m.stage === "group");
  const byRound: Record<string, Match[]> = {};
  groupMatches.forEach((m) => {
    const round = m.round_name || "Sem rodada";
    if (!byRound[round]) byRound[round] = [];
    byRound[round].push(m);
  });
  const roundOrder = ["1ª Rodada", "2ª Rodada", "3ª Rodada"];
  const sortedRounds = Object.keys(byRound).sort((a, b) => {
    const ia = roundOrder.indexOf(a);
    const ib = roundOrder.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  // Mata-mata: agrupar por stage
  const knockoutStages: Match["stage"][] = [
    "round_of_32",
    "round_of_16",
    "quarter_final",
    "semi_final",
    "third_place",
    "final",
  ];
  const byStage: Partial<Record<Match["stage"], Match[]>> = {};
  knockoutStages.forEach((s) => {
    const list = matches.filter((m) => m.stage === s);
    if (list.length) byStage[s] = list;
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold mb-2">Fase de Grupos</h2>
        <div className="space-y-4">
          {sortedRounds.map((round) => (
            <div key={round} className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">{round}</h3>
              {byRound[round].map((match) => (
                <MatchResultEditor key={match.id} match={match} onSave={onSave} />
              ))}
            </div>
          ))}
        </div>
      </div>

      {knockoutStages.some((s) => byStage[s]?.length) && (
        <div>
          <h2 className="text-base font-semibold mb-2">Mata-mata</h2>
          <div className="space-y-4">
            {knockoutStages.map((s) =>
              byStage[s]?.length ? (
                <div key={s} className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">{stageLabels[s]}</h3>
                  {byStage[s]!.map((match) => (
                    <MatchResultEditor key={match.id} match={match} onSave={onSave} />
                  ))}
                </div>
              ) : null
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const MatchResultEditor = ({
  match,
  onSave,
}: {
  match: Match;
  onSave: (id: string, home: number, away: number, bonusResult?: boolean | null) => Promise<void>;
}) => {
  const [homeScore, setHomeScore] = useState(match.home_score?.toString() || "");
  const [awayScore, setAwayScore] = useState(match.away_score?.toString() || "");
  const [saving, setSaving] = useState(false);
  const bonusQ = (match as any).bonus_question as string | null;
  const [bonusResult, setBonusResult] = useState<string>(
    (match as any).bonus_result === true ? "sim" : (match as any).bonus_result === false ? "nao" : ""
  );

  // Sync state when match prop changes (after parent updates)
  useEffect(() => {
    setHomeScore(match.home_score?.toString() || "");
    setAwayScore(match.away_score?.toString() || "");
    setBonusResult(
      (match as any).bonus_result === true ? "sim" : (match as any).bonus_result === false ? "nao" : ""
    );
  }, [match.home_score, match.away_score, (match as any).bonus_result]);

  const handleSave = async () => {
    const h = parseInt(homeScore);
    const a = parseInt(awayScore);
    if (isNaN(h) || isNaN(a)) return;
    setSaving(true);
    const br = bonusResult === "sim" ? true : bonusResult === "nao" ? false : null;
    await onSave(match.id, h, a, br);
    setSaving(false);
  };

  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <p className="text-sm font-medium">
          {match.home_team} vs {match.away_team}
        </p>
        <p className="text-xs text-muted-foreground">
          {new Date(match.match_date).toLocaleDateString("pt-BR")}
          {match.is_finished && " • ✅ Resultado salvo"}
        </p>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min="0"
            placeholder="0"
            value={homeScore}
            onChange={(e) => setHomeScore(e.target.value)}
            className="w-16 text-center"
          />
          <span className="text-sm font-bold">×</span>
          <Input
            type="number"
            min="0"
            placeholder="0"
            value={awayScore}
            onChange={(e) => setAwayScore(e.target.value)}
            className="w-16 text-center"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={saving}
            onClick={handleSave}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          </Button>
        </div>
        {bonusQ && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{bonusQ}</p>
            <Select value={bonusResult} onValueChange={setBonusResult}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Resposta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sim">Sim</SelectItem>
                <SelectItem value="nao">Não</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default Admin;
