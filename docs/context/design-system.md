# Design system e reformulação de UI (iniciada em 06/11/2026)

> Módulo de área. Ler antes de criar/alterar telas fora do documento do Reader. Estado e pendências
> continuam no [PROJECT_CONTEXT.md](../../PROJECT_CONTEXT.md) (§3, §5, §8).

## Decisões do usuário (06/11/2026)

- Reformulação **completa, do zero**: a refatoração de 23/10 em `DesignIdeas/aldus-refactor.bundle`
  (branch `refactor/arquitetura-design-system`, nunca integrada) é só inspiração, não base de código.
- Direção visual: **editorial calmo** — mesma identidade da landing (creme/verde-tinta/terracota), títulos
  serifados, muito espaço em branco, poucos cartões e bordas, uma ação principal por área.
- Fontes de livros: **aba "Descobrir"** (busca + catálogos + BibliON/MEC + "Minhas fontes" com
  "Adicionar fonte" visível no topo) **e** botão **"+" na Biblioteca** como atalho (Importar arquivo,
  Conectar Google Drive, Adicionar por link, Explorar catálogos).
- Acervo com risco autoral: tarefa separada (sessão própria), fora do redesign.

## Fases

| Fase | Escopo | Estado |
| --- | --- | --- |
| 1 | Fundação: `src/ui` (tokens + primitivos) e tokens semânticos de cor | IMPLEMENTADO (06/11) |
| 2 | Navegação: abas Biblioteca · Descobrir · Estudo · Conta; sidebar no desktop Web; tela Descobrir com fontes | IMPLEMENTADO (06/11) |
| 3 | Biblioteca: cabeçalho enxuto (título, busca, "+" e "⋯"), filtros em chips, "Continue lendo", `BookCard` | IMPLEMENTADO (06/11) |
| 4 | Conta/Ajustes e Estudo com `ListGroup`/`ListRow` | IMPLEMENTADO (06/11) |
| 5 | Moldura do Reader (cabeçalho/rodapé) — só visual, sem tocar motor/posições; painéis inalterados | IMPLEMENTADO (09/11) |

## Fundação (`src/ui`)

- `tokens.ts`: `space` (grade de 2/4), `radius`, `touchTarget` 44, `layout` (larguras `narrow` 640 /
  `content` 1120, `gutter` por largura, breakpoint de sidebar 768), `fontFamily` (serif: Literata→Georgia
  na Web, `serif` no Android), `typography` com **9 papéis** (`display`, `title`, `heading` serifados;
  `subheading`, `body`, `bodySmall`, `label`, `caption`, `overline` sem serifa), `elevation`, `motion`.
- Cores: continuam em `src/theme/tokens.ts` (`AppThemePalette`, via `useAppTheme()`), agora com
  `accentSoft`, `danger`, `onDanger`, `success`, `focus`. `scripts/test-app-design.cjs` exige AA (4,5:1)
  para texto/ação/chip selecionado/danger/success e 3:1 para foco, nos temas claro e escuro.
- Primitivos: `AppText` (prop `variant`, não `role`: `role` é ARIA no RN), `Button` (primary/secondary/
  ghost/danger, loading, block), `IconButton` (label obrigatório), `Chip`/`ChipRow`, `ListGroup`/`ListRow`,
  `Screen`/`ScreenHeader`/`Section`, `EmptyState`, `ActionMenu` (folha no celular, cartão no desktop;
  fecha antes de executar), `SearchField`. Contrato em `scripts/test-ui-primitives.cjs` (no `test:critical`).
- Literata ainda **não** está empacotada: na Web cai para Georgia; no Android, `serif`. Adicionar o arquivo
  da fonte (OFL) exige autorização do usuário para baixar/instalar.

## Regras para as próximas fases

- Telas novas usam `src/ui`; nada de `fontSize`/hex/raio soltos. Componentes antigos (`AppAction`,
  `AppHeading`, `SettingsLayout`) são migrados tela a tela e removidos quando sem uso.
- Um `primary` por área; ícone sozinho sempre com `label`; seleção não só por cor; alvos ≥ 44.
- `Pressable` sempre com estilo **estático** (nunca `style={({ pressed }) => …}`): com NativeWind (css-interop) o estilo-função
  empilhou conteúdo no Android físico. Feedback de toque via `android_ripple`. `test-ui-primitives` verifica `src/ui` e telas migradas.
- `overline` não força caixa alta: o texto escrito é o texto lido (testes Chromium usam `innerText`).
- Não remontar o documento do Reader, não mexer em geometria/âncoras/posições ao reestilizar.
- Suítes que conferem textos/estrutura atuais (`test:library:web`, `test:source-library:browser`,
  `test-library-ui`, `test-source-ui`, `test-saas-ui`, `test-flashcard-ui`) devem ser atualizadas junto,
  sem afrouxar o comportamento verificado.

## Paletas e plano de leitura e compartilhamento (16/11/2026)

- **Paletas do app** (`src/theme/tokens.ts`): `classic` (o `appThemeTokens` original, intocado), `petroleum` (Moderno · Petróleo) e
  `ink` (Moderno · Azul-tinta), cada uma claro/escuro com o conjunto completo de tokens e o mesmo contrato de contraste
  (`scripts/test-app-design.cjs`). Escolha no aparelho em `@aldus/app-palette.v1`, independente do modo claro/escuro. Tela: Conta →
  Tema do aplicativo, grupo "Paleta" (bolinhas de prévia, seleção por contorno + negrito + ✓).
- **Reader**: o tema do livro (fundo/texto) é do leitor e não muda; os controles usam o destaque da paleta via `readerChromePalette`, só
  quando mantém 4,5:1 sobre o fundo e o painel do livro. O documento do livro não recebe `accent`.
- **Cor nova em tela**: sempre por token. Exceções conscientes: página do PDF (branca), cores de grifo, marcas brancas sobre capas/véus, o
  painel do OCR sobre véu escuro fixo e os indicadores antes dos provedores montarem.
- **Textura de papel** (`src/domain/reader/paperTexture.ts`): grão SVG próprio em `data:`, nunca imagem de terceiros. Opacidade limitada
  para o texto do livro manter 4,5:1 no pior pixel; aplicada só por `updateSurface` (fundo do viewport), nunca pela tipografia.
- **Plano aprovado** (ordem): A paletas + textura (feito: `f0215f7`, `fcde063`, `986f099`, `1aca293`); B grifo (captura por mudança da
  seleção, pop-up próprio, gestos suspensos durante a seleção); C card de trecho 9:16/1:1/4:5 desenhado em canvas na WebView, envio por
  `expo-sharing` (aprovado e feito em 16/11: `9e5b2ad`), 400 caracteres, nunca o arquivo; D "Sem animação/Deslizar/Folhear" com reduzir movimento (feito em 16/11: `de31a33`);
  E rolagem contínua por fatias (PDF Original → EPUB em um capítulo → entre capítulos), posição gravada só ao parar.
