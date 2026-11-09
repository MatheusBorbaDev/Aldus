# Log de 06/11/2026 (movido do PROJECT_CONTEXT.md §10, sem edição)

### 06/11/2026 — Redesign Fase 3: Biblioteca enxuta com "+" (Claude)
- IMPLEMENTADO: cabeçalho "Biblioteca" com só busca + dois botões: **"+" (Adicionar livros)** abre menu com Importar arquivo, Conectar Google Drive
  (`/sources?add=drive`, abre o fluxo direto), Adicionar biblioteca por link (`/sources?add=link`) e Buscar em catálogos públicos; **"⋯"** reúne
  Selecionar livros, Coleções, Minhas fontes e tema. Situação em chips, formato/ordenação em folhas (`ActionMenu`), "Continue lendo" em cartão,
  "Organizar" virou ícone no card. `BookCard` reestilizado (capa protagonista, formato · progresso). Lógica de organização/seleção/Sync intacta.
- CORRIGIDO no caminho: regex de acentos de `normalizeBookTitle` tinha virado caracteres literais na edição; o Chromium pegou (`SyntaxError`) e foi restaurado.
- VALIDADO: ver §3 (89/89, export, 4 suítes Chromium). Testes atualizados aos novos rótulos/menus: `test-library-bulk-web`, `test-library-web`,
  `test-saas-web`, `redmi-qa` ("Sua Biblioteca" → "Biblioteca"). NÃO TESTADO: Android.
