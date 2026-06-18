# Ver palpites dos outros após o fechamento

## Temos tudo que precisa?
Sim. A RLS de `predictions` já permite que qualquer membro do bolão leia os palpites de todos os outros membros (`bolao_id IN get_user_bolao_ids()`). E `matches.match_date` é a referência usada hoje para travar edição — vamos usar o mesmo critério para liberar a visualização.

## Comportamento
- Em cada card de jogo (componente `MatchCard` dentro de `BolaoDetail.tsx`), adicionar um botão **"Ver palpites do grupo"**.
- Botão fica **desabilitado/oculto antes do horário do jogo** (`match.match_date > now()`), com tooltip "Disponível após o início do jogo". Depois do kickoff aparece habilitado para qualquer membro.
- Ao clicar, abre um `Dialog` listando todos os membros do bolão com:
  - Avatar + username
  - Palpite: `home × away`
  - Goleador escolhido (se houver)
  - Se o jogo já estiver finalizado: pontos da partida + badge ✅ placar exato / 🎯 resultado+saldo / etc.
  - Membros que não palpitaram aparecem com "— sem palpite —" no final da lista.
- Ordenação: quem palpitou primeiro (created_at asc); finalizados ordenados por pontos desc.

## Detalhes técnicos
- Novo componente `src/components/MatchPredictionsDialog.tsx`:
  - Props: `matchId`, `bolaoId`, `match` (para saber se finalizado e mostrar pontos).
  - Carrega no `onOpen`: 
    1. `bolao_members` do bolão → lista de `user_id`s.
    2. `profiles` (username, avatar_url) desses users.
    3. `predictions` desse `match_id` + `bolao_id`.
  - Junta tudo no client e renderiza.
- Em `MatchCard`:
  - Calcular `kickoffPassed = new Date(match.match_date) <= new Date()`.
  - Renderizar o botão sempre, mas `disabled` quando `!kickoffPassed`.
  - Botão estilo `variant="outline" size="sm"` abaixo do bloco de palpite/resultado, alinhado à direita.
- Sem mudanças de schema, sem migration, sem edge function. Reaproveita RLS existente.

## Privacidade
Hoje a RLS já expõe palpites entre membros — a mudança é só de UI. Se quiser manter "sigilo até o kickoff", o gating é client-side (boa UX), mas qualquer membro tecnicamente já consegue ler via API. Se for um requisito forte de sigilo, posso adicionar depois uma política/edge function que bloqueia leitura de palpites de outros enquanto `match_date > now()`. Me avisa se quer esse reforço junto.
