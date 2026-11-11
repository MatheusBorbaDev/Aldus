# Log de 11/11/2026 (movido do PROJECT_CONTEXT.md §10, sem edição)

### 11/11/2026 — Melhorias, Onda A: estudo, estante, tema automático, histórico e primeiros passos (Claude)
- Pedido do usuário: executar todas as melhorias propostas (ondas A–D). Dependem dele: livros do acervo que saem, conta Play Console/Firebase,
  validação no Redmi e download da Literata. Onda A concluída (sem dependência nova, sem mexer no motor):
- A1 `StudyHighlightsPanel`: "Criar flashcard deste grifo" logo após salvar; confirmação; duplicado explicado (antes `return` silencioso);
  deck com título legível. A2 `readingShelves.ts`: "Continue lendo" com até 3 leituras (barra de progresso) e chip "Parados há 30 dias" só com
  atividade medida; sem "Concluídos este ano" (não há data de conclusão gravada). A3 `readerThemeAuto.ts` + `ReaderSettingsContext`:
  "Automático" (desligado por padrão; salvo como `followAppTheme`) mostra tema escuro com o app escuro, preservando o tema escolhido; vale
  para EPUB e PDF; escolher um tema desliga. A4 `reviewHistory.ts`: revisões e acertos por semana (4 janelas de 7 dias) e mais errados, só de
  `reviews` gravados (sessões antigas são substituídas por deck; eventos ficam). A5 `FirstStepsCard`: 3 passos no topo da Biblioteca, não
  bloqueante, uma vez por aparelho (`@kindle/first-steps-seen.v1`).
- `test-library-bulk-web`: falhava 3/4 também no código anterior (foco devolvido pelo menu ao fechar); agora espera o menu fechar e confere o
  foco antes da tecla espaço. VALIDADO: ver §3. NÃO TESTADO: Android.
