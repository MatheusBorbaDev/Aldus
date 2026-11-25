# Aldus Reader — Contexto do Projeto

**Para que serve:** ser a ÚNICA leitura de entrada de qualquer tarefa. Em vez de explorar o projeto, leia este arquivo, ache a área
no **mapa (§5)** e abra direto os arquivos indicados. Se o mapa estiver errado ou faltar uma área, corrija-o na mesma tarefa.
Reescrito em 25/11/2026 (HEAD `e6a1429`) a pedido do dono; o texto anterior (estado de 06/11, matriz, log até 23/11) está
integral em `docs/context/historico/2026-11-25-project-context-ate-23-11.md`.

Bugs ativos: [BUGS_ATUAIS.md](BUGS_ATUAIS.md). Regras e limites: [AGENTS.md](AGENTS.md). Detalhes por área: `docs/context/*.md`
(só a seção que o mapa citar). Confiança: código/Git > este arquivo > `docs/context/*` > `docs/context/referencias/` (hipótese).

## 1. Protocolo de cada tarefa (economia de leitura)

1. `git status --short` e `git log --oneline -3`. Preserve o que não é seu; stage só por caminho.
2. Leia este arquivo. Ache a linha do mapa (§5) e abra **só** os arquivos dela. Arquivo grande (> 500 linhas, marcados com ⚠ no
   mapa): `rg -n "<símbolo>"` primeiro e leia só o bloco. Não use `find`/listagens amplas, nem abra `docs/context/` inteiro.
3. Edite o mínimo; valide (§6). Nunca declare PASS sem ter executado.
4. **Atualize este arquivo em TODA alteração de código, no mesmo commit:**
   - arquivo novo, removido, renomeado ou recurso novo → linha do mapa §5 (caminho + símbolo de entrada + teste);
   - mudou o estado (versão, produção, APK, pendência) → §3 e §7;
   - uma entrada no topo do log §9, **no máximo 3 linhas**; ao passar de 5 entradas, mova a mais antiga para
     `docs/context/historico/AAAA-MM-DD-<tema>.md` (sem editar). Detalhe longo vai para o módulo da área em `docs/context/`.
   - Bug novo/resolvido → BUGS_ATUAIS.md.
5. Resposta em pt-BR com IMPLEMENTADO / VALIDADO / PARCIAL / PENDENTE / NÃO TESTADO / INCONCLUSIVO / BLOQUEADO.

Não criar outros arquivos de contexto/handoff. `scripts/test-legal.cjs` exige que este arquivo mantenha o tratamento técnico de
Batalha + Supabase (§4). `node scripts/validate-ai-instructions.cjs` ao editar AGENTS.md/skills.

## 2. Produto e stack

Leitor EPUB/PDF e estudo, Android + Web (PC e celular), pt-BR. `aldus-reader` 1.0.0-beta.2, Android `com.aldus.reader`,
**versionCode 18** (`app.json` e `android/app/build.gradle`). Expo ~57, React Native 0.86, React 19, expo-router, Zustand,
expo-sqlite, WebView, pdfjs-dist, jszip; UI com StyleSheet + `src/ui` + `src/theme`. TypeScript ~6, Node 24. iOS não é alvo.
Backend: Supabase (Auth, Postgres/RLS, Storage, Edge Functions `username-login` e `account-delete`). Web (landing + app Web, um só
export estático em `dist/`): hoje Vercel, projeto `kindle-reader` (sem Git; deploy pela CLI) em https://kindle-reader-two.vercel.app;
**migração para a Cloudflare em andamento** (Worker só com arquivos estáticos, `wrangler.jsonc`, deploy pelo Git; domínio
registrado `aldusreader.com.br`). A Vercel fica no ar até o dono validar a Cloudflare. Git: `origin` = `MatheusBorbaDev/Aldus`, `main`
(transferido de `matheusbitlab` em 25/11 a pedido do dono, junto com `aldus-downloads`; o Aldus não usa mais a conta bitlab).
Persistência (não renomear `kindle-*`/`@kindle/*`): SQLite `kindle-reader.db` (migrations em
`src/data/database/migrations/MigrationRunner.ts`), IndexedDB `kindle-reader-web` (`src/data/database/connection/webLibraryStore.ts`),
AsyncStorage; flashcards `@kindle/flashcards.v1:<UUID>` / `kindle-flashcards.db` / IndexedDB `kindle-flashcards`.

## 3. Estado atual (25/11/2026)

- Produção Vercel = `f6967e6` (landing "A prensa"). Cloudflare: configuração no repositório (25/11), testada só localmente
  (`wrangler dev`). Zona `aldusreader.com.br` criada na Cloudflare (plano Free) e nameservers trocados no Registro.br em 25/11
  (`cruz`/`lex.ns.cloudflare.com`; propagação pendente). Worker ainda NÃO criado (ver §7).
- Último APK: **v18** `4a0cc73`, chave do dono (`CN=Aldus Reader`, `a8ee8ec1…`), em `G:\Meu Drive\Aldus APK\Aldus-1.0.0-beta.2-18-4a0cc73.apk`.
  Lista de entrega: 74 recursos (`scripts/verify-release-features.cjs`). `test:critical`: 144 suítes.
- Aparelhos: Redmi 23117RA68G e Note 14 (Android 16), só por USB. Nada de v13 a v18 foi exercitado num aparelho por mim, salvo o
  toque longo nas bordas (v14, confirmado pelo dono no Note 14).
- Supabase "Kindle reader" (`cmivracxuihtmsbmtuec`): todas as migrations de `supabase/migrations` aplicadas (várias pelo SQL Editor,
  fora do ledger); `username-login` publicada com Upstash. Acesso só pelo painel no Chrome, com autorização.

## 4. Arquitetura e invariantes

Camadas: `app/` (rotas) → `src/presentation` (telas, componentes, hooks, contextos, stores) → `src/domain` (regras puras, tipos,
usecases) → `src/data` (SQLite/IndexedDB, importadores, Sync, Supabase, Drive, catálogo). Verticais: `src/community`, `src/admin`.
**Composição única:** `src/presentation/services/dependencies.ts` (repositórios por plataforma → escopo de conta → outbox →
`LibrarySyncService`). Não crie persistência/Sync paralelos. Arquivos `.web`/`.native` são implementações separadas: leia as duas.
Providers em `app/_layout.tsx`: AppTheme → SafeArea → Auth → ReaderSettings; `AuthGuard` protege as rotas privadas.

Invariantes (violar = regressão):
- EPUB, PDF Original e PDF Reflow ("Leitura Livre") têm posições próprias; controles/tema/fonte/brilho não remontam o documento
  nem salvam posição transitória. Restauração só após `layoutReady` + ACK. Mudar largura volta à âncora lógica, não ao nº da página.
- Âncora `missing`/`ambiguous` → aviso, nunca salto silencioso. IndexedDB: sucesso só em `transaction.oncomplete`.
- Preservar cancelamento/gerações, tombstones, CAS, recibos idempotentes e outbox durável; conta A≠B; A→B→A exige epoch.
- Helpers enviados à WebView são código literal (o `Function.toString` do Hermes não serve).
- Livro sem arquivo (`kind: "record"`) sincroniza só com a migration `20261118120000_record_books` (aplicada).
- Batalha de Flashcards só envia o deck escolhido ao Supabase quando habilitada (RPC `public.flashcard_battle`, pontuação e
  gabarito no servidor); estudo individual é local. Tratamento legal em `docs/context/legal-build-git.md`.
- NÃO INVENTAR DADOS (sem fonte → `null`). Sem instrumentação, serviço pago ou envio de livros a IA sem pedido.

## 5. Mapa: onde fica cada coisa

Caminhos conferidos no disco em 25/11/2026. `comp/` = `src/presentation/components/`; `dom/` = `src/domain/`; `data/` = `src/data/`.
Teste = `scripts/test-<nome>.cjs` (quais estão no `test:critical`: lista em `scripts/test-critical.cjs`). ⚠ = arquivo grande: use `rg -n`.

### Leitor
| Recurso | Comece por | Também | Teste |
| --- | --- | --- | --- |
| Tela do leitor (abre livro, restaura, controles, painéis) | `src/presentation/screens/ReaderScreen.tsx` ⚠ 1.4k | `comp/reader/DocumentReaderAdapter.tsx`, `comp/ReaderControls.tsx`, `comp/ReaderContent.tsx`, `app/reader/[bookId].tsx` | reader-screen, `test:reader:browser` |
| Documento EPUB/Reflow na WebView (paginação, colunas, toque, busca, seleção) | `comp/EpubReaderDocument.ts` ⚠ 1.2k (script literal) | `comp/EpubPageViewer.{web,native}.tsx`, `comp/EpubPageViewerProps.ts`, `comp/ReaderAnchorDocument.ts` | reader-browser, `test:reader:epub:web` |
| Âncoras e progresso | `dom/types/readingAnchor.ts`, `dom/types/readerLocation.ts` | `dom/usecases/UpdateReadingProgressUseCase.ts`, `dom/reader/readerNavigationPolicy.ts` | reading-anchors, reader-location |
| **Grifo**: toque longo, arrastar, pop-up de cores/nota/card | pop-up: `comp/reader/HighlightSelectionPopup.tsx`; gesto no documento: `EpubReaderDocument.ts` (`longPress`, `studyDragTo`) | zonas de toque `comp/reader/ReadingTouchZones.tsx` (`textGesture`), ligação em `ReaderScreen.tsx` (`rg -n "studyDragTo\|HighlightSelection"`) | highlight-popup, `test:reader:highlight:web`, `test:reader:reflow-highlight:web` |
| Grifos/marcadores salvos, painel de marcações | `comp/StudyPanelControls.tsx`, `comp/StudyHighlightsPanel.tsx`, `comp/StudyBookmarksPanel.tsx` | `dom/usecases/Study{Highlights,Bookmarks}.ts`, `data/repositories/Sqlite{Highlight,Bookmark}Repository.ts`, `IndexedDbRepositories.ts`, fixados `dom/study/pinnedHighlights.ts` | study-storage, pinned-highlights, `test:reader:markings:web` |
| Todas as anotações | `src/presentation/screens/AllAnnotationsScreen.tsx`, `app/annotations.tsx` | `dom/study/allAnnotations.ts` | all-annotations |
| Card de trecho (compartilhar imagem) | `comp/reader/QuoteCardModal.tsx` | `dom/reader/quoteCard.ts`, `comp/reader/QuoteCardCanvas.{web,native}.tsx`, `src/presentation/services/shareQuoteCard.{web,native}.ts` | quote-card, quote-card-modal |
| Cartão de foco / marcos de leitura | `comp/reader/FocusCardModal.tsx`, `comp/reader/ReadingMilestonesModal.tsx` | `dom/reader/focusCard.ts`, `dom/reader/readingMilestones.ts`, `data/local/ReadingMilestoneStore.ts` | focus-card, reading-milestones |
| Tempo por página e para terminar (rodapé) | `dom/reader/readingPace.ts` | `src/presentation/hooks/useChapterTimeLeft.ts`, `comp/BottomFooter.tsx` | reading-pace |
| Sessão de leitura / Diário e calendário | `src/presentation/hooks/useReadingSession.ts`, `src/presentation/screens/ReadingDiaryScreen.tsx` | `dom/reader/readingSession.ts`, `dom/reader/readingDiary.ts`, `comp/ReadingCalendar.tsx`, `data/local/ReadingSessionStore.ts`, `app/diary.tsx` | reading-session, reading-diary |
| Busca no livro | `EpubReaderDocument.ts` (`rg -n "window.find"`) | botão em `comp/TopHeader.tsx` e `comp/ReaderSettingsPanel.tsx` | reader-search |
| Ajustes de leitura (fonte, tema, margens, "Ocultar porcentagem") | `comp/ReaderSettingsPanel.tsx` | `src/presentation/contexts/ReaderSettingsContext.tsx`, `comp/ReaderSettingsSlider.tsx`, tema automático `dom/reader/readerThemeAuto.ts` | reader-settings, `test:reader:settings:web` |
| Virar página (sem animação/deslizar/folhear) | `dom/reader/pageTurn.ts` | `updateMotion` em `EpubReaderDocument.ts`, `src/presentation/hooks/useReduceMotion.ts` | page-turn |
| Textura de papel e paletas | `dom/reader/paperTexture.ts`, `src/theme/tokens.ts` (`appPalettes`, `readerChromePalette`) | `updateSurface` em `EpubReaderDocument.ts`, `src/presentation/contexts/AppThemeContext.tsx`, `app/preferences.tsx` | paper-texture, app-design |
| Rolagem contínua (PDF Original) | `dom/reader/pdfScroll.ts` (`createPdfScroller`) | `comp/PdfPageViewer.{web,native}.tsx` | pdf-scroll, `test:reader:pdf:web` |
| PDF Original | `comp/PdfPageViewer.{web,native}.tsx` | `comp/pdfjsRuntime.web.ts`, `comp/pdfjs.worker.ts`, `comp/PdfModeChooser.tsx` | `test:reader:pdf:web` |
| Leitura Livre (PDF Reflow), prévia, OCR | `comp/PdfReflowProcessor.{web,native}.tsx`, `data/local/PdfReflowDocumentBuilder.ts` | `comp/reader/PdfReflowPreviewReader.tsx`, `data/local/{pdfReflowPreview,pdfReflowQuality,reflowSerialization,pdfOcr.native}.ts`, `comp/reflowOperation.ts`, cache `data/repositories/*PdfReflowCacheRepository.ts`, `modules/aldus-pdf-ocr` | pdf-reflow, reflow-preview, reflow-assembly-scaling, `test:reader:reflow:web` |
| Duas páginas e painéis laterais no PC | `EpubReaderDocument.ts` (`reader-spread`, `updateTypography`) | `src/presentation/layout/{formFactor,desktopSheet}.ts` | desktop-layout, `test:desktop:web` |
| Ler em voz alta | `src/presentation/hooks/useReadAloud.ts` | `dom/reader/speechText.ts` | read-aloud |
| Brilho e motion cues | `src/presentation/hooks/useNativeReaderBrightness.ts`, `comp/MotionCues{Control,Overlay}.tsx` | `src/presentation/stores/motionCuesStore.ts` | native-brightness, motion-cues |
| HTML do livro (segurança, imagens) | `dom/reader/sanitizeBookHtml.ts`, `comp/ChapterRenderer.tsx` | | book-html-security |

### Biblioteca, catálogo e importação
| Recurso | Comece por | Também | Teste |
| --- | --- | --- | --- |
| Biblioteca (lista, filtros, busca vazia → catálogo, voltar ao topo) | `app/(tabs)/library.tsx` | `comp/BookCard.tsx`, `comp/BookCover.tsx`, `comp/bookCoverPresentation.ts`, `src/presentation/stores/libraryStore.ts`, `src/presentation/hooks/useLibrary.ts` | library-ui, `test:library:web` |
| Organizar, estantes, lote, "Quero ler", nota/resenha | `comp/BookOrganizationModal.tsx`, `comp/LibraryBulkModal.tsx` | `dom/usecases/OrganizeLibrarySelection.ts`, `dom/library/readingShelves.ts`, `data/local/LibraryOrganizationStore.ts` | book-organization-modal, library-organization, `test:library:bulk:web` |
| Biblioteca no PC (painel, Ctrl/Shift, soltar arquivo, barra lateral) | `comp/desktop/DesktopSidebar.tsx`, `comp/desktop/DesktopBookPanel.tsx` | `src/presentation/layout/desktopSelection.ts`, `comp/desktop/DesktopColumns.tsx` | desktop-layout, `test:desktop:web` |
| Catálogo / aba Descobrir (vitrine, sortear, ficha, Google Books) | `src/presentation/screens/CatalogScreen.tsx`, `app/(tabs)/search.tsx`, `app/catalog.tsx` | `dom/catalog/catalogShelves.ts` (`pickSurprise`), `data/catalog/{CatalogService,catalogSources,catalogLinking}.ts`, `comp/catalog/*` | catalog, catalog-records, discover-ui |
| Livro sem arquivo e progresso manual | `dom/catalog/recordBook.ts` | `dom/catalog/catalogLink.ts`, `comp/catalog/CatalogLinkPrompt.tsx` | catalog-records, record-books-sql |
| Importar EPUB/PDF (arquivo, "Abrir com", duplicados) | `data/imports/LocalBookImportService.ts`, `src/presentation/hooks/useBookImport.ts` | `comp/BookImportModal.tsx`, `data/epub/*`, `data/local/PdfFileImporter.ts`, `data/imports/ImportDuplicateService.ts`, `dom/library/incomingFile.ts`, `app/open-file.tsx`, `app/+native-intent.tsx`, hash nativo `modules/aldus-file-hash` | book-import, import-duplicates, open-with, file-hash |
| Importar Goodreads (CSV) | `src/presentation/screens/GoodreadsImportScreen.tsx`, `app/import/goodreads.tsx` | `dom/library/goodreads{Csv,Import}.ts`, `data/catalog/goodreadsImporter.ts` | goodreads-import |
| Capa padrão e capas | `dom/catalog/defaultCover.ts`, `comp/BookCover.tsx` | `src/utils/coverHelper.ts`, `src/presentation/services/PdfThumbnailGenerator.*` | book-covers, cover-thumbnails |
| Acervo embutido (domínio público) | `data/library/bundledCatalog.ts`, `data/library/bundledBookManifest.json` | `data/epub/BundledEpubCatalog.ts`, `data/imports/LegacyBundledReattachService.ts` | bundled-catalog, legacy-reattach |
| Sync da biblioteca / conta / outbox | `data/library/LibrarySyncService.ts` | `LibrarySyncCoordinator.ts`, `LibrarySyncPersistence.ts`, `LibraryLocalReplica.ts`, `AccountBookRepository.ts`, `SupabaseLibraryAdapter.ts`, `JournaledReadingData.ts`, `comp/LibrarySyncControls.tsx`, Web a cada 90 s `src/presentation/services/webPeriodicSync.ts` | `test:library:*`; ler `docs/context/biblioteca-sync.md` |

### Fontes, Drive, conta e demais telas
| Recurso | Comece por | Também | Teste |
| --- | --- | --- | --- |
| Google Drive (conectar, renovar, escolher pasta, atalhos) | `data/drive/GoogleDriveService.ts`, `data/drive/DriveAuthorization.ts` | `data/drive/{drivePlatformAuth,driveFolder,DriveDownloadResolver}.ts`, `comp/DriveFolderPicker.tsx`, `modules/aldus-drive-auth` (Kotlin) | `test:drive`, drive-renewal, drive-folder-picker; `docs/context/sources-drive.md` |
| Suas fontes / catálogos OPDS | `comp/SourceLibraryScreen.tsx`, `app/sources/*` | `data/sources/*`, `data/scraping/*`, `src/presentation/hooks/useSource*.ts`, `comp/catalog/YourSources.tsx` | source-ui, `test:source-library:browser` |
| Login, cadastro, Google, username | `src/presentation/contexts/AuthContext.tsx`, `comp/AuthForm.tsx` | `data/remote/auth*.ts`, `dom/auth/authRules.ts`, `app/auth/*`, `supabase/functions/username-login` | auth, `test:auth:web`; `docs/context/auth.md` |
| Conta, excluir conta | `app/account/*` | `data/remote/accountDeletionService.ts`, `dom/account/accountDeletion.ts`, `supabase/functions/account-delete` | account-delete |
| Ajustes, preferências, versão | `src/presentation/screens/SettingsScreen.tsx`, `app/(tabs)/settings.tsx`, `app/preferences.tsx` | versão/commit `src/legal/appMetadata.ts` | settings-navigation, preference-persistence |
| Abertura do app (frases), novidades, página da beta | `comp/AppLoadingScreen.tsx`, `comp/ReleaseNotesModal.tsx`, `app/beta.tsx` | `dom/brand/releaseNotes.ts`, `src/legal/beta{Feedback,Limitations}.ts` | release-notes, beta-preparation |
| Navegação, abas, design system | `app/(tabs)/_layout.tsx`, `src/ui/*` (`Screen` com `StatusBarScrim`) | `src/theme/{tokens,appUi}.ts`, `comp/{AppUi,SettingsLayout,TopHeader}.tsx` | ui-primitives, app-design; `docs/context/design-system.md` |
| Flashcards, Estudo, Batalha | `app/(tabs)/study.tsx`, `src/presentation/screens/FlashcardStudyScreen.tsx` | `dom/study/*`, `comp/flashcards/*`, `data/local/Flashcard*`, `data/remote/FlashcardBattleRepository.ts`, `app/battle.tsx`, `app/decks`, `app/study`, lembrete `src/presentation/services/reviewReminder.ts` | flashcards, flashcard-*; skill study-flashcards |
| Comunidade (perfil, pessoas, clubes, fóruns) | `src/community/presentation/*`, `app/community/*`, `app/(tabs)/community.tsx` | `src/community/{domain,application,data}/*`, migrations `*community*` | community-*; `docs/context/community-estudo.md` |
| Planos/cotas e Admin | `src/domain/saas/*`, `app/plan/*`, `src/admin/**`, `app/admin/index.tsx` | `data/saas/SupabaseAccountPlanRepository.ts` | saas-*, admin-* |
| Textos legais | `src/legal/legalContent.ts`, `app/legal/*` | `src/legal/{legalConfig,thirdPartyNotices.generated}.ts`, `comp/legal/LegalDocumentScreen.tsx` | legal (mostrar texto ao dono antes) |

### Site e entrega
| Recurso | Comece por | Também | Teste |
| --- | --- | --- | --- |
| Landing (abertura "A prensa", rolagem, medalha) | `src/marketing/LandingDocument.tsx`, `src/marketing/PressHero.tsx` | `pressStyles.ts`, `landingStyles.ts`, `AldusMedal.tsx`, `aldusProfilePath.ts`, `landingScrollEffects.ts`, `seo.ts`, `app/index.web.tsx`, fontes `public/fonts`, script do `<head>` em `scripts/write-public-web.cjs`; histórico `LANDING_PAGE_CONTEXT.md` | `test:marketing`, `test:marketing:web` |
| Build Web e deploy | `package.json` (`export:web`), `scripts/write-public-web.cjs` (landing pré-renderizada em `index.html`, app em `app.html`) | `scripts/{validate-web-env,write-build-metadata}.cjs`; Vercel: `vercel.json`, `.vercelignore`; Cloudflare: `wrangler.jsonc`, `scripts/write-cloudflare-assets.cjs` (gera `dist/_headers` a partir do `vercel.json` e `dist/_redirects` a partir de `app/`) | web-build; `test:marketing:web` aceita `LANDING_WEB_ORIGIN` (ex.: `wrangler dev`) |
| APK e versão | `scripts/build-apk-local.mjs` (`npm run build:apk:archive`) | `app.json` + `android/app/build.gradle` (versionCode), `scripts/{release-signing.cjs,archive-commit-apk.mjs,create-signing-key.ps1}` | signing-key, android-build-command |
| Lista de entrega (todo recurso pedido entra aqui) | `scripts/verify-release-features.cjs` (`markers`, `androidMarkers`, `webMarkers`) | | release-features |
| Supabase (migrations, funções) | `supabase/migrations/*` (imutáveis) | `supabase/functions/*`, `supabase/{admin,audit,tests}` | skill backend-operations; **só com pedido** |

Áreas frágeis: `ReaderScreen.tsx`/`EpubReaderDocument.ts` (âncoras, ACK, geometria), `data/library/*` (outbox/CAS/epoch),
`LibraryOrganizationStore`, cache do Reflow.

## 6. Validação

Gates: `npm run typecheck`; `npm run test:critical` (ler a linha `N/N critical suites passed`; nunca `| tail` numa cadeia `&&`);
`npm run export:web`; `node scripts/verify-release-features.cjs --source` (e `--dist` após o export); `git diff --check`.
Suíte da área: a coluna "Teste" do mapa (`node scripts/test-<nome>.cjs` ou o `npm run` indicado). Chromium: `npm run setup:test-tools`.
Teste no PC não comprova Android físico, sessão real nem deploy.

## 7. Pendências

- **Cloudflare (painel do dono; decidido em 25/11: Worker só com arquivos estáticos, deploy automático pelo Git, Vercel no ar até
  validar):** (1) FEITO 25/11: zona na Cloudflare (Free; registros MX nulo/SPF/DMARC "sem e-mail" importados; "Bot Preference
  Sync" desligado para o `robots.txt` ficar igual) e nameservers no Registro.br; (2) Workers & Pages → importar `MatheusBorbaDev/Aldus`
  (app da Cloudflare só nesse repositório). Nome `aldus-reader`, build `npm run build`, deploy `npx wrangler@4.160.1 deploy`; (3) build
  variables: as 7 `EXPO_PUBLIC_*` da Production da Vercel, com `EXPO_PUBLIC_SITE_URL=https://aldusreader.com.br`; (4) testar no
  `*.workers.dev`; (5) domínio próprio no Worker; (6) Supabase Auth: URLs de retorno do domínio novo; (7) Google Cloud: domínio novo
  na marca do OAuth (e na chave do Books, se tiver restrição por site); (8) só então desligar a Vercel.
- **Aparelho (precisa de celular no cabo):** v13–v18 e a landing nunca vistas num celular; Drive não traz livros soltos fora de
  subpastas (não são atalhos; precisa de log); tocar na aba Biblioteca não volta ao topo no Android (`useScrollToTop` não rola).
- **Decisões do dono:** e-mail de cadastro do beta (senha de app do Gmail ou desligar confirmação); nome/e-mail do controlador
  (LGPD); renomear a URL da Vercel; moderação da Comunidade ou desligá-la; página de instruções e convite do beta; conta Android de
  distribuição limitada; importar do Skoob; leitor de ISBN pela câmera.
- **Planejado, sem pedido:** encaixe lateral que estreita a página no PC (exige redimensionar preservando a posição); fila de
  denúncias no Admin; catálogo A4/B3/D.
- Bugs ativos e bloqueios externos (BUG 02, 03, 06, 08, 13, INSTALAÇÃO 01, GRIFO 01): ver BUGS_ATUAIS.md.

## 8. Regras de proteção (resumo; completo em AGENTS.md)

- Git: preservar o que não é seu; sem reset/clean/stash/force push; stage por caminho.
- Rotina de entrega autorizada pelo dono (19/11): versionCode +1, `npm run build:apk:archive`, cópia em `G:\Meu Drive\Aldus APK`,
  varredura de segredos, push, deploy na Vercel. Mudança só do site dispensa APK. Migrations, Auth, RLS e painéis remotos: só com pedido.
- Aparelho: não desinstalar, não limpar dados, não reduzir versionCode, não instalar assinatura incompatível por cima.
- Segredos: não ler `.env*` (só nomes de chave), keystores nem a senha da chave; nunca digitar senha/código; sem valores no chat/Git.

## 9. Log (mais recente primeiro; máx. 5 entradas de até 3 linhas)

- **25/11** — Cloudflare: o site já é estático (Expo export, sem SSR/API). `wrangler.jsonc` + `write-cloudflare-assets.cjs`
  (`_headers`, `_redirects` das 23 rotas → `/app`); `validate-web-env`/`build-info` reconhecem o Workers Builds. `wrangler dev` local:
  rotas, cabeçalhos e `test:marketing:web` inteiro PASS. NÃO publicado; Vercel intacta. Passos do dono em §7.
- **25/11** — Dono pediu contexto enxuto com mapa de localização. Este arquivo foi reescrito: mapa por recurso (§5), estado e
  pendências atuais, regra de atualizar em toda alteração; versão anterior arquivada em `historico/2026-11-25-project-context-ate-23-11.md`.
- **23/11** — Landing "A prensa" (`570bdad`, `f6967e6`): abertura com medalha, tipos e livro; EB Garamond própria; 3D e three.js
  removidos. Produção `f6967e6`. NÃO TESTADO em celular. Detalhes em `LANDING_PAGE_CONTEXT.md`.
- **23/11** — v18 `4a0cc73`: rodapé com tempo por página e para terminar o livro (`dom/reader/readingPace.ts`).
- **23/11** — v15–v17: arrastar para estender o grifo (`5d236c5`); módulo PC em 5 fases (barra lateral, painel, duas páginas,
  sync 90 s, colunas); largura volta à âncora (`1cba202`); `StatusBarScrim`.
