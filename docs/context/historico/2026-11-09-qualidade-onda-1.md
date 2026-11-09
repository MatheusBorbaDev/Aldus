# Log de 09/11/2026 (movido do PROJECT_CONTEXT.md §10, sem edição)

### 09/11/2026 — Revisão de qualidade: Onda 1, ajustes de leitura (Claude)
- IMPLEMENTADO (só painel e tokens; motor, documento, âncoras e posições intocados): BUG 15 — entrelinha/parágrafo com "Médio" = padrão do modo
  (EPUB 1,65; PDF Reflow 1,6; parágrafo 1), Pequeno/Grande ±0,25/±0,5; valor salvo fora da lista não é reescrito nem marcado
  (`spacingOptions`, `DEFAULT_READER_*`). BUG 16 — `readerThemes` com `onAccent`; Claro/Sépia/Papel com `accent` mais escuro e Sépia com
  `secondaryText` mais escuro; texto selecionado (segmentos, modos, categorias) usa `onAccent` (antes branco fixo, 2,28:1 no Escuro).
  C5 — opções/segmentos/capítulos ≥ 44 px, campos de página/busca 44 px, rótulos "Diminuir/Aumentar zoom", `accessibilityState` nos modos.
- Testes: `test-app-design` cobre os 5 temas do livro (4,5:1); `test-reader-settings-categories` cobre padrões, valor legado, 44 px, `onAccent`
  e rótulos; fixture Web do painel usa os temas reais (Papel/Escuro). VALIDADO: ver §3. NÃO TESTADO: Android; aparência dentro do documento.
