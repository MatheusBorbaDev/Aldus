# Log de 09/11/2026 (movido do PROJECT_CONTEXT.md §10, sem edição)

### 09/11/2026 — Dependências: patches do SDK 57 (Claude)
- IMPLEMENTADO por decisão do usuário (opção 1 do BUG 13): `npx expo install --fix` alinhou 9 pacotes do Expo ao patch esperado do SDK 57;
  `package.json` só com essas faixas; lockfile só com a família Expo (+ `react-native-gesture-handler` 3.5.0). Audit de produção 6→3 altos.
  `THIRD_PARTY_NOTICES.md`/`thirdPartyNotices.generated.ts` regenerados (só versões).
- `test-marketing-web`: base `prefers-reduced-motion: no-preference` emulada (este Windows reporta `reduce` e a cena 3D não iniciava; o caminho
  `reduce` continua testado) e rota autenticada verificada por `/library` + busca da Biblioteca (o texto "Sua Biblioteca" saiu da tela em `02bb6f4`).
- VALIDADO: ver §3. Depois, por pedido do usuário, APK de ensaio `6883532` compilado e conferido (pacote/versão/assinatura/ABIs/bundle; §3),
  sem instalar. NÃO TESTADO: execução no Android/Hermes com os módulos nativos novos (exige instalar no Redmi), `test:legal:browser`.
