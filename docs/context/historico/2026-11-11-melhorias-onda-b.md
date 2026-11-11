# Log de 11/11/2026 (movido do PROJECT_CONTEXT.md §10, sem edição)

### 11/11/2026 — Melhorias, Onda B: motor do Reader (Claude)
- B1 (sem mudança de comportamento): brilho nativo → `useNativeReaderBrightness` (com teste próprio) e aviso flutuante → `ReaderFeedbackBanner`;
  `ReaderScreen` 1229→1113 linhas. B2 **BUG 20 corrigido**: total de páginas pelo último conteúdo real (`lastContentPage`), não pela margem da
  seção; Reflow 24→23 páginas, EPUB inalterado (121). Um `\S` na template do iframe virou `/S/` e o teste passou por acaso: trocado por `trim()`.
  B3 **BUG 17 corrigido**: `lang` do capítulo (`<html>`/`<body>`, validado, nunca presumido) no documento e em cada seção; "Justificado" para EPUB
  (salvo). B4 tempo restante no capítulo no rodapé (`readingPace.ts`/`useChapterTimeLeft`): mediana de ≥5 viradas medidas (3 s–10 min), EPUB e
  Reflow, oculto com as contagens; sem ritmo medido não há estimativa.
- B5 rolagem contínua **adiada**: o motor é paginado (colunas, âncoras por página, progresso/restauração por página); rolar exige outro sistema
  de posição com as mesmas garantias de âncora e validação em aparelho. Fica como projeto próprio.
