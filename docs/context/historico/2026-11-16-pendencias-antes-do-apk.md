# Log — Pendências antes do APK: OCR, FASE 3 e Clubes/Fóruns (16/11/2026)

Entrada movida sem edição do §10 do PROJECT_CONTEXT em 16/11/2026.

### 16/11/2026 — Pendências antes do APK: OCR, FASE 3 e Clubes/Fóruns (Claude)
- Pedido: "antes de compilar, verifique se possuem outras pendências de implementação"; à lista, o dono respondeu "Todos, inclusive o G do
  clubes e fóruns". BUG 12 (fontes por conta) já estava resolvido no código desde `10d6d24` (`ownerId`, adoção explícita); só o registro estava velho.
- `98a8ead` botão e painel de OCR do Reflow seguem o tema (contraste AA). `54b1849` fixar trechos (`highlights.pinned`, schema SQLite v6, Sync
  envia o campo; ausente = não fixado). `2a3d8fd` "Todas as anotações" (menu ⋯ da Biblioteca; tocar abre o livro, sem navegar à âncora).
  `68d4f09` Diário de leitura (só sessões medidas, números ocultáveis, sem dias seguidos) e CSV no padrão Goodreads (só campos com dado real).
  `da43e57` cartão de foco: compartilha **texto** (imagem exigiria dependência nova, não adicionada).
- `ff25abc` migration `20261116120000_community_clubs_forums.sql` (aplicada em 16/11, ver abaixo): clubes por convite com marcos, comentários
  ancorados em marco e visíveis só até o marco de cada um, fóruns com aviso de spoiler, denúncias de conteúdo, limites contra abuso, tudo por RPC.
  `3cd2d9a` telas Clubes, Clube, Fóruns e Tópico; denúncia abre sem motivo escolhido; aviso de DRM. Sem contagens de membros ou curtidas.
- VALIDADO (local): typecheck; `test:critical` 124/124 (novas `pinned-highlights`, `all-annotations`, `reading-diary`, `focus-card`,
  `community-clubs-schema` em PGlite, `community-clubs`); `verify-release-features --source` e `--dist` com 28 recursos; `export:web`; diff-check.
- NÃO TESTADO: sessões autenticadas reais, Android, navegador para as telas novas.
- **Aplicação remota (16/11, autorizada: "Sim, aplicar")**: projeto "Kindle reader", editor SQL do painel no Chrome do usuário. Inventário somente
  leitura antes: PG 17.6, 8 tabelas e 18 funções `community*` (estado de 12/11), nenhum objeto de clubes/fóruns. O arquivo entrou pela área de
  transferência e foi conferido na página por SHA-256 (`115bd504…bcd0f9`, idêntico ao repositório; o editor só usa CRLF). Erro do caminho: o
  `clip.exe` com UTF-8 trocou os acentos (hash diferente, nada executado); refeito em UTF-16 e removido o BOM antes da conferência. O painel
  avisou de operação destrutiva (só os `delete` dentro das funções novas e `on delete cascade`); confirmado; "Success". Depois: 6 tabelas com
  RLS, 0 políticas e 0 grants a clientes, 41 funções (23 novas), as internas sem execução por `authenticated`, só `community_can_view` para
  anon, 0 linhas. Sonda REST anônima: as 6 tabelas, `POST` direto e 4 RPCs → 401. Não registrada no ledger; nenhum dado existente alterado.
