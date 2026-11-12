# Log de 11/11/2026 (movido do PROJECT_CONTEXT.md §10, sem edição)

### 11/11/2026 — Melhorias, Onda D: base técnica (Claude)
- D1 `pdfjsRuntime.web.ts`: pdf.js por `import()` no visualizador, no Reflow e nas capas (worker/documento iguais); bundle principal −535 KiB,
  pdf.js vira chunk de 536 KiB baixado só ao abrir PDF; trava em `test-pdfjs-lazy`. Erro de procedimento: o commit `fca5591` saiu com
  `cover-thumbnails` falhando (o `grep` da verificação retornou sucesso); corrigido em `c8a5265` e a verificação passou a exigir "N/N".
  Capa de PDF na Web sem suíte de navegador. Observação: `PdfPageViewer.web` usa cMaps do CDN na versão 3.11.174 (pacote 6.3.289); não alterado.
- D2 (BUG 13, opção 2): a hipótese de que o Metro usava `js-polyfills` 0.76.9 estava errada (usa a 0.86.3 do `react-native`); `metro-cache`
  0.81.5 não era usado. Removidos (−4 pacotes, nenhum novo). `fast-xml-parser` 5.11→5.12 (dentro de `^5.11.0`; aviso de CPU em EPUB malformado).
- D3 Maestro **não adotado**: duplicaria `scripts/redmi-qa.cjs` (adb/UI Automator, sem instalar/limpar/trocar conta), exigiria baixar ferramenta
  externa e rodaria contra a conta pessoal do Redmi (regra: testes não usam sessão/biblioteca pessoal). `redmi-qa.cjs` atualizado: título do
  painel "Ajustes de leitura" e adb lido de `android/local.properties`. Precisa de rodada com aparelho e conta de teste.
