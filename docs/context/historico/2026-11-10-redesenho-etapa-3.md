# Log de 10/11/2026 (movido do PROJECT_CONTEXT.md §10, sem edição)

### 10/11/2026 — Redesenho, Etapa 3: menu do livro na Biblioteca (Claude)
- IMPLEMENTADO (`BookCloudControls` em `LibrarySyncControls.tsx`; lógica de remoção/Sync inalterada): o cartão passa a ter **uma** linha
  "situação · disponibilidade" + "⋯" (antes duas linhas e um botão de etiqueta separado). O menu é uma folha compacta (máx. 480 px) com título de
  exibição e autor · formato · tamanho · disponibilidade; ações **Abrir** e **Organizar**; depois, em cor de perigo, **Remover deste
  dispositivo** e **Remover da minha biblioteca**, cada uma com a consequência escrita (e o motivo quando indisponível: acervo do app, ainda
  não enviado, arquivo ausente); confirmação com "Confirmar remoção" (perigo) e "Cancelar". Rótulos acessíveis antigos preservados.
- Não feito: "Marcar como lido" direto no menu (fica em Organizar, que já grava a situação pelo `LibraryOrganizationStore`); OCR no menu.
- Testes: `test-library-ui` cobre linha única, título de exibição, abrir/organizar, textos das remoções, cancelar sem remover e motivo do
  bloqueio. VALIDADO: ver §3. NÃO TESTADO: Android.
