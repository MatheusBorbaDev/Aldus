# Aldus Reader — Contexto do Projeto

Única leitura obrigatória por tarefa. Detalhes por área: `docs/context/` (só a seção que o mapa §6 indicar).
Histórico: `docs/context/historico/`. Requisitos/hipóteses de outras IAs: `docs/context/referencias/`.
Bugs ativos: [BUGS_ATUAIS.md](BUGS_ATUAIS.md). Regras de IA e limites: [AGENTS.md](AGENTS.md).
Reescrito em 06/11/2026 a partir do código (main `f61a0c8`), não só do texto do Codex.

**Ordem de confiança:** código/config/migrations/testes > este arquivo > `docs/context/*` e BUGS_ATUAIS.md >
`docs/context/referencias/` (handoffs do ChatGPT, snapshots de 02–20/10 e prompts: hipótese/requisito, nunca prova).

## 1. Protocolo de cada tarefa

1. `git status --short`, `git branch --show-current`, `git rev-parse HEAD`. Há untracked de terceiros (§3): preserve-os e
   faça stage só dos caminhos que você editou (`git add <caminho>`; nunca `-A`/`.`).
2. Leia este arquivo; abra no máximo os módulos que o mapa (§6) indicar, por seção. Use `rg -n` por símbolo antes de abrir
   arquivos grandes (`ReaderScreen.tsx` 1191 linhas, `EpubReaderDocument.ts` 755, `library.tsx` 658).
3. Edite o mínimo. Valide (§7): `npm run typecheck`, as suítes da área e, em mudança funcional, `npm run test:critical`,
   `npm run export:web`, `git diff --check`. Nunca declare PASS sem ter executado; diga o que não foi executado.
4. **Fechamento** (no mesmo commit local do código, só se o usuário pediu commit): atualizar **§3 Estado atual**, **§8 Pendências**
   e uma nova entrada no topo de **§10 Log** (máx. 5 entradas; mova as mais antigas, sem editar, para
   `docs/context/historico/AAAA-MM-DD-<tema>.md`). Mudou o estado de um recurso → corrija a matriz §5. Bug novo/resolvido →
   BUGS_ATUAIS.md. Decisão permanente de uma área → módulo em `docs/context/`.
5. Resposta ao usuário em pt-BR, curta: o que mudou, onde, validação (comando e resultado reais), próximo passo. Use
   IMPLEMENTADO / VALIDADO / PARCIAL / PENDENTE / NÃO TESTADO / INCONCLUSIVO / BLOQUEADO.

Não criar outros arquivos de contexto/handoff/checkpoint. `node scripts/validate-ai-instructions.cjs` ao editar
AGENTS.md/skills. `scripts/test-legal.cjs` exige que este arquivo mantenha o tratamento técnico de Batalha + Supabase (§4).

## 2. Produto e stack (conferido em package.json/app.json)

Leitor EPUB/PDF e estudo, Android + Web, pt-BR (antigo Kindle Reader). `aldus-reader` 1.0.0-beta.2, Android
`com.aldus.reader` versionCode 3 (handoffs antigos dizem `com.kindle.reader`: obsoleto), scheme `aldus`. Expo ~57.0.25,
React Native 0.86.3, React 19.2.3, expo-router (typedRoutes), Zustand 5, expo-sqlite, WebView 13, pdfjs-dist 6, jszip,
three (landing); nativewind/tailwind instalados mas a UI real usa StyleSheet + `src/theme`. TypeScript ~6.0.3, Node 24.
Backend: Supabase (Auth, Postgres/RLS, Storage, Edge Function `username-login`). Web via Vercel; Android via Gradle local
(`android/` versionado) ou EAS. iOS não é alvo. Remoto Git: `origin` = `github.com/matheusbitlab/Aldus` (branch oficial `main`).

Persistência (legado mantido, não renomear `kindle-*`/`@kindle/*`): Native SQLite `kindle-reader.db` (migrations v1–v5 em
`src/data/database/migrations/MigrationRunner.ts`) + AsyncStorage + arquivos; Web IndexedDB `kindle-reader-web` v6
(`webLibraryStore.ts`). Flashcards: `@kindle/flashcards.v1:<UUID>` / `kindle-flashcards.db` / IndexedDB `kindle-flashcards`.

## 3. Estado atual (verificado em 06/11/2026)

- Git: `main`, HEAD de referência `f61a0c8` (o commit deste registro vem depois). Untracked de terceiros, **não commitar**:
  `DesignIdeas/` e `DesignIdeas.zip` (referência visual) e `aldus-context.zip` (pacote de contexto externo; seu conteúdo útil — os
  dois handoffs do ChatGPT — foi copiado para `docs/context/referencias/`). Arquivos na raiz ignorados: `Livros/`, `debug-reflow-*`,
  `artifacts/`, `dist/`, `.expo/`.
- **Troca de computador (09/11)**: `main` e o branch `claude/acervo-dominio-publico-ae9294` enviados ao `origin` por decisão do usuário (sem
  force). Ficam fora do Git e devem ser levados por meio privado: `.env.local`, chaves `ALDUS_SIGNING_*` (se usadas) e, opcionalmente,
  `Livros/`, `artifacts/apk/` (inclui `Aldus-ae98991-device-rehearsal.apk`), `DesignIdeas*`, `aldus-context.zip`. Passo a passo: README → "Trocar de computador".
  No PC novo é preciso autorizar a depuração USB do Redmi de novo.
- Redesign de UI em andamento (decisões e fases em `docs/context/design-system.md`): Fases 1 (fundação `src/ui`), 2 (abas Biblioteca ·
  Descobrir · Estudo · Conta; tela Descobrir com fontes) 3 (Biblioteca com "+"), 4 (Conta e Estudo) e 5 (moldura do Reader, só visual) concluídas.
  Acervo: etapas 1–3 na `main` em 11/11 (`51f69f0`, `44cf826`, `809cfac`); o branch `claude/acervo-dominio-publico-ae9294` ficou histórico.
- **APK de ensaio do HEAD `ae98991` (09/11)**: `artifacts/apk/Aldus-ae98991-device-rehearsal.apk` (ignorado pelo Git; cópia de
  `android/app/build/outputs/apk/release/app-release.apk`), 346.643.174 bytes, SHA-256 `5fcbd88e…df5e71`. `com.aldus.reader` 1.0.0-beta.2/code 3,
  sem debuggable, ABIs arm64-v8a/armeabi-v7a/x86/x86_64, assinatura v2 com certificado `fac61745…033b9c` (debug/`device-rehearsal`, o mesmo
  da instalação do Redmi registrada no histórico) — **não é o Beta privado**. Bundle Hermes contém os textos do redesign. Gradle 26 min, sem
  reuso. `build:apk:archive` recusou (exige chave privada).
  **Instalado no Redmi 23117RA68G (Android 16) em 09/11** após conferir instalação anterior (code 3, mesmo certificado `fac617…`): `adb -s … install -r`
  → Success; `firstInstallTime` 2026-10-11 21:38:27 preservado; hash do `base.apk` instalado = `5fcbd88e…`. Abertura: carregamento → tela de
  **login** (sem crash/FATAL no logcat). Telas pós-login (Biblioteca/Descobrir/Conta/Estudo/Reader) NÃO exercitadas: exigem a senha do usuário.
  Não se verificou se a sessão estava ativa antes da atualização. Nenhuma configuração do aparelho foi alterada.
  **PASS físico (09/11, após o usuário entrar):** Reader EPUB (livro pessoal) 11/189 → 10 toques centrais + 1 → controles alternam e página/trecho
  iguais; moldura nova OK; Biblioteca "40 livros", linhas lado a lado (sem empilhamento), menus "+" e "⋯" em folha; Descobrir com 3 fontes Drive
  e BibliON/MEC; Estudo e Conta OK; sem FATAL no logcat. Achados: rótulos da barra quebravam (corrigido depois do APK, em `library.tsx`), nome
  "Leitor"/inicial "A" sem `display_name` (corrigido: usa o username), **"Continue lendo" nunca aparece** (BUGS_ATUAIS.md; pré-existente).
  Essas correções — e a do "Continue lendo" (commit seguinte) — NÃO estão no APK instalado.
- **Este PC (09/11):** `main` atualizado por fast-forward até `3cc1107`; `npm ci`/`setup:test-tools`; Android SDK por `android/local.properties`
  (ignorado; sem `ANDROID_HOME`), JDK 17. Sem `Livros/` pessoal (as suítes usam `assets/Livros`). APK/Redmi não exercitados neste PC.
- **Revisão de qualidade — Onda 0 (09/11, sobre `3cc1107`)**: typecheck PASS; `test:critical` **91/91** (nova `error-boundary`); `export:web`
  PASS (build `3cc110708f88`, dirty=true); diff-check PASS. Chromium: `test:reader:{browser,epub:web,study:web,pdf:web,settings:web,
  concentration:web,markings:web}` PASS; **`test:reader:reflow:web` FAIL** (BUG 20, determinístico); `test:saas:web`, `test:admin:web` PASS.
- **Onda 1 (09/11, sobre `290cfee`)**: typecheck PASS; `test:critical` 91/91; `export:web` PASS (build `290cfee58878`, dirty=true); diff-check
  PASS. Chromium: os mesmos 7 `test:reader:*:web` PASS e `reflow:web` FAIL só pelo BUG 20 (mesmos valores da Onda 0). Capturas do painel com
  temas reais em `.expo/research-cycle1-increment2/categories-{320,390,430,768,1440}-{light,dark}-{1,1.3,1.6}-*.png` (128).
- **Onda 2 (09/11, sobre `62aeba7`)**: typecheck PASS; `test:critical` 91/91; `export:web` PASS (build `62aeba7c8b99`, dirty=true, `dist`
  110,5 MB); diff-check PASS. Chromium: `test:library:bulk:web` (8 layouts/temas, 1000 livros), `test:library:web`, `test:source-library:browser`,
  `test:saas:web` PASS. Medições antes/depois em `.expo/perf/`. Reader não tocado (suítes do Reader não reexecutadas nesta onda).
- **Onda 3 (09/11, sobre `c00afb7`)**: typecheck PASS; `test:critical` **92/92** (nova `source-presentation`); `export:web` PASS (build
  `c00afb70b854`, dirty=true); diff-check PASS. Chromium: `test:source-library:browser` PASS, agora com matriz visual 320/390/768/1440 ×
  claro/escuro × texto normal/ampliado (sintético, ×1,3 no Web) para grade, pasta do Drive e erro sem catálogo (48 capturas por rodada;
  antes/depois em `.expo/quality-wave3/{before,after}/`). Reader não tocado.
- **Onda 4 (09/11, sobre `06b77aa`)**: typecheck PASS; `test:critical` 92/92; `export:web` PASS (build `06b77aacb8ac`, dirty=true); diff-check
  PASS; `test-auth`, `test-auth-flows`, `test-auth-callback`, `test-auth-native-{callback,pkce}`, `test-legal`, `test-ui-primitives`, `test-app-design`
  PASS. Chromium: novo `test:auth:web` PASS (login/cadastro/recuperar/redefinir/completar perfil × 320/390/768/1440 × claro/escuro × texto
  normal/ampliado sintético = 80 capturas + erros locais; antes 16 violações de alvo < 44 px, depois 0). Capturas em `.expo/quality-wave4/{before,after}/`.
- **Onda 5 (09/11, sobre `a1399ef`)**: typecheck PASS; `test:critical` **93/93** (nova `preference-persistence`); `export:web` PASS (build
  `a1399ef0a57e`, dirty=true); diff-check PASS. Chromium: `test:reader:{browser,epub:web,study:web,pdf:web,settings:web,concentration:web,
  markings:web}` PASS; `reflow:web` FAIL só pelo BUG 20 (mesmos valores: total 24, visible 0, scrollWidth 10073); `test:source-library:browser`
  e `test:auth:web` PASS. Ondas aprovadas 0–5 concluídas; 6 e 7 seguem fora até decisão do usuário.
- **Patches do SDK 57 (09/11, sobre `eef30e6`)**: typecheck PASS; `test:critical` 93/93 (após `legal:notices`); `export:web` PASS (build
  `eef30e6f125c`, dirty=true, `dist` 110,5 MB); diff-check PASS. Chromium PASS: 7 `test:reader:*:web` (reflow FAIL só BUG 20, mesmos valores),
  `test:library:{bulk:web,web}`, `test:source-library:browser`, `test:auth:web`, `test:saas:web`, `test:admin:web`, `test:marketing:web` (2/2 com
  `CINEMATIC_CHROME_ANGLE=d3d11`). `test:marketing:web` com SwiftShader FALHA neste PC também no baseline `eef30e6` (worktree temporário,
  lockfile antigo, mesmo erro de quadro na rolagem): ambiente, não regressão. `test:legal:browser` NÃO EXECUTADO: exige Chrome de prévia
  em `127.0.0.1:9333` e a porta está ocupada por outro processo (não tocado).
- **Redesenho, Etapa 1 — painel de leitura (10/11, sobre `432849d`)**: typecheck PASS; `test:critical` 93/93; `export:web` PASS; Chromium:
  `test:reader:settings:web` PASS (125 layouts: 5 larguras × claro/escuro × texto 1/1,3/1,6 × recolhido/Texto/Página/Conforto + PDF),
  `test:reader:{browser,epub:web,study:web,pdf:web,concentration:web,markings:web}` e `test:library:web` PASS; `reflow:web` FAIL só BUG 20.
  Capturas antes/depois em `.expo/redesign-step1/`. **Não está no APK `6883532`**; Android NÃO TESTADO.
- **Redesenho, Etapa 2 — cabeçalho e avisos do Reader (10/11, sobre `1cafdae`)**: typecheck PASS; `test:critical` 94/94 (nova `book-display`);
  `export:web` PASS; Chromium PASS: `test:reader:{browser,epub:web,study:web,pdf:web,concentration:web,markings:web}`, `test:library:{web,bulk:web}`;
  `reflow:web` FAIL só BUG 20. Fora do APK `6883532`; Android NÃO TESTADO.
- **Redesenho, Etapa 3 — menu do livro (10/11, sobre `d5d27d6`)**: typecheck PASS; `test:critical` 94/94; `export:web` PASS; Chromium PASS:
  `test:library:{web,bulk:web}` (remoção do aparelho e da conta no export real), `test:source-library:browser`, `test:saas:web`. Capturas do menu
  (fixture de rascunho, claro/escuro/confirmação) em `.expo/redesign-step3/`. Fora do APK `6883532`; Android NÃO TESTADO.
- **Redesenho, Etapa 4 — Descobrir e Estudo (10/11, sobre `69d6fe0`)**: typecheck PASS; `test:critical` **95/95** (nova `study-review`);
  `export:web` PASS; Chromium PASS: `test:source-library:browser` (Descobrir 320–1440 e Estudo vazio; capturas em `.expo/redesign-step4/`),
  `test:library:{bulk:web,web}`. Bloco "Para revisar hoje" com decks reais NÃO exercitado no navegador (só teste da função). Android NÃO TESTADO.
- **Redesenho, Etapa 5 parcial — deck, Plano e Community (10/11, sobre `9ccb201`)**: typecheck PASS; `test:critical` 95/95; `export:web` PASS;
  Chromium PASS: `test:saas:web` (Meu Plano/Comparar; antes/depois em `.expo/redesign-step5/`), `test:admin:web`, `test:source-library:browser`.
  Tela do deck e telas da Community SEM cobertura de navegador (só typecheck). Android NÃO TESTADO.
- **Redesenho, Etapa 5 — sessão de estudo, flashcards e Batalha (10/11, sobre `608cd0e`)**: typecheck PASS; `test:critical` 95/95; `test-flashcard-ui`,
  `test-flashcards`, `test-flashcard-sessions`, `test-flashcard-battles`, `test-battle-account`, `test-ui-primitives` PASS; `export:web` PASS; Chromium PASS:
  `test:source-library:browser`, `test:saas:web`. Sessão de estudo vista em fixture de rascunho (pergunta/resposta/resumo, `.expo/redesign-step5/study/`).
  Batalha SEM cobertura de navegador (exige partida remota); só typecheck e testes de lógica. Android NÃO TESTADO.
- **APK de ensaio do HEAD `99ce32d` (12/11, Community Etapa 2 + tudo do `827721f`)**: `device-rehearsal`, árvore limpa, pasta
  `generated/res/react/release` apagada antes, Gradle 1 min 38 s (log `.expo/apk-99ce32d-build.log`).
  `artifacts/apk/Aldus-99ce32d-device-rehearsal.apk` (ignorado), 161.936.237 bytes (154,4 MiB), SHA-256 `5aca3949…d884b8cb`. `aapt`:
  `com.aldus.reader` 1.0.0-beta.2/code 3, 4 ABIs, sem debuggable; certificado `fac61745…033b9c` (o do Redmi). Livros: só os 7 ativos (hashes
  conferidos), nenhum legado. Bundle Hermes com os textos da tela Pessoas e as RPCs `community_*`. **NÃO instalado**: o Redmi segue com `ae98991`.
- **APK de ensaio do HEAD `827721f` (11/11, fases 1–5 + acervo sem os 33 protegidos)**: `device-rehearsal`, árvore limpa, Gradle 2 min 37 s
  (log `.expo/apk-827721f-build2.log`). `artifacts/apk/Aldus-827721f-device-rehearsal.apk` (ignorado), 161.919.137 bytes (154,4 MiB), SHA-256
  `a05fc392…7893ff39`. `aapt`: `com.aldus.reader` 1.0.0-beta.2/code 3, 4 ABIs, sem debuggable; certificado `fac61745…033b9c` (o do Redmi).
  Livros no APK: exatamente os 7 do acervo ativo (hashes conferidos), nenhum legado. Atenção: o 1º build saiu com 244 MiB e 40 livros porque
  `android/app/build/generated/res/react/release/raw` guardava recursos de builds antigos (o Gradle não limpa); apagada essa pasta de saída e
  recompilado. Bundle Hermes com os textos das fases (acentuados em UTF-16). **NÃO instalado**: o Redmi segue com `ae98991`.
- **APK de ensaio do HEAD `cde4ce8` (11/11, redesenho + melhorias A–D)**: `device-rehearsal`, árvore limpa, Gradle 3 min 33 s (log
  `.expo/apk-cde4ce8-build.log`). `artifacts/apk/Aldus-cde4ce8-device-rehearsal.apk` (ignorado), 254.201.812 bytes, SHA-256 `7eff409f…ef1c252d`.
  `aapt`: `com.aldus.reader` 1.0.0-beta.2/code 3, 4 ABIs, sem debuggable; manifesto com POST_NOTIFICATIONS e RECEIVE_BOOT_COMPLETED (do
  `expo-notifications`) e filtro VIEW `content://` PDF/EPUB; o `*/*` é a consulta OPEN_DOCUMENT já existente. `apksigner`: v2, certificado
  `fac61745…033b9c` (o do Redmi) — não é o Beta privado. dex com `expo/modules/speech`, `expo/modules/notifications`; bundle Hermes com textos
  das ondas A–D; 34 livros. **NÃO instalado**: o Redmi segue com `ae98991`.
- **APK de ensaio do HEAD `4e7ddbe` (16/11, com os ajustes do teste no Redmi: dobra de página, textura visível, Passar página, marca fixa)**:
  `device-rehearsal`, árvore limpa, Gradle 1 min 8 s (log `.expo/apk-4e7ddbe-build.log`); checagem obrigatória PASS (35 recursos, acervo em domínio
  público, manifesto). `artifacts/apk/Aldus-4e7ddbe-device-rehearsal.apk`, 162.155.437 bytes, SHA-256 `1bb26d6c…13ee6568`; `com.aldus.reader`
  1.0.0-beta.2/code 3, 4 ABIs, sem debuggable, v2 com `fac61745…033b9c` (o do Redmi). Bundle Hermes com `curlToPage`, `curlPageRange`, "Passar
  página" (UTF-16) e `feFuncA`. **NÃO instalado**. Substitui o `268d62d` para o teste no aparelho.
- **APK de ensaio do HEAD `268d62d` (16/11, Fases A–E, pedido do dono "Compilar APK")**: `npm run build:apk:local` com `device-rehearsal`, árvore
  limpa, Gradle 2 min 38 s (log `.expo/apk-268d62d-build.log`); checagem obrigatória PASS (35 recursos no bundle, só acervo em domínio público,
  manifesto conforme). `artifacts/apk/Aldus-268d62d-device-rehearsal.apk` (ignorado), 162.175.737 bytes, SHA-256 `039dd512…111b5d16`. `aapt`:
  `com.aldus.reader` 1.0.0-beta.2/code 3, 4 ABIs, sem debuggable. `apksigner`: v2, certificado `fac61745…033b9c` (o do Redmi) — não é o Beta
  privado. dex com `expo/modules/sharing`. **NÃO instalado** (instalação é outro passo, com autorização própria).
- **Fase E fatias 2–3, rolagem no EPUB e na Leitura Livre (16/11, `0c31cf2`)**: typecheck PASS; `test:critical` **130/130**; 8 suítes `test:reader:*`
  PASS; `export:web` PASS; lista de entrega com 35 recursos. Plano dos seis itens de 16/11 concluído no código. Android NÃO TESTADO.
- **Fase E fatia 1, rolagem no PDF Original (16/11, `b2d35e0`)**: typecheck PASS; `test:critical` **130/130**; `test:reader:pdf:web` com rolagem PASS;
  `export:web` PASS; lista de entrega com 34 recursos. Android NÃO TESTADO.
- **Fase D, virar página (16/11, `de31a33`)**: typecheck PASS; `test:critical` **129/129**; 8 suítes `test:reader:*` de navegador PASS; `export:web` PASS;
  lista de entrega com 33 recursos. Android NÃO TESTADO.
- **Fase C, card de trecho (16/11, `d1c1402`, `68e2d13`, `9e5b2ad`)**: typecheck PASS; `test:critical` **128/128**; `export:web` PASS; lista de entrega
  com 32 recursos; legal PASS. Nova dependência nativa `expo-sharing`: exige APK novo. Android NÃO TESTADO.
- **Fase B, grifo (16/11, `763feca`, `ee53a66`)**: typecheck PASS; `test:critical` **126/126**; `test:reader:browser`, `test:reader:{study,markings,epub}:web`
  PASS; `export:web` PASS; lista de entrega `--source`/`--dist` com 31 recursos. Android NÃO TESTADO.
- **Fase A, paletas e textura (16/11, `f0215f7`…`1aca293`)**: typecheck PASS; `test:critical` **125/125**; `test:reader:browser` PASS; `export:web`
  PASS; lista de entrega `--source`/`--dist` PASS com 30 recursos. APK não compilado.
- **Pendências antes do APK (16/11, `98a8ead`…`3cd2d9a`)**: typecheck PASS; `test:critical` **124/124**; `export:web` PASS; lista de entrega
  `--source`/`--dist` PASS com 28 recursos. Migration de clubes/fóruns **aplicada no Supabase em 16/11** (ver log). APK não compilado (aguarda pedido).
- **Segurança (15/11, `e71b31d`, `64ad127`, `68b18cd`)**: typecheck PASS; `test:critical` **117/117**; `export:web` PASS; Chromium PASS: `test:reader:
  {epub,reflow,pdf,study,markings,settings}:web`, `test:reader:browser`, `test:library:web`, `test:marketing:web`; checagem ad hoc no Chromium
  (script injetado bloqueado pela CSP). `processReleaseMainManifest` sem SYSTEM_ALERT_WINDOW. `test:legal:browser` BLOQUEADO (porta 9333).
  NÃO TESTADO: WebView Android, cabeçalhos no Vercel (sem deploy).
- **Community no Supabase (12/11)**: migrations aplicadas e conferidas por catálogo e por sonda REST anônima (ver log). Sessões autenticadas reais NÃO testadas.
- **Community, Etapa 2 (12/11, `0ffe781`, `2140f8f`)**: typecheck PASS; `test:critical` **115/115** (novas `community-social-schema` em PGlite com as 3
  migrations reais e contas A/B/C/anon, e `community-social` com gateway/telas simulados); `export:web` PASS. Sem suíte de navegador para a Community.
- **Acervo + FASES 3–5 (11/11, `51f69f0`…`80d2c88`)**: typecheck PASS; `test:critical` **113/113** (novas `bundled-catalog`, `legacy-reattach`,
  `reading-milestones`); `export:web` PASS ("7 em domínio público"); Chromium PASS: `test:reader:{settings,epub,pdf,reflow}:web`, `test:reader:browser`,
  `test:library:{web,bulk:web}`, `test:source-library:browser`. Mockup medido sem estouro em 320/390/1280 px.
- **Plano de mercado, FASE 2 (11/11, `6da731d`, `21a001b`)**: typecheck PASS; `test:critical` **110/110** (nova `reading-session`); `export:web`
  PASS; Chromium PASS: `test:reader:{settings,epub,pdf,reflow}:web`. NÃO TESTADO: Android (AppState real, tela Não perturbe, sessão gravada no
  aparelho).
- **Plano de mercado, FASE 1 (11/11, `f752cf3`…`9b29311`)**: typecheck PASS; `test:critical` **109/109** (nova `import-duplicates`); `export:web`
  PASS; Chromium PASS: `test:reader:settings:web`, `test:reader:epub:web`, `test:marketing:web`, `test:library:web`; `test:legal` PASS. NÃO TESTADO:
  Android (fontes, prompt de duplicado, hash nativo em arquivo real).
- **Melhorias, Onda D (11/11, `fca5591`…D3)**: typecheck PASS; `test:critical` **108/108** (nova `pdfjs-lazy`); `export:web` PASS; Chromium PASS:
  `test:reader:{pdf,reflow,browser,markings,epub}:web`, `test:library:{web,bulk:web}`, `test:source-library:browser`. Bundle Web principal
  5656→5121 KiB (1,48→1,38 MB gzip). `npm audit --omit=dev`: 0 crít./3 altos/6 moderados/0 baixo. `redmi-qa.cjs` NÃO executado (sem aparelho).
- **Melhorias, Onda C (11/11, `d356f61`…C3)**: typecheck PASS; `test:critical` **107/107** (novas `read-aloud`, `review-reminder`, `open-with`);
  `export:web` PASS; Chromium PASS: 4 suítes do Reader (C1), `test:source-library:browser`, `test:saas:web`, `test:auth:web`, `test:library:{web,bulk:web}`,
  `test:marketing:web` (d3d11). `test:library:web` falhou 1 vez por corrida do teste (sync em segundo plano grava o estado lido antes/depois) e
  passou 2/2 em seguida. **Novos módulos nativos `expo-speech` e `expo-notifications` e filtro de intent: exigem APK novo; nada disso compilado
  nem testado no Android.**
- **Melhorias, Onda B (11/11, `8272a3f`…`a183048`)**: typecheck PASS; `test:critical` **104/104** (novas `native-brightness`, `reader-last-page`,
  `epub-language`, `reading-pace`); `export:web` PASS; Chromium: **as 8 suítes do Reader PASS neste PC pela primeira vez** (`reflow:web` incluída,
  BUG 20 corrigido). Fora do APK `9d03182`; Android NÃO TESTADO (hifenização no WebView, brilho nativo, tempo restante).
- **Melhorias, Onda A (11/11, `26a582f`…A5)**: typecheck PASS; `test:critical` **100/100** (novas `highlight-flashcard`, `reading-shelves`,
  `reader-theme-auto`, `review-history`, `first-steps`); `export:web` PASS; Chromium PASS: `test:reader:{settings,browser,epub,pdf,concentration,
  markings,study}:web` (A3), `test:library:{web,bulk:web}` (bulk 4/4 após corrigir o teste), `test:source-library:browser`, `test:saas:web`.
  Fora do APK `9d03182`; Android NÃO TESTADO; histórico de revisão e cartão de primeiros passos sem captura de navegador.
- **APK de ensaio do HEAD `9d03182` (10/11, redesenho etapas 1–5)**: `ALDUS_ALLOW_DEVELOPMENT_SIGNING=device-rehearsal npm run build:apk:local`, árvore
  limpa, Gradle 2 min 1 s (reuso incremental; log `.expo/apk-9d03182-build.log`). `artifacts/apk/Aldus-9d03182-device-rehearsal.apk` (ignorado),
  253.266.978 bytes, SHA-256 `e2c0fad9…a93cc410`. `aapt`: `com.aldus.reader` 1.0.0-beta.2/code 3, min 24/target 36, sem debuggable, 4 ABIs.
  `apksigner`: v2, certificado `fac61745…033b9c` (debug/`device-rehearsal`, o mesmo do Redmi) — **não é o Beta privado**. Bundle Hermes
  regenerado (8.543.880 bytes; antes 8.532.264) com textos das etapas 1–5 ("Mais ajustes", "Para revisar hoje", "Confirmar remoção",
  "Progresso da sessão") e sem "Modo e-reader"; 34 livros (92,6 MiB). **NÃO instalado**: o Redmi segue com `ae98991`.
- **APK de ensaio do HEAD `6883532` (09/11, primeiro build Android deste PC)**: `ALDUS_ALLOW_DEVELOPMENT_SIGNING=device-rehearsal npm run build:apk:local`,
  árvore limpa, Gradle 14 min 16 s (log `.expo/apk-6883532-build.log`). `artifacts/apk/Aldus-6883532-device-rehearsal.apk` (ignorado; cópia de
  `android/app/build/outputs/apk/release/app-release.apk`), 253.255.362 bytes, SHA-256 `6fecb41c…6931812f5c`. `aapt`: `com.aldus.reader`
  1.0.0-beta.2/code 3, min 24/target 36, sem debuggable, ABIs arm64-v8a/armeabi-v7a/x86/x86_64. `apksigner`: v2, 1 signatário, certificado
  `fac61745…033b9c` (debug/`device-rehearsal`, o mesmo da instalação do Redmi) — **não é o Beta privado**. Conteúdo: 34 livros (92,6 MiB),
  bundle Hermes de 8,5 MB com textos das ondas 0–5 e "Continue lendo". Tamanho igual aos APKs de outubro (251,4–251,6 MB); os 346 MB do
  `ae98991` (PC antigo) ficam INCONCLUSIVOS (arquivo não está neste PC). **NÃO instalado**: o Redmi segue com `ae98991`.
  Primeira tentativa falhou na configuração do Gradle: `android/local.properties` (criado nesta sessão) tinha `C\:\Android\sdk` com barras simples
  (lido como `C:Androidsdk`); corrigido para `sdk.dir=C:/Android/sdk` (arquivo ignorado pelo Git).
- Validação local de 09/11 ("Continue lendo", sobre `cb45b71`): typecheck PASS; `test:critical` 90/90 (nova `library-last-read`); `export:web` PASS;
  `test:library:bulk:web` e `test:library:web` PASS; diff-check PASS.
- Validação anterior (Fase 5, sobre `bb9d5dd`): typecheck PASS; `test:critical` 89/89; `export:web` PASS (build `bb9d5dd4597e`, dirty=true);
  Chromium PASS: `test:reader:{browser,epub:web,reflow:web,concentration:web,settings:web,markings:web,pdf:web}`; diff-check PASS.
- Validação anterior (Fase 4, sobre `02bb6f4`): typecheck PASS; `test:critical` 89/89; `export:web` PASS (build `02bb6f4ecac8`, dirty=true);
  Chromium PASS: `test:source-library:browser` (Conta/Estudo/Descobrir 320–1440), `test:library:bulk:web`, `test:library:web`, `test:saas:web`,
  `test:admin:web`; diff-check PASS. Último ajuste (remover o botão duplicado do estado vazio do Estudo) validado só por typecheck.
- Validação anterior (Fase 3, sobre `c350015`): typecheck PASS; `test:critical` 89/89; `export:web` PASS (build `c350015c8400`, dirty=true);
  Chromium PASS: `test:library:bulk:web` (8 layouts/temas, mouse/toque/teclado, 1000 livros), `test:library:web`, `test:source-library:browser`,
  `test:saas:web`; diff-check PASS. Capturas em `.expo/cycle2-library-web/library-*.png` (ícones como pontos: fonte de ícones não carrega no harness).
- Validação anterior (Fase 2, sobre `b979ec8`): typecheck PASS; `test:critical` 89/89 PASS; `export:web` PASS (build `b979ec86d933`,
  dirty=true); `test:source-library:browser` (Chromium) PASS com capturas `.expo/source-library-validation/explore-{320,390,768,1440}.png`; diff-check PASS.
- Validação anterior (Fase 1, sobre `f9a9aff`): `npm run typecheck` PASS; `npm run test:critical` 88/88 PASS; `npm run export:web` PASS
  (build `f9a9aff01dcf`, dirty=true); `git diff --check` PASS. Antes (HEAD `f61a0c8`): typecheck PASS, 87/87. Última rodada Web mais
  ampla (código `ea0b1ec`, igual ao UX atual): `export:web` PASS e 8 suítes Chromium PASS (`test:source-library:browser`,
  `test:library:bulk:web`, `test:library:web`, `test:saas:web`, `test:admin:web`, `test:reader:browser`, `test:reader:settings:web`,
  `test:reader:markings:web`). Nesta sessão **não** foram reexecutados export nem Chromium.
- Não verificável pelo código (vem só de registros em `historico/` e BUGS_ATUAIS.md): Supabase remoto (migrations aplicadas,
  Auth/OAuth, deploy de `username-login`, OWNER do Admin), Vercel, Redmi, APKs. Último APK/preview documentados (24/10) são do
  código `00b6e4d`, **não** do HEAD. Nada de Android físico, Supabase real, deploy ou APK foi exercitado em 06/11.
- Bugs EPUB "center reset" e "restauração de progresso": ver §5 e `docs/context/referencias/bugs-epub-center-reset-e-restore.md`.

## 4. Arquitetura (resumo) e invariantes

Camadas: `app/` (rotas Expo Router) → `src/presentation` (telas, componentes, contextos, stores Zustand) → `src/domain`
(entidades, contratos de repositório, usecases, regras puras) → `src/data` (SQLite/IndexedDB, importadores, EPUB, Sources, Drive,
Sync, Supabase). `src/community` e `src/admin` são verticais próprias (domain/application/data/presentation). Também: `src/legal`,
`src/marketing` (landing), `src/theme` (tokens, appUi), `src/utils` (diagnósticos opt-in), `modules/aldus-drive-auth` e
`modules/aldus-pdf-ocr` (Kotlin), `supabase/` (10 migrations imutáveis, `functions/username-login`, `admin/`, `audit/`, `tests/`).
Composição única: `src/presentation/services/dependencies.ts` — repositórios por plataforma (`Sqlite*` vs `IndexedDb*`, por
`Platform.OS`), embrulhados por `AccountBookRepository`/`scopeBookData` (escopo de conta) e `journal*` (outbox) →
`LibrarySyncService` + `LibraryLocalReplica`. **Reutilize essa composição; não crie persistência/Sync paralelos.** Arquivos
`.web`/`.native` (viewers, OCR, thumbnails, storage) são implementações separadas: leia as duas.
Providers (`app/_layout.tsx`): AppTheme → SafeArea → Auth → ReaderSettings; `AuthGuard` protege rotas privadas (sessão + perfil
ativo do mesmo UUID). Rotas: `(tabs)` library/search/study/settings; `reader/[bookId]`, `reader/web`; `sources`,
`services/[provider]`; `decks/[deckId]`, `study/[deckId]`, `battle`; `auth/*`; `account/*`; `community/*`; `plan/*`; `admin`; `legal/*`;
`preferences`, `support`; `index.web.tsx` = landing.

### Invariantes (violar = regressão)
- EPUB, PDF Original e PDF Reflow têm posições independentes; controles/tema/fonte/brilho **não** remontam o documento nem salvam
  posição transitória. Restauração só após `layoutReady` + ACK (`reflowRestoreState`). Controles são overlay estável: nunca mover o
  documento de ancestral por `controlsVisible` (causa do reset no Reflow). Página 1 legítima não é filtrada globalmente.
- Âncora `missing`/`ambiguous` → aviso, nunca navegação silenciosa. Posição textual EPUB/Reflow vive em `progress.cfiPosition`
  como envelope versionado (não é CFI real).
- IndexedDB: sucesso só em `transaction.oncomplete`. Preserve cancelamento/gerações, tombstones, CAS, recibos idempotentes, outbox
  durável; conta A≠B, retorno A→B→A exige epoch. Não limpar fila/cache nem subir timeout como "correção".
- NÃO INVENTAR DADOS: sem fonte confiável, `null`/indisponível; zero só com medição.
- Helpers enviados a WebView são código literal (`Function.toString` do Hermes não serve).
- Sources/UserSources ainda são **device-scoped** (chave global `kindle-reader.user-sources.v1`, BUG 12).
- Batalha de Flashcards só envia o deck escolhido ao Supabase quando habilitada (RPC `public.flashcard_battle`, pontuação e gabarito
  no servidor); estudo individual é local. Tratamento legal em `docs/context/legal-build-git.md`; contrato em `community-estudo.md`.
- UI pt-BR, sóbria, acessível; sem instrumentação, serviço pago ou envio de livros a IA externa sem pedido explícito.

## 5. Matriz de recursos (classificação com evidência, 06/11/2026)

Legenda: **IVER** = implementado e verificado (suíte/execução citada); **ISVS** = implementado sem validação suficiente;
**PARC** = parcial; **PLAN** = planejado/especificação; **PROP** = proposta não aprovada; **DESC** = desconhecido.
"Local" = Node/PGlite/Chromium controlado; nada disto prova Android físico, sessão autenticada ou deploy.

| Recurso | Classe | Evidência e limite |
| --- | --- | --- |
| Reader EPUB | IVER (Web) / físico até `c382f99` | `EpubReaderDocument.ts`, `EpubPageViewer.*`; `test-reader-{screen,navigation,location,native}`, `test-reading-anchors` (critical); `test:reader:{browser,epub:web}`; Redmi 23/10 (EPUB 4 categorias, restauração 15→16→15). HEAD atual não reexecutado no aparelho. |
| PDF Original | IVER (Web) / físico PARC | `PdfPageViewer.*`; `test:reader:pdf:web`; Redmi 23/10 em `53b4e32`. Seleção/grifos PDF e repetição na build atual pendentes. |
| PDF Reflow | IVER (Web) / Android PARC | `PdfReflowProcessor.*`, `PdfReflowDocumentBuilder.ts`, cache SQLite/IndexedDB; `test-pdf-reflow`, `test-reflow-*` (critical), `test:reader:reflow:web`. BUG 06: livro grande lento (584 págs ≈3m32 no Redmi, observação pontual). |
| Bug EPUB/Reflow "center reset" | RESOLVIDO (usuário confirmou em 06/11). Reflow: causa confirmada e corrigida; EPUB: nunca reproduzido em teste | `ReaderScreen.tsx` ≈L1043-1052; `test-reader-screen.cjs` (10 toggles, mocks) e `test-reader-browser.cjs`. Registrado em BUGS_ATUAIS.md como resolvido. |
| Bug restauração de progresso (era Reflow 1↔11) | Causa CONFIRMADA; handshake implementado; validação PARC | `ReaderScreen.tsx` L128/L769-822; sem teste Chromium dedicado de reabertura Reflow com total mudando; Redmi validou EPUB. |
| Marcações (grifos/marcadores) | IVER (Web) / físico PENDENTE | `StudyPanelControls.tsx`, `Study{Bookmarks,Highlights}.ts`; grifo por pressionar e pop-up `HighlightSelectionPopup` (16/11, `test-highlight-popup`, `test:reader:browser`); fixar trechos e "Todas as anotações" (16/11, `test-pinned-highlights`, `test-all-annotations`); `test-study-storage`, `test:reader:markings:web`, `test:reader:study:web`. Seleção por toque no Android não homologada. |
| Biblioteca/organização/lote | IVER (local) | `library.tsx`, `OrganizeLibrarySelection.ts`; `test:library:*` (bulk, web, 1000 livros). |
| Importação EPUB/PDF + OCR | IVER (local); BUG 01 VALIDADO FÍSICO (Amêndoas); OCR Android ISVS | `LocalBookImportService.ts`, `src/data/epub/*`, `modules/aldus-pdf-ocr`; `test-book-import`, `test-epub-*`, `test-pdf-ocr`. |
| Flashcards, Estudo (4 respostas, SRS, sessões) | IVER (local); sem aparelho | `src/domain/study/flashcard{Scoring,Srs}.ts`, `components/flashcards/*`, `flashcardStorage.*`; `test-flashcard-{scoring,sessions,storage,ui}`, `test-flashcards` (critical). Pontuação +10/+5/−5/−10 é a **proposta do usuário já adotada no código**. |
| Batalha | ISVS | Migration `202610090001_flashcard_battles.sql`, `FlashcardBattleRepository.ts`, `app/battle.tsx`; `test-flashcard-battles` (PGlite), `test-battle-account`. Duas sessões Supabase reais nunca exercitadas; deploy só "informado pelo usuário". |
| Geração de cartões por livro | PARC (local determinístico) + PLAN/PROP (IA) | `flashcardGeneration.ts`: pergunta fixa + trecho, **não é IA**. Sem IA, consentimento, cota, fila de novos, volta à origem, Anki. Ver `referencias/requisitos-flashcards-batalha-geracao.md`. |
| Modo Viagem | DESC | Nenhum símbolo no código; `Prompt_Codex_Modo_Viagem.md` ausente. Existem brilho e `motionCues` (abaixo). |
| Brilho / motion cues | ISVS | Web: luminosidade em `ReaderScreen.tsx`; Native: `expo-brightness` + restauração; `test-motion-*` fora do npm. Brilho/permissões físicos pendentes; eficácia anti-enjoo não demonstrada. |
| Auth (email, Google PKCE, username) | IVER (local) / remoto ISVS | `auth*.ts`, `AuthContext.tsx`; `test-auth*` (critical). BUG 08 (cadastro/recovery reais) e BUG 09 (`username-login` não implantado) BLOQUEADOS externamente. |
| Library Sync (outbox/CAS/tombstone/RLS) | IVER (local/PGlite) / remoto ISVS | `src/data/library/*`, migrations `*library*`; `test:library:*`, `test:library:rls`. BUG 02: QA autenticado remoto pendente; BUG 11 deploy incremental pendente. |
| Sources / Drive | Sources IVER (local); Drive ISVS | `src/data/sources/*`, `src/data/drive/*`, `modules/aldus-drive-auth`; `test:source-catalog`, `test:drive`. BUG 03 (Drive real Android) aberto; BUG 12 resolvido no código (`10d6d24`, `test-source-ownership`), Android não testado. |
| Community | PARC (local v0.1 + Etapas 2 e 3 no código e no servidor; sem homologação com sessões reais) | `LocalCommunityRepository`; Pessoas/Leitor + `SupabaseCommunityGateway` (12/11); `test-community-*`. Migrations `202610130001_community_foundation.sql` e `20261112120000_community_social_graph.sql` **aplicadas no Supabase em 12/11** pelo editor SQL do painel (não constam no ledger `supabase_migrations`). Clubes/Fóruns (16/11): `20261116120000_community_clubs_forums.sql` **aplicada em 16/11** pelo mesmo caminho (fora do ledger); `test-community-clubs{,-schema}`. Falta APK/deploy com o código e teste com duas contas reais. |
| SaaS/planos/cotas e Admin | IVER (local) / remoto ISVS | `src/domain/saas`, `src/admin`, migrations `20261015*`; `test:saas*`, `test:admin*`. Deploy/OWNER só por registro; login/TOTP real pendente. |
| Landing Web e legal | IVER (local/Chromium) | `src/marketing`, `src/legal`; `test:marketing*`, `test:legal*`. Deploy Vercel não reconferido. |
| Android (build/APK/módulos) | PARC | `android/`, `scripts/build-apk-local.mjs`; APK `00b6e4d`/`53b4e32` (privados, ignorados). Homologação física BLOQUEADA (Redmi ausente), APK do HEAD inexistente. |
| UX/UI reformulação (27/10) | IVER (Web controlado) / físico PENDENTE | commits `d6ef9c7`, `ea0b1ec`, `f970c2d`; `test-app-design`, 8 suítes Chromium. Será substituída pelo redesign abaixo. |
| Rolagem contínua (16/11) | PDF Original, EPUB e Leitura Livre IVER (Chromium); Android NÃO TESTADO | `src/domain/reader/pdfScroll.ts` (`createPdfScroller`), `PdfPageViewer.{native,web}`; `test-pdf-scroll`, `test:reader:pdf:web`. |
| Virar página: Sem animação/Deslizar/Folhear (16/11) | IVER (Chromium); Android NÃO TESTADO | `src/domain/reader/pageTurn.ts`, `updateMotion` no `EpubReaderDocument`, `useReduceMotion`; `test-page-turn`, `test:reader:browser` (EPUB e Reflow). |
| Card de trecho para Stories/X (16/11) | IVER (local + Chromium); Android NÃO TESTADO | `src/domain/reader/quoteCard.ts`, `QuoteCardModal`, `QuoteCardCanvas.{native,web}`, `shareQuoteCard.{native,web}`; `test-quote-card`, `test-quote-card-modal`. Limite de 400 caracteres; só a folha do sistema. |
| Paletas Clássico/Moderno e textura de papel (16/11) | IVER (local + Chromium); Android NÃO TESTADO | `src/theme/tokens.ts` (`appPalettes`, `readerChromePalette`), `AppThemeContext`, `app/preferences.tsx`, `src/domain/reader/paperTexture.ts`, `updateSurface` no `EpubReaderDocument`; `test-app-design`, `test-preference-persistence`, `test-paper-texture`, `test:reader:browser`. |
| Redesign editorial (06/11, fases 1–5) | Fases 1–5 IVER (local + Chromium); Android NÃO TESTADO | `src/ui/*`, `app/(tabs)/_layout.tsx`, `app/(tabs)/search.tsx` (Descobrir), `app/(tabs)/library.tsx`, `BookCard.tsx`; `test-ui-primitives`, `test-discover-ui`, `test-app-design` (critical), `test:source-library:browser`. Ver `docs/context/design-system.md`. |
| Reflow/PDF seleção ↔ EPUB equivalência | PLAN | `reader.md`: grifos mapeados entre PDF e Reflow ainda não equivalem ao EPUB. |

## 6. Mapa tarefa → arquivos (caminhos conferidos no disco em 06/11/2026)

| Tarefa | Onde editar | Ler antes |
| --- | --- | --- |
| Abrir/ler livro, restauração, controles | `src/presentation/screens/ReaderScreen.tsx`, `components/reader/DocumentReaderAdapter.tsx`, `ReaderControls.tsx`, `ReaderContent.tsx`, `reader/ReaderGeometry.ts` | `docs/context/reader.md`, `referencias/bugs-epub-center-reset-e-restore.md`, skill reader-safety |
| Documento EPUB/layout/paginação/âncoras | `components/EpubReaderDocument.ts`, `ReaderAnchorDocument.ts`, `EpubPageViewer.{web,native}.tsx`, `src/domain/types/{readingAnchor,readerLocation,reader}.ts`, `usecases/UpdateReadingProgressUseCase.ts` | reader.md |
| Ajustes do Reader / tema / concentração | `ReaderSettingsPanel.tsx`, `ReaderSettingsSlider.tsx`, `contexts/ReaderSettingsContext.tsx`, `contexts/AppThemeContext.tsx`, `src/theme/` | reader.md |
| Marcações (grifos/marcadores) | `StudyPanelControls.tsx`, `StudyBookmarksPanel.tsx`, `StudyHighlightsPanel.tsx`, `usecases/Study{Bookmarks,Highlights}.ts`, repos `*Bookmark*`/`*Highlight*` | reader.md |
| Brilho / motion cues | `ReaderScreen.tsx` (brilho), `src/presentation/motion/useMotionCues.ts`, `stores/motionCuesStore.ts`, `components/MotionCues{Control,Overlay}.tsx` | reader.md (motion cues) |
| PDF Original / Reflow / OCR | `PdfPageViewer.*`, `PdfReflowProcessor.*`, `reflowOperation.ts`, `src/data/local/{PdfReflowDocumentBuilder,pdfReflowQuality,pdfOcr.native,reflowSerialization}.ts`, `*PdfReflowCacheRepository`, `modules/aldus-pdf-ocr` | `importacao-ocr.md` |
| Importar livro (arquivo/download) | `src/data/imports/LocalBookImportService.ts`, `src/data/epub/*`, `src/data/local/PdfFileImporter.ts`, `src/data/downloads/*`, `hooks/useBookImport.ts`, `BookImportModal.tsx` | importacao-ocr.md |
| Biblioteca (lista/grade/filtros/lote) | `app/(tabs)/library.tsx`, `BookCard.tsx`, `BookCover.tsx`, `LibraryBulkModal.tsx`, `BookOrganizationModal.tsx`, `stores/libraryStore.ts`, `usecases/OrganizeLibrarySelection.ts`, `src/data/local/LibraryOrganizationStore.ts` | `biblioteca-sync.md` |
| Sync/conta/outbox/RLS | `src/data/library/*` (`LibrarySyncService`, `LibrarySyncCoordinator`, `LibrarySyncPersistence`, `LibraryLocalReplica`, `AccountBookRepository`, `LibraryAccountScope`, `SupabaseLibraryAdapter`, `JournaledReadingData`), `supabase/migrations/*library*` | biblioteca-sync.md, skill library-sync |
| Sources/catálogos/Drive | `src/data/sources/*`, `src/data/drive/*`, `src/data/scraping/*`, `app/sources/*`, `SourceLibraryScreen.tsx`, `hooks/useSource*`, `modules/aldus-drive-auth` | `sources-drive.md`; `GOOGLE_AUTH_DRIVE_DEPLOYMENT.md` (raiz, só para deploy) |
| Busca | `app/(tabs)/search.tsx`, `stores/searchStore.ts`, `usecases/Search*UseCase.ts`, `src/domain/search/catalogRanking.ts` | sources-drive.md |
| Auth/perfil/OAuth/username | `contexts/AuthContext.tsx`, `AuthGuard.tsx`, `AuthForm.tsx`, `src/data/remote/auth*.ts`, `src/domain/auth/authRules.ts`, `app/auth/*`, `supabase/functions/username-login/*` | `auth.md` |
| Planos/cotas e Admin | `src/domain/saas/*`, `src/data/saas/SupabaseAccountPlanRepository.ts`, `presentation/saas/*`, `app/plan/*`; `src/admin/**`, `app/admin/index.tsx` (autorização real é RPC no servidor) | biblioteca-sync.md (6.1/6.2) |
| Flashcards/Estudo/Batalha | `app/(tabs)/study.tsx`, `app/decks`, `app/study`, `app/battle.tsx`, `src/domain/study/*`, `src/domain/types/flashcards.ts`, `src/data/local/Flashcard*`, `src/data/remote/FlashcardBattleRepository.ts`, `components/flashcards/*` | `community-estudo.md` §12, `referencias/requisitos-flashcards-batalha-geracao.md`, skill study-flashcards |
| Community | `src/community/**`, `app/community/*`, `supabase/migrations/*community*` | community-estudo.md §11/13/13.2, skill community |
| Design system (tokens/primitivos) | `src/ui/*` (`tokens.ts`, `Text`, `Button`, `Chip`, `ListRow`, `Screen`, `EmptyState`, `ActionMenu`, `SearchField`), cores em `src/theme/tokens.ts` | `docs/context/design-system.md` |
| Navegação/tema/UI geral | `app/(tabs)/_layout.tsx`, `app/_layout.tsx`, `src/theme/{tokens,appUi}.ts`, `components/{AppUi,SettingsLayout,TopHeader}.tsx`, `screens/SettingsScreen.tsx` | skill interface-review |
| Landing/legal | `src/marketing/*`, `src/legal/*`, `app/legal/*`, `app/index.web.tsx`, `public/`; `LANDING_PAGE_CONTEXT.md` (raiz) | `legal-build-git.md` §14 |
| Build Web/CI | `package.json` (`export:web`), `scripts/{validate-web-env,write-build-metadata,write-public-web}.cjs`, `scripts/copy-books-to-dist.mjs`, `vercel.json`, `.github/workflows/validate.yml` | legal-build-git.md §16 |
| Build Android/APK | `android/`, `scripts/{build-apk-local.mjs,archive-commit-apk.mjs,release-signing.cjs}`, `eas.json` | legal-build-git.md §15, skill verify-android-apk-delivery |
| Supabase (migrations/RLS/deploy) | `supabase/migrations/*`, `supabase/{admin,audit,tests}`, `LIBRARY_SYNC_DEPLOYMENT.md` (raiz) | skill backend-operations; **nunca aplicar sem pedido** |

Documentos soltos na raiz (`GOOGLE_AUTH_DRIVE_DEPLOYMENT.md`, `LANDING_PAGE_CONTEXT.md`, `LIBRARY_SYNC_DEPLOYMENT.md`,
`RELATORIO_CORRECOES_INTEGRADAS.md`) são referência de operação/histórico; não os trate como estado atual sem conferir.

## 7. Validação (comandos reais de package.json)

Gates: `npm run typecheck`; `npm run test:critical` (90 suítes `scripts/test-*.cjs`, sem Android/Supabase real); `npm run export:web`;
`git diff --check`. Ferramentas de teste isoladas em `.expo/` (`npm run setup:test-tools`). Tempo típico: typecheck e critical levam alguns
minutos; rode em segundo plano. Por área:
- Reader: `test:reader:{browser,epub:web,reflow:web,study:web,pdf:web,settings:web,concentration:web,markings:web}` (Chromium; fora do critical)
- Biblioteca: `test:library:{account,sync,files,reading,bulk,bulk:web,coordinator,restart,web,rls}`
- Sources/Import: `test:source-catalog`, `test:source-library:browser`, `test:import`, `test:drive`, `test:ocr`
- Auth (telas): `test:auth:web` (Chromium, fixture; `--report-only` lista violações sem falhar). Lógica: `node scripts/test-auth*.cjs`
- SaaS/Admin: `test:saas`, `test:saas:quotas`, `test:saas:postgres`, `test:saas:web`, `test:admin`, `test:admin:web`
- Landing/legal: `test:marketing`, `test:marketing:web`, `test:legal`, `test:legal:browser`
- Sem comando npm (rodar `node scripts/test-<nome>.cjs`): `catalog-ranking`, `motion-cues`, `motion-lifecycle`, `search-pipeline`, `source-integrations`.
Export/build/teste controlado **não** comprova Android físico, sessão autenticada nem implantação remota.

## 8. Pendências e riscos (ordem sugerida)

1. **Homologação física Android pendente** (Redmi): Reflow/PDF Original/seleção-grifos/brilho/permissões na build atual; restaurar
   `heads_up_notifications_enabled` para 1 quando o aparelho voltar (config temporária do aparelho, ver historico). Emulador isolado não
   iniciou o APK 00b6e4d (serviço phone).
2. **Redesign concluído no código (fases 1–5)**; APK de ensaio `ae98991` instalado no Redmi (§3); falta o usuário entrar na conta e homologar: estilos estáticos, ripple, menus "+"/"⋯", texto ampliado;
   revisão visual humana, preview Vercel, Literata empacotada (exige autorização para baixar a fonte) e, se desejado, painéis do Reader (ajustes/marcações)
   no novo visual (`docs/context/design-system.md`).
   **Acervo** (11/11): etapas 1–3 concluídas no código; os 33 títulos protegidos saíram do pacote. Falta: o usuário importar as próprias cópias
   (reanexam ao mesmo livro da conta) e um APK/deploy novos; o APK `cde4ce8` e deploys anteriores ainda contêm os arquivos; os binários seguem no histórico Git.
   **Revisão de qualidade (09/11)**: Ondas 0–5 aprovadas concluídas (commits locais, sem push); 6 e 7 fora. R5: patches do SDK 57 aplicados
   (BUG 13); APK de ensaio `6883532` compilado e conferido (§3), **não instalado**; `js-polyfills` 0.76/`metro-cache` 0.81 removidos na Onda D (D2).
   **Entrega (16/11)**: aba Comunidade e lista de entrega no código; o próximo APK sai do `npm run build:apk:local`, que só termina com
   sucesso se todos os recursos pedidos estiverem no pacote.
   **Segurança (15–16/11)**: SEG 01–04 e backup do Android corrigidos no código; pendentes de decisão: `npm audit` (SDK 58),
   `debug.keystore` versionado, CSP do app Web. Precisa de APK e deploy novos para valer.
   **Community, Etapa 2 (12/11)**: código pronto e as duas migrations **aplicadas no Supabase** com autorização do usuário. Falta: homologar com
   duas contas reais (publicar, pedir, aceitar, bloquear, denunciar), instalar o APK `99ce32d` (já tem a tela Pessoas) e publicar o Web,
   aprovar o texto de privacidade sobre o perfil publicado e decidir se as migrations entram no ledger.
   **Clubes e Fóruns (16/11)**: código pronto e `20261116120000_community_clubs_forums.sql` aplicada no Supabase (autorização do dono); falta
   homologar com duas contas reais e publicar o app. Denúncias de conteúdo ficam só no servidor (sem painel no Admin ainda).
   **Betas públicas (17/11)**: plano de prontidão em `docs/context/legal-build-git.md` §17; bloqueios 1–10 com decisões do dono pendentes; inventário
   remoto aguardando login no painel do Supabase.
   **Leitura e compartilhamento (16/11)**: plano de 5 fases em `docs/context/design-system.md` §Paletas e plano. Fase A (paletas e textura)
   , B (grifo: captura pela seleção parada, pressionar e segurar, pop-up) e C (card de trecho, `expo-sharing`, 400 caracteres) concluídas no
   código, e D (virar página: Sem animação/Deslizar/Folhear) também; B, C, D e E (rolagem no PDF, EPUB e Leitura Livre) estão no código; todas precisam de APK e Redmi. Plano dos seis itens concluído no código (PDF → EPUB num capítulo → entre capítulos). Candidato: a imagem do cartão de foco pode usar o
   mesmo desenho em canvas. Decisões D3–D5 tomadas em 16/11 (expo-sharing sim, 400 caracteres, sem botão direto de Stories).
   **Plano de mercado (11/11)**: FASES 0–5 concluídas (3 e 5a só planejamento: `docs/context/reader.md` e `community-estudo.md` §13.1; 4 em
   `docs/mockups/certo-errado/`). FASE 3 implementada em 16/11 (A1, A2, B1, B2, C em texto); A3, A4, B3 e D seguem só planejados. Pendentes do usuário: texto da política de
   dados sobre sessões, marcos e diário; entrevistas da FASE 4.
   **Melhorias (11/11)**: Ondas A–D concluídas (C precisa de APK novo para valer no aparelho); Maestro não adotado (ver log D); rolagem contínua avaliada e adiada (segundo sistema de posição; ver log). Dependem do usuário: acervo, Play/Firebase, Redmi, Literata.
   acervo: 33 protegidos removidos do pacote em 11/11 (ver item Acervo); fixtures de teste só com domínio público.
   Candidatos de bundle (sem decisão): pdfjs-dist duplicado no entry, reanimated só para motion cues, `react-native-render-html` em `ChapterRenderer`.
   BUG 17 e BUG 20 corrigidos no código na Onda B (11/11; Android não testado). Botão OCR do Reflow segue o tema desde `98a8ead` (16/11).
3. **Backend remoto não comprovado**: Library Sync/Battle/Admin/SaaS (BUG 02, 11), `username-login` (BUG 09), cadastro/recovery (BUG 08),
   Drive real (BUG 03). Nada disto é verificável pelo código. BUG 11: o ledger remoto lista `library_active_account_fences` (16/10;
   conferido em 12/11), então a migration está aplicada; falta a homologação com contas reais A/B/desativada.
4. **Plano 18/11 (aprovado para planejar, sem código)**: livro sem arquivo e "Quero ler", importar CSV do Goodreads e card de trecho com
   capa e capítulo; fatias, riscos e 4 decisões do dono em `docs/context/biblioteca-sync.md` §7 e `reader.md`.
4b. **Geração de flashcards por livro** é só local determinística (pergunta fixa): não vender como IA; IA exige decisão do usuário (§5).
5. **Sources por conta** (BUG 12): resolvido no código; falta conferir no Android a adoção de fontes antigas.
6. **Dependências** com avisos sem upgrade compatível (BUG 13; não rebaixar Expo/RN, sem `audit fix --force`).
7. Limites conhecidos: atomicidade do lote entre abas Web independentes não comprovada; Reflow grande lento e consome memória (BUG 06);
   Community com backend aplicado em 12/11, sem homologação autenticada (ver item Community, Etapa 2); `FORENSIC` logs (≈50) atrás da flag `epubCenterResetDiagnostics`.
Áreas frágeis: `ReaderScreen.tsx`/`EpubReaderDocument.ts` (âncoras, ACK, geometria), `src/data/library/*` (outbox/CAS/epoch),
`LibraryOrganizationStore` (escrita única + CAS), cache Reflow (cancelamento durante gravação), `AccountBookRepository`/escopo de conta.

## 9. Regras de proteção (resumo; completo em AGENTS.md)

- **Git:** preservar untracked/modificados; sem reset/clean/stash/checkout para limpar; sem force push; sem troca de branch/merge/rebase
  sem pedido; stage por caminho. Commit só do que foi pedido; **push, deploy, migration, APK, instalação: só com pedido explícito**.
- **Aparelho (Redmi):** não desinstalar, não limpar dados, não instalar APK com assinatura incompatível por cima, não reduzir
  `versionCode`, não apagar livros/fontes/contas, não publicar nova Beta sem autorização; confirmar assinatura/versão/package antes de
  qualquer substituição; restaurar configurações temporárias do aparelho ao encerrar. O certificado do APK Beta privado **não** é o do
  Redmi pessoal.
- **Migrations/Supabase:** migrations em `supabase/migrations` são imutáveis e podem já estar aplicadas — não reaplicar; consultar o remoto
  só com autorização e ferramenta já configurada; não alterar RLS/Auth/buckets/Storage sem escopo explícito.
- **Segredos/dados:** não ler `.env*`, `credentials.json`, keystores, tokens, bancos ou livros pessoais; não repetir valores em logs/respostas;
  testes usam fixtures isoladas; `Livros/`, APKs, ZIPs e `DesignIdeas*` não entram em commits de código.
- **IA externa:** não enviar livros/trechos a serviço de IA sem pedido e consentimento explícito do usuário final.

## 10. Log (mais recente primeiro; máx. 5 entradas, resto → docs/context/historico/)

### 17/11/2026 — Revisão para as betas públicas: dependências, banco, hospedagem (Claude)
- Pedido do dono: ajustar dependências e configurações (banco, hospedagem etc.) e revisar o necessário para iniciar o plano das betas públicas.
- `ae0ec82` patches do SDK 57 (`expo`, `expo-linking`, `expo-router`, `expo-sqlite`); audit 0 críticos / 3 altos (só SDK 58) / 6 moderados de build;
  typecheck, critical 130/130, export, library web e reader browser PASS. Precisa de APK novo.
- Plano de prontidão em `docs/context/legal-build-git.md` §17: 10 bloqueios (exclusão de conta ausente, controlador LGPD, SMTP/redirects, plano do
  Supabase, escopo restrito do Drive, moderação, @usuário, chave de assinatura, domínio/Vercel, estado das migrations), com o que é decisão do dono.
- BLOQUEADO: a sessão do Supabase no Chrome expirou; nada remoto foi lido nem alterado. Vercel não conferido (sem CLI nem sessão verificada).
- Banco conferido (só leitura, 17/11, a pedido do dono): estrutura das 13 migrations presente, RLS ligado em tudo, bucket igual à migration; ledger
  registra só 7 de 13. Auth: SMTP próprio desligado, 2 e-mails/hora, confirmação de e-mail ligada, Site URL `aldus://auth/callback`, redirecionamentos
  sem domínio fixo (só previews do Vercel). Detalhes em `docs/context/legal-build-git.md` §17 itens 3 e 10.
- Decisões do dono: Supabase gratuito na beta pequena; Drive com verificação do Google; @usuário com Upstash; ainda sem domínio (primeiro passo).
- Exclusão de conta ("Sim, começar"): IMPLEMENTADA só no projeto — tela `app/account/delete.tsx`, função `supabase/functions/account-delete`, migration
  `20261117120000_account_deletion.sql` (NÃO aplicada), testes `account-delete` e `account-delete-ui`, recurso `account-delete` na lista de entrega.
  Texto legal aprovado pelo dono e aplicado (Política §9, Termos §14, resumo; documentos v0.9 de 17/11).
- Implantação autorizada ("Sim, implantar"), pelo painel no Chrome "Browser 1" deste PC, projeto Kindle reader (ref confere com `.env.local`):
  migration `20261117120000` aplicada pelo SQL Editor (hash `c9724815…23ad2` conferido na página; catálogo mostra `ON DELETE CASCADE`; não entra no
  ledger); única referência restritiva restante a `auth.users`/`profiles` é `aldus_admin_members` (proposital). Função `account-delete` implantada pelo
  editor do painel como arquivo único (handler + `Deno.serve`, hash `4b1a68be…`), "Verify JWT" desligado como no `config.toml`. Sondas anônimas do PC:
  OPTIONS 204 com CORS, GET 405, POST sem sessão 401, sessão falsa 401 (prova que a função lê o Auth com as variáveis do servidor), frase errada 400.
  NÃO TESTADO: exclusão real de ponta a ponta (o dono decidiu pular o teste com conta descartável em 17/11), aparelho. PENDENTE: página web de pedido de exclusão (canal/domínio); APK novo.

### 16/11/2026 — Ajustes depois do teste do APK `268d62d` no Redmi (Claude)
- Relato do dono após instalar: "As texturas não funcionam, a animação ficou ruim, quero igual a do kindle, que inicia de baixo, algo fluido e
  bonito", "a marca do Aldus não deve ser opcional ao compartilhar o card" e "a opção de como passar página (rolagem ou padrão) deve ser uma
  configuração mais simples".
- `3cc23da` marca Aldus sempre no card (sem interruptor). `6f3c8bf` "Passar página: Virar páginas | Rolar para baixo" na primeira tela de Ajustes
  de leitura, uma escolha para EPUB, Leitura Livre e PDF Original (PDF fica em página única na rolagem); os campos "Leitura" antigos saíram.
  `cdd131b` textura: o caminho funcionava, mas o grão (até 8%, com ruído concentrado em 0,5) virava um tom quase liso; agora fibras + grão em bloco
  de 400 px, ruído espalhado por tabela e intensidade máxima por tema limitada pelo contraste do texto (4,6:1 no pior pixel).
  `0325795` "Folhear" virou dobra de página a partir do canto de baixo: cópia só do trecho visível por cima, destino por baixo, dobra/verso/sombra
  calculados por quadro (560 ms); voltar desdobra a página anterior; sem texto visível, desliza.
- VALIDADO (local): typecheck; `test:critical` 130/130; `test:reader:{browser,epub,reflow,study,settings}` PASS (cópia fiel ao texto visível, nenhuma
  camada sobrando, voltar também dobra); matriz de 125 layouts do painel PASS. Quadros da dobra e da textura capturados no Chrome.
- NÃO TESTADO: Redmi (fluidez da dobra, textura na tela, rolagem). Precisa de APK novo.
- 17/11, relato do dono: grifo falhando "da página 106 pra frente". `83f2dc6` endurece a seleção (restauração pendente não bloqueia, reserva por geometria,
  palavra não cruza bloco, pontas de seleção normalizadas) e cria `test:reader:highlight:web` (livro longo, falha na versão anterior). Ver GRIFO 01.
- Retorno do dono no APK `4e7ddbe`: "a animação ficou toda travada". Causa: a dobra recalculava `clip-path` e degradês por quadro sobre a página
  inteira (repintura a 60 fps). `841ae54`: mesma dobra só com transformações (contêiner girado recorta, verso espelhado, sombra em faixa fixa) em
  quadros-chave da Web Animations API (compositor). Trace no Chrome, uma virada: 132 Paint antes, 9 agora (só na montagem). Redmi NÃO TESTADO.

### 16/11/2026 — Leitura e compartilhamento, Fase E (fatias 2 e 3): rolagem contínua no EPUB e na Leitura Livre (Claude)
- Dono: "Seguir para EPUB". `0c31cf2`: Ajustes de leitura → Página → "Leitura" (Página a página · Rolagem contínua) para EPUB e Leitura Livre.
  O livro inteiro já está no documento, então as fatias 2 e 3 viraram uma: as colunas viram uma coluna vertical e as "páginas" passam a ser
  telas virtuais (rodapé, slider, progresso e marcas de capítulo continuam). Toda conversão âncora→página passa por `pageForRect`; na rolagem o
  trecho vai ao topo da tela, então Páginas ↔ Rolagem volta ao mesmo trecho. Rolagem do leitor informada 200 ms após parar (origem SCROLL);
  recálculo de layout não move a leitura; toque e pressionar vêm do documento (sem zonas de toque na rolagem).
- VALIDADO (local): typecheck; `test:critical` 130/130; as 8 suítes `test:reader:*` de navegador PASS; no documento real, Páginas → Rolagem com o
  mesmo trecho no topo (26058 → 26058), um relato por rolagem, "próximo" = uma tela, tipografia ida e volta no mesmo trecho; `export:web`; 35 recursos.
- Achado do caminho: na rolagem, imagens que estavam fora da tela no modo página carregam e podem deslocar páginas seguintes ao voltar; o leitor
  segue a âncora (sem efeito para quem lê), e o teste passou a voltar à referência pelo trecho, não pelo número da página.
- NÃO TESTADO: Android (rolagem e toque na WebView, livros grandes), TalkBack. O deslocamento dentro da tela não é salvo além da âncora do topo.

### 16/11/2026 — Leitura e compartilhamento, Fase E (fatia 1): rolagem contínua no PDF Original (Claude)
- Pedido do dono: "rolagem para baixo, contínua". Plano aprovado em 3 fatias: PDF Original → EPUB/Leitura Livre num capítulo → entre capítulos.
  `b2d35e0` fatia 1: Ajustes de leitura → Página (PDF Original) → "Leitura": Página a página (padrão) ou Rolagem contínua. Controlador literal
  `createPdfScroller` (`pdfScroll.ts`) compartilhado pela WebView do Android e pelo site: páginas empilhadas na largura, canvases só perto da
  área visível (os distantes são liberados), página do topo informada quando a rolagem para, toque sem arrastar mostra os controles, navegação do
  app sem eco. Sem zonas de toque na rolagem (engoliriam o gesto). Progresso continua por página (reabrir volta ao topo dela); ajuste local, não sincroniza.
- VALIDADO (local): typecheck; `test:critical` 130/130 (nova `pdf-scroll`); `test:reader:pdf:web` com pdf.js real em rolagem (abre na página 3,
  informa só a rolagem do leitor, toque × arrasto, volta ao modo página idêntico); `test:reader:{settings,browser}:web` PASS; `export:web`; 34 recursos.
- NÃO TESTADO: rolagem dentro da WebView no Redmi e memória em PDF longo. PENDENTE: fatias 2 e 3 (EPUB/Leitura Livre), que mudam o núcleo de
  posição do Reader; paradas para decisão do dono sobre a ordem (antes ou depois de homologar A–E1 no aparelho).

### 16/11/2026 — Leitura e compartilhamento, Fase D: virar página (Claude)
- Pedido do dono: animação de troca de página "com a página passando, igual o Kindle". `de31a33`: Ajustes de leitura → Página → "Virar
  página" (Sem animação · Deslizar, o de sempre e padrão · Folhear), EPUB e Leitura Livre. "Folhear" gira a página visível em 3D pela lombada
  (dobra, troca de lado, abre); decisão técnica: sem cópia da página, porque os capítulos dividem as mesmas colunas e copiar "só a página"
  exigiria copiar o livro a cada virada. A página só é confirmada no fim; toques rápidos agora acumulam (3 toques = 3 páginas) em todos os
  modos; reduzir movimento do sistema (Android e `prefers-reduced-motion`) força "Sem animação" sem mudar a escolha.
- Achado do caminho: o Windows deste PC está com animações desligadas e o Chrome reporta `reduce`; o teste de navegador agora emula as duas
  preferências. Também corrigidas duas regressões de TESTE das fases anteriores: a fixture de `test:reader:settings:web` devolvia `{}` para os
  módulos novos (painel quebrava ali desde a Fase A) e a seleção da Fase B falhava no `test:reader:reflow:web` (página sem palavra: SKIP explícito).
- VALIDADO (local): typecheck; `test:critical` 129/129 (nova `page-turn`); `test:reader:{browser,epub,reflow,settings,study,markings,pdf,concentration}`
  PASS; `export:web`; lista de entrega com 33 recursos. Quadros reais do "Folhear" capturados no Chrome.
- NÃO TESTADO: fluidez no Redmi (o "Folhear" usa 3D da WebView), arrastar a folha com o dedo (fora do escopo), PDF Original (troca como antes).

### 06/11/2026 — Entradas anteriores
- Fechamento UX/UI e Onboarding 1: ver `docs/context/historico/2026-11-06-ux-fechamento-e-onboarding-1.md`.
- Onboarding 2 (auditoria e reescrita do contexto): ver `docs/context/historico/2026-11-06-onboarding-2.md`.
- Redesign Fase 1 (fundação `src/ui`): ver `docs/context/historico/2026-11-06-redesign-fase-1.md`.
- Redesign Fase 2 (navegação e Descobrir): ver `docs/context/historico/2026-11-06-redesign-fase-2.md`.
- Redesign Fase 3 (Biblioteca com "+"): ver `docs/context/historico/2026-11-06-redesign-fase-3.md`.
- Redesign Fase 4 (Conta e Estudo): ver `docs/context/historico/2026-11-06-redesign-fase-4.md`.
- Redesign Fase 5 (moldura do Reader, 09/11): ver `docs/context/historico/2026-11-09-redesign-fase-5.md`.
- Revisão de qualidade, Etapa A e Onda 0 (09/11): ver `docs/context/historico/2026-11-09-qualidade-etapa-a-onda-0.md`.
- Revisão de qualidade, Onda 1 (09/11): ver `docs/context/historico/2026-11-09-qualidade-onda-1.md`.
- Revisão de qualidade, Onda 2 (09/11): ver `docs/context/historico/2026-11-09-qualidade-onda-2.md`.
- Revisão de qualidade, Onda 3 (09/11): ver `docs/context/historico/2026-11-09-qualidade-onda-3.md`.
- Revisão de qualidade, Onda 4 (09/11): ver `docs/context/historico/2026-11-09-qualidade-onda-4.md`.
- Revisão de qualidade, Onda 5 (09/11): ver `docs/context/historico/2026-11-09-qualidade-onda-5.md`.
- Dependências, patches do SDK 57 e APK de ensaio `6883532` (09/11): ver `docs/context/historico/2026-11-09-dependencias-sdk-57.md`.
- Redesenho, Etapa 1, painel de leitura e plano das 5 etapas (10/11): ver `docs/context/historico/2026-11-10-redesenho-etapa-1.md`.
- Redesenho, Etapa 2, título e avisos do Reader (10/11): ver `docs/context/historico/2026-11-10-redesenho-etapa-2.md`.
- Redesenho, Etapa 3, menu do livro (10/11): ver `docs/context/historico/2026-11-10-redesenho-etapa-3.md`.
- Redesenho, Etapa 4, Descobrir e Estudo (10/11): ver `docs/context/historico/2026-11-10-redesenho-etapa-4.md`.
- Redesenho, Etapa 5, deck/Plano/Community/estudo/Batalha (10/11): ver `docs/context/historico/2026-11-10-redesenho-etapa-5.md`.
- Melhorias, Onda A (11/11): ver `docs/context/historico/2026-11-11-melhorias-onda-a.md`.
- Melhorias, Onda B (11/11): ver `docs/context/historico/2026-11-11-melhorias-onda-b.md`.
- Melhorias, Onda C (11/11): ver `docs/context/historico/2026-11-11-melhorias-onda-c.md`.
- Melhorias, Onda D (11/11): ver `docs/context/historico/2026-11-11-melhorias-onda-d.md`.
- Plano de mercado, FASES 0 e 1 (11/11): ver `docs/context/historico/2026-11-11-plano-mercado-fases-0-1.md`.
- Plano de mercado, FASE 2 (11/11): ver `docs/context/historico/2026-11-11-plano-mercado-fase-2.md`.
- Acervo (etapas 1–3) e plano de mercado, FASES 3–5 (11/11): ver `docs/context/historico/2026-11-11-acervo-e-plano-mercado-fases-3-5.md`.
- Community, Etapa 2: grafo social (12/11): ver `docs/context/historico/2026-11-12-community-etapa-2.md`.
- Instruções para outras IAs (12/11): ver `docs/context/historico/2026-11-12-instrucoes-para-ias.md`.
- Verificação de segurança e backup desligado (15–16/11): ver `docs/context/historico/2026-11-15-verificacao-de-seguranca.md`.
- Aba Comunidade e lista de entrega obrigatória (16/11): ver `docs/context/historico/2026-11-16-aba-comunidade-e-lista-de-entrega.md`.
- Pendências antes do APK: OCR, FASE 3 e Clubes/Fóruns (16/11): ver `docs/context/historico/2026-11-16-pendencias-antes-do-apk.md`.
- Leitura e compartilhamento, Fase A: paletas e textura (16/11): ver `docs/context/historico/2026-11-16-leitura-fase-a.md`.
- Leitura e compartilhamento, Fase B: grifo (16/11): ver `docs/context/historico/2026-11-16-leitura-fase-b.md`.
- Leitura e compartilhamento, Fase C: card de trecho (16/11): ver `docs/context/historico/2026-11-16-leitura-fase-c.md`.
