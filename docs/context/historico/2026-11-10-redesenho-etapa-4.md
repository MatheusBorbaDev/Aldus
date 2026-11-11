# Log de 10/11/2026 (movido do PROJECT_CONTEXT.md §10, sem edição)

### 10/11/2026 — Redesenho, Etapa 4: Descobrir e Estudo (Claude)
- IMPLEMENTADO Descobrir (`search.tsx`): botão de busca neutro (`tonal`, ícone de lupa) sem texto e principal com texto (antes um primário
  desbotado que parecia quebrado); "Adicionar fonte" discreto (`ghost`). `ChipRow` (`src/ui/Chip.tsx`, vale para Biblioteca/Fontes também):
  esmaecido à direita só quando há chips além da borda e some ao rolar até o fim.
- IMPLEMENTADO Estudo (`study.tsx`): bloco **Para revisar hoje** com a contagem medida (`reviewSummary` em `flashcardSrs.ts`: aprovados,
  completos, vencidos, de decks existentes), "Tudo em dia" quando zero medido, nada antes do snapshot; "Revisar" (primário) abre o deck com
  mais pendências; "Novo deck" só é primário quando não há revisão; cada deck mostra "N para revisar". Rótulos existentes preservados.
- Não feito: menu "+" único no Estudo (mantive "Novo deck"/"Criar flashcard"/"Mais ferramentas" visíveis; o ganho era pequeno e mudava
  rótulos usados por testes). VALIDADO: ver §3. NÃO TESTADO: Android; bloco de revisão com dados reais no navegador.
