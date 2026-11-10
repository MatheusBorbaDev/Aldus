# Log de 09/11/2026 (movido do PROJECT_CONTEXT.md §10, sem edição)

### 09/11/2026 — Revisão de qualidade: Onda 3, tela de uma Fonte/Drive (Claude)
- IMPLEMENTADO D1 (`SourceLibraryScreen.tsx` sobre `src/ui`; dados, Sync, cancelamento, pastas e importação inalterados): uma linha de
  ações alinhadas (voltar · Atualizar/Reconectar · ⋯, alvos de 44 px); título único (nome da fonte na raiz, nome da pasta dentro dela) e
  caminho só com as pastas acima; **um** aviso de estado (carregando com cancelar · reconectar · falha sem catálogo com "Tentar novamente" ·
  falha com catálogo · sem conexão) no lugar de até três mensagens empilhadas; lista vazia não repete o aviso; busca e ordenação só com
  catálogo; ordenação em `Chip`, lista/grade em `IconButton`, menu ⋯ em `ActionMenu`; pastas em cartões do tema. Data legível
  (`sourceUpdatedLabel`: "Atualizada hoje às 09:05"/"ontem"/"3 de nov."; sem Intl), também na lista de bibliotecas (`SourceSummaryRow`).
  Rota `/sources/[id]`: carregamento com fundo do tema e estados "não encontrada"/"somente pesquisa" em `EmptyState`.
- Mudança de comportamento visível: reabrir uma fonte com catálogo salvo (status `stale` sem erro) não mostra mais "Exibindo a última
  atualização disponível"; a data de atualização cumpre esse papel. `SourceCatalogService` só passou a exportar as duas mensagens genéricas.
- Testes: `test-source-presentation` (data: hoje/ontem/ano/futuro/ausente → null); `test-source-library-browser` com matriz visual e asserções de
  alinhamento (centros iguais, 44 px), nome uma vez, caminho só com pais, 1 alerta no erro, data legível; rótulos novos ("Exibir em lista",
  "Voltar para …"). VALIDADO: ver §3. NÃO TESTADO: Android/Hermes e `fontScale` real; Drive real. Captura `remove-confirmation` pega o
  menu ainda saindo por animação sobre o diálogo (o teste confirma e remove normalmente).
