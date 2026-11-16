# Log de 11/11/2026 (movido do PROJECT_CONTEXT.md §10, sem edição)

### 11/11/2026 — Plano de mercado, FASE 2: sessão de leitura medida e "Ler em foco" (Claude)
- `6da731d` `readingSession.ts`: só tempo ativo, ou seja, primeiro plano e no máximo **3 min** (escolha do usuário) após o último sinal (abrir,
  virar página, voltar ao app); parado além disso ou em segundo plano não conta; nada estimado nem retroativo. `ReadingSessionStore`: só neste
  aparelho, por conta (`@aldus/reading-sessions.v1:<user>`), atualiza por id, descarta <10 s ativos, limite 2000, histórico ilegível preservado.
  Não sincroniza. Sem streak/ranking/comparação.
- `21a001b` `useReadingSession` no Reader (página exibida em EPUB/PDF Original/Leitura Livre + `AppState`; grava ao ir para segundo plano e ao
  fechar o livro; sem conta mede mas não grava; troca de conta no meio não grava). Conforto: "Ler em foco por" 10/15/25/45 min (meta em tempo
  ativo), "Encerrar foco", resumo só com minutos medidos e desligável ("Mostrar resumo ao terminar o foco"); minutos restantes seguem "Ocultar
  porcentagem e páginas". **Só Android**: "Abrir Não perturbe do Android" (`ZEN_MODE_PRIORITY_SETTINGS` → `ZEN_MODE_SETTINGS` → `SOUND_SETTINGS`,
  sem permissão nova; o app não muda a configuração). Web: mede pela visibilidade, sem o atalho. iOS não avaliado.
- Teste do slider em `test:reader:settings:web`: o toque a 25% caía no limite de arredondamento (16,5) e virou 16 com a barra de rolagem do
  painel mais longo; passou a mirar o valor 17 pela fórmula do slider. Limites: PDF Original rolando dentro da mesma página por >3 min conta
  como inatividade; política de dados (`dataDocument`) ainda não cita as sessões (texto a aprovar). Sessões não aparecem em lugar nenhum
  além do resumo do foco (diário é FASE 3).
