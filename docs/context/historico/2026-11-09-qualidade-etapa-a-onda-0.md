# Log de 09/11/2026 (movido do PROJECT_CONTEXT.md §10, sem edição)

### 09/11/2026 — Revisão de qualidade: Etapa A (diagnóstico) e Onda 0 (Claude)
- Etapa A (só leitura) sobre `3cc1107`: achados em conforto, UX, desempenho e robustez; bugs 14–20 em BUGS_ATUAIS.md. Ondas 0–5 aprovadas
  pelo usuário, uma por vez com OK entre elas; 6 (tipografia do Reader) e 7 (visual de Estudo/Community/Plano) fora por enquanto.
- IMPLEMENTADO Onda 0: fronteira de erro da raiz (`app/_layout.tsx` `ErrorBoundary` + `src/ui/ErrorScreen.tsx`, BUG 14); estilo estático nos
  4 `Pressable` restantes (BUG 18) com varredura de todo `app/`+`src/` em `test-ui-primitives`; `test-reader-browser` lê `assets/Livros` (BUG 19);
  `test-reflow-native-scheduling` com relógio determinístico (falhava ~40% neste PC por depender da velocidade da CPU; mutação com yield em
  microtask continua falhando o teste).
- VALIDADO: ver §3. Achado novo: BUG 20 (Reflow com página final em branco), não corrigido (motor do Reader fora das ondas). NÃO TESTADO: Android.
