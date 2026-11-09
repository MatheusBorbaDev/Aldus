# Log de 06/11/2026 (movido do PROJECT_CONTEXT.md §10, sem edição)

### 06/11/2026 — Redesign Fase 4: Conta e Estudo; estilos estáticos (Claude)
- IMPLEMENTADO: `SettingsLayout`/`SettingsGroup`/`SettingsLink` reescritos sobre `src/ui` (mesma API → todas as subtelas de ajustes, legal,
  suporte e Admin herdam o visual). Aba **Conta** com cartão de perfil (iniciais), grupos com descrições curtas. **Estudo**: "Novo deck" primário,
  "Mais ferramentas" como lista (Gerar do livro *sem IA*, Batalha), decks em `ListGroup`, estado vazio. `overline` sem caixa alta forçada.
- CORRIGIDO (risco Android): primitivos, `BookCard` e cartões da Biblioteca usavam estilo-função em `Pressable`, padrão que com NativeWind
  empilhou conteúdo no Redmi; agora estáticos + `android_ripple`, com trava em `test-ui-primitives`.
- Teste: loader compartilhado resolve pasta→`index.ts`; `test-settings-navigation`, `test-admin-web`, `redmi-qa` seguem os novos títulos.
  VALIDADO: ver §3. NÃO TESTADO: Android.
