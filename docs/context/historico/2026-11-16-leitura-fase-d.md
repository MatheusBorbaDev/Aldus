# Log antigo (rolado do PROJECT_CONTEXT em 18/11/2026)

### 16/11/2026 — Leitura e compartilhamento, Fase D: virar página (Claude)
- Pedido do dono: animação de troca de página "com a página passando, igual o Kindle". `de31a33`: Ajustes de leitura → Página → "Virar
  página" (Sem animação · Deslizar, o de sempre e padrão · Folhear), EPUB e Leitura Livre. "Folhear" gira a página visível em 3D pela lombada
  (dobra, troca de lado, abre); decisão técnica: sem cópia da página, porque os capítulos dividem as mesmas colunas e copiar "só a página"
  exigiria copiar o livro a cada virada. A página só é confirmada no fim; toques rápidos agora acumulam (3 toques = 3 páginas) em todos os
  modos; reduzir movimento do sistema (Android e `prefers-reduced-motion`) força "Sem animação" sem mudar a escolha.
- Achado do caminho: o Windows deste PC está com animações desligadas e o Chrome reporta `reduce`; o teste de navegador agora emula as duas
  preferências. Também corrigidas duas regressões de TESTE das fases anteriores: a fixture de `test:reader:settings:web` devolvia `{}` para os
  módulos novos (painel quebrava ali desde a Fase A) e a seleção da Fase B falhava no `test:reader:reflow:web` (página sem palavra: SKIP explícito).
- VALIDADO (local): typecheck; `test:critical` 129/129 (nova `page-turn`); `test:reader:{browser,epub,reflow,settings,study,markings,pdf,concentration}`
  PASS; `export:web`; lista de entrega com 33 recursos. Quadros reais do "Folhear" capturados no Chrome.
- NÃO TESTADO: fluidez no Redmi (o "Folhear" usa 3D da WebView), arrastar a folha com o dedo (fora do escopo), PDF Original (troca como antes).
