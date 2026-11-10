# Log de 09/11/2026 (movido do PROJECT_CONTEXT.md §10, sem edição)

### 09/11/2026 — Revisão de qualidade: Onda 4, telas de entrada (Claude)
- IMPLEMENTADO D2 (só apresentação; `authService`, sessão, OAuth/PKCE, callback, diagnósticos e regras **intocados**): `AuthForm.tsx` sobre
  `src/ui` com a mesma API — `AuthButton` = `Button` (primário/secundário, largura total), textos em `AppText`, marca com `overline`, título
  `display`; campos sem placeholder repetindo o rótulo e com `hint` opcional; erro com cor de erro + ícone + `alert`/live region (antes cor
  de link); links legais com 44 px (Política tinha 34 px); `AuthDivider` novo. `login.tsx`/`signup.tsx` só trocaram marcação (divisor e dica
  do usuário). Herdam o visual também `callback`, `forgot/reset-password`, `complete-profile` e `app/account/*` (mesmo componente).
- Testes: `scripts/test-auth-ui-web.cjs` (`test:auth:web`) com matriz, estouro horizontal, alvos ≥ 44 px e erros locais como `alert`; mock de
  `test-auth-flows` inclui `AuthDivider`. VALIDADO: ver §3. NÃO TESTADO: Android/Hermes e `fontScale` real, teclado/autofill do sistema,
  login real (nenhum envio ao Supabase); telas de `app/account/*` não capturadas. Sem primeiro uso guiado (fora do escopo da onda).
