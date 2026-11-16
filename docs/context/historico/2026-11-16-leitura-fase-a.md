# Log — Leitura e compartilhamento, Fase A: paletas e textura de papel (16/11/2026)

Entrada movida sem edição do §10 do PROJECT_CONTEXT em 16/11/2026.

### 16/11/2026 — Leitura e compartilhamento, Fase A: paletas e textura de papel (Claude)
- Pedidos do dono (16/11), recebidos em várias mensagens e planejados antes de produzir: tema Clássico × Moderno, textura nas páginas,
  animação de virar página, rolagem contínua, grifo que não abre o pop-up e card de trecho para Stories/X. Plano A→E aprovado ("Aprovar e
  iniciar"); depois da prévia o dono pediu **duas** Moderno: Petróleo e Azul-tinta. Plano completo: `docs/context/design-system.md` §Paletas.
- `f0215f7` paletas (Clássico = `appThemeTokens` sem mudança), escolha guardada no aparelho em `@aldus/app-palette.v1` (só por ato explícito;
  leitura ruim mantém Clássico sem regravar); controles do Reader levam o destaque da paleta só se mantiver 4,5:1 sobre o livro.
  `fcde063` cores fixas trocadas por tokens (Descobrir, BibliON/MEC, leitor web, Admin; feedback de flashcard nunca detectava o escuro).
  `986f099` grupo "Paleta" em Conta → Tema do aplicativo. `1aca293` "Textura do papel" (Sem textura · Papel · Papel envelhecido) em
  Ajustes de leitura → Página: grão SVG próprio em `data:`, mensagem `updateSurface` que só pinta o fundo (sem relayout, sem mover página).
- VALIDADO (local): typecheck; `test:critical` 125/125 (nova `paper-texture`); `test:reader:browser` com textura no documento real (nenhuma
  mensagem de página, mesma âncora, URL externa recusada, sem violação de CSP); `export:web`; lista de entrega `--source`/`--dist` com 30
  recursos. Tela de paleta medida em fixture react-native-web: 320/390 px × texto 1/1,3/1,6 × 3 paletas × claro/escuro, sem estouro.
- Limites: painel do OCR (véu escuro fixo), spinners do PDF e da abertura continuam com o Clássico; PDF Original sem textura.
  NÃO TESTADO: Android, TalkBack, aparência da textura em tela física. Próximas fases (B grifo, C card, D animação, E rolagem) aguardam.
