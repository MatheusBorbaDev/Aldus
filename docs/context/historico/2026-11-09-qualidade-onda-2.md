# Log de 09/11/2026 (movido do PROJECT_CONTEXT.md §10, sem edição)

### 09/11/2026 — Revisão de qualidade: Onda 2, Biblioteca e export Web (Claude)
- IMPLEMENTADO P1: `app/(tabs)/library.tsx` com célula memoizada `LibraryBookCell` e callbacks estáveis (`renderBook`, `openBook`,
  `toggleSelection`, `organizeBook`); mesma árvore/estilos/rótulos. Medição `scripts/measure-library-renders.cjs` (fixture Chromium do
  `test:library:bulk:web`, 1000 livros, 72 cartões montados; render = objeto de fiber diferente do commit anterior), 2 execuções cada:
  busca que mantém todos 72→0 renders (~41→~16 ms), abrir "⋯" 72→0 (~42→~19 ms), marcar/desmarcar 1 livro 72→1 (~51→~34 / ~23→~7 ms);
  limpar busca e entrar em seleção 144→72 (montagens legítimas). JSON em `.expo/perf/library-renders-{before,after}-*.json`.
- IMPLEMENTADO P2: `copy-books-to-dist.mjs` deixou de copiar `assets/Livros` para `dist/assets/Livros` (93 MB sem hash, nenhuma referência
  no bundle; o app usa só `dist/assets/assets/Livros/<hash>` do Metro). `dist` 207,6→110,5 MB (−47%), 154→120 arquivos; os 34 livros
  referenciados existem. Mesmos livros publicados. **Conflito previsto** com o branch do acervo, que também edita esse script.
- MEDIDO P3 (sem dividir): `scripts/measure-web-bundle.cjs`; entry 5,54 MiB (1,48 MB gzip): reanimated 733 KiB (só motion cues), pdfjs-dist
  536 KiB **no entry** além do chunk `pdfjs` (imports estáticos em `PdfPageViewer.web`, `PdfReflowProcessor.web`, `PdfThumbnailGenerator.web`),
  expo-router 429, entities 369 + ramda 122 (via `react-native-render-html` em `ChapterRenderer`), src/presentation 319. `.expo/perf/web-bundle-composition.json`.
- VALIDADO: ver §3. NÃO TESTADO: Android/Hermes (medição só no Chromium com fixture sintética).
