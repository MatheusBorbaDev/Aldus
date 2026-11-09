# Log de 06/11/2026 (movido do PROJECT_CONTEXT.md §10, sem edição)

### 06/11/2026 — Redesign Fase 2: navegação e aba Descobrir (Claude)
- IMPLEMENTADO: abas Biblioteca · Descobrir · Estudo · Conta (ícone cheio na aba ativa; sidebar Web com fundo `accentSoft`; rotas mantidas:
  `search` = Descobrir). `app/(tabs)/search.tsx` refeito com `src/ui`: busca + chips; sem busca ativa mostra **Suas fontes** (lista da conta,
  "Adicionar fonte" primário → `/sources?add=1`, "Gerenciar fontes") e **Bibliotecas digitais** (BibliON, MEC Livros). Lógica de busca/aquisição intacta.
- CORRIGIDO: chips de filtro da busca listavam fontes ativas de **outras contas** do mesmo aparelho; agora filtram por conta (relacionado ao BUG 12).
- VALIDADO: typecheck; `test:critical` 89/89 (nova `discover-ui`); `export:web`; `test:source-library:browser` (Chromium, 320–1440); diff-check.
  NÃO TESTADO: Android. Nota: um teste que entregava instância React ao `assert` esgotou a memória ao falhar — use booleanos (ver `test-discover-ui.cjs`).
