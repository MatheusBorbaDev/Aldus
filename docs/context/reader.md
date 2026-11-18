# Reader — EPUB, PDF Original e PDF Reflow

> Módulo de referência. Ler antes de mexer em Reader, âncoras, Reflow ou controles.
> Texto preservado do PROJECT_CONTEXT.md original (2192 linhas, escrito pelo Codex), movido sem reescrita em 06/11/2026. Trate como hipótese: confira Git/código antes de confiar. O estado atual e as pendências estão em [PROJECT_CONTEXT.md](../../PROJECT_CONTEXT.md).

## 3. Reader

ReaderScreen abre pelo OpenBookUseCase; DocumentReaderAdapter escolhe EPUB, PDF Original
ou PDF Reflow. EPUB usa EpubPageViewer.web/native e o documento combinado
EpubReaderDocument, em iframe sandboxed na Web e WebView no Native. O HTML é memoizado
pela lista de capítulos; configurações tipográficas chegam por mensagem, sem recriar o viewer.

PDF Original usa o arquivo fonte e página/zoom próprios. Reflow é derivado separado,
criado somente por escolha, com extração por plataforma, builder, assinatura do arquivo,
versão de processador e cache validado. Falha/extração ilegível/OCR insuficiente volta ao
Original. Não confundir página fonte do PDF com paginação dinâmica do Reflow.

Restauração retém intenção persistida até layoutReady e ACK do destino; mensagens
provisórias não salvam posição. O documento vivo passa a conduzir navegação após ACK.
Original/Reflow mantêm posições independentes. Gravação confirmada é direta, sem debounce
que descarte o último avanço ao sair; updates funcionais preservam as configurações atuais.
Barra distingue preview de commit; origem/operação descartam mensagens ultrapassadas.
Página 1 legítima não pode ser bloqueada por filtro global. Largura de coluna é fracionária,
medida por getBoundingClientRect, e totais usam fragmentos reais para evitar coluna fantasma.

Controles são overlays estáveis: visibilidade muda opacidade/interatividade, sem trocar
ancestralidade, key ou viewport documental. Insets de Safe Area são aplicados uma vez;
wrappers absolutos têm limites completos. No Native, controles usam View/opacidade literal
no caminho já validado, conservando a animação Web. Helpers enviados a WebView são código
literal portátil: Function.toString de Hermes não é fonte JavaScript.

AppThemeContext e ReaderSettingsContext são separados. Temas do livro incluem Papel,
sépia/claros/escuros; e-reader é atalho de aparência, não emulação de hardware e-ink.
Brilho Web é luminosidade da página; Native aplica/restaura brilho da sessão e respeita
AppState/cleanup. Tema/fonte/brilho não comandam restauração nem remontam documento.

Preparação Reflow permanece cancelável até confirmar cache e preparar HTML. Plano OCR,
qualidade, builder, conversão de blocos/HTML e serialização SQLite cooperam em fatias de
CPU; Native usa idle com prazo e não setImmediate/microtasks. O cache usa record.id como
bookId no guard de conta, transação exclusiva SQLite e oncomplete IndexedDB, sem sucesso
em memória. Cancelar durante gravação faz rollback antes do commit; cache confirmado
anterior não é apagado. Retorno antigo não publica após Back/troca de modo/livro/unmount.
Leitura geométrica e WebView/base64 da extração são liberados antes da fase final.
Assinatura do cache é SHA-256 do conteúdo, inclusive antes do primeiro upload atribuir
fileHash ao livro. Quando ausente, localFingerprint reutiliza o driver/hash em blocos,
somente leitura, com conta/abort; não grava metadata nem altera fila. Primeira sincronização
não invalida o mesmo derivado. Budget de CPU usa relógio monotônico, não relógio civil.
JSON.parse do cache, clone IndexedDB, flatten final e primeiro layout continuam tendo
custo proporcional ao documento; não prometer suporte ilimitado ou validação Android.

EPUB possui marcadores/notas, grifos/cores/comentários, seleção e export/import por livro.
Âncoras exact/relocated permitem retorno; ambiguous/missing exigem aviso e nunca navegação
silenciosa. Importação de estudo é transacional/idempotente. PDF Original tem marcador
por página; seleção/grifos mapeados entre PDF e Reflow ainda não equivalem ao suporte EPUB.

Motion cues é experimental/manual, desligado por padrão. DeviceMotion Android, preferência
reader.motionCues.enabled, processamento em memória e overlay pointerEvents=none acima do
Reflow. Hidratação/foco/foreground/permissão controlam sessão e cleanup; não simular sensor
indisponível. Amostras não mudam documento/progresso. Eficácia anti-enjoo não foi demonstrada.

## Plano de mercado — FASE 3 (planejamento, 11/11/2026)

**16/11/2026**: A1, A2, B1, B2 e C implementados (C compartilha texto: a imagem exigiria `react-native-view-shot`, não aprovado). A2 abre o
livro, não a âncora (o Reader só recebe `bookId` pela rota). A3, A4, B3 e D seguem só planejados. Ver log do PROJECT_CONTEXT.

Tamanho: **P** ≤ 1 dia, um commit; **M** 2–4 dias, 2–4 commits com teste; **G** > 1 semana ou exige aparelho/servidor/dependência nova.
Regras herdadas: números só medidos e ocultáveis; sem streak punitivo, ranking ou comparação; dizer o que é só Android; nada que
envie arquivos de livros a outras pessoas.

**A. Pacote de anotações** (base existente: grifos EPUB em 5 cores, notas, busca, filtro por cor, export/import por livro; PDF não equivale).
- A1 Fixar trechos (**P/M**): campo `pinned` no grifo, fixados no topo do painel e no início do livro. Exige campo novo no payload de Sync
  dos grifos (compatível: ausente = não fixado) e teste de âncora/escopo de conta.
- A2 "Todas as anotações" entre livros (**M**): lista e busca sobre `highlightRepository`/`bookmarkRepository` de todos os livros da conta;
  abrir leva à âncora (missing/ambiguous com aviso, nunca navegação silenciosa).
- A3 Grifos na Leitura Livre do PDF (**M/G**): reaproveitar a seleção do documento EPUB (Reflow usa o mesmo iframe); âncora por capítulo
  derivado + assinatura SHA-256 do cache. PDF Original continua só com marcador por página (grifo no PDF Original = **G**).
- A4 Anotar/desenhar sobre o texto (**G**, só Android no MVP): camada de traço por página paginada; quebra com repaginação (fonte, margem),
  por isso precisa de âncora própria. Recomendo adiar para depois de A1–A3.

**B. Diário de leitura** (base: sessões medidas da FASE 2, só no aparelho e por conta; `readingStatus`; `addedDate`).
- B1 Tela Diário (**M**): sessões por dia e por livro com minutos ativos medidos; tudo ocultável; sem "dias seguidos", metas diárias
  ou comparação. Livros sem sessão aparecem sem número (nunca zero inventado).
- B2 Exportar CSV no padrão Goodreads (**P/M**): colunas `Title, Author, ISBN, ISBN13, My Rating, Number of Pages, Date Read, Date Added,
  Bookshelves, Exclusive Shelf, My Review, Private Notes`. Preenchidas só com dado real: Title, Author, Date Added (`addedDate`),
  Exclusive Shelf (`unread`→to-read, `reading`→currently-reading, `completed`→read; `interrupted` fica em Bookshelves). Date Read
  só se houver data de conclusão medida (hoje não há: fica vazio); ISBN só se o EPUB declarar; avaliação/resenha vazias. Arquivo gerado
  no aparelho pelo compartilhamento do sistema; não inclui arquivos de livros.
- B3 Sessões no Sync (**M**, servidor): hoje são só locais. Exige tabela/payload novos e autorização de schema remoto.

**C. Cartão compartilhável de foco** (**M**; dependência nova de captura de imagem, p.ex. `react-native-view-shot`, exige aprovação).
- Conteúdo: minutos ativos da sessão de foco (medidos). Título do livro só se a pessoa ligar. Sem ranking, sem comparação.
- Equivalências ("≈ N páginas"): **estimativa** rotulada, só com ritmo medido (`@kindle/reading-pace.v1`, mediana de ≥5 viradas);
  sem ritmo medido não aparece; interruptor para ocultar. Compartilha uma imagem, nunca o arquivo do livro.

**D. Catálogo "Onde ler"** (conversa de 11/11/2026, modelo Stremio): metadados de fontes abertas (Open Library/Google Books, conferir
termos), links para lojas e bibliotecas com direitos, e fontes adicionadas pela própria pessoa (**G**). Não serão integradas nem
pré-configuradas fontes de pirataria; preço e disponibilidade só quando a fonte informar.

Ordem sugerida: B1 → B2 → A1 → A2 → C → A3 → D → A4.

## Grifo: seleção e pop-up (Fase B, 16/11/2026)

- **Captura** (`ReaderAnchorDocument.ts`): por `pointerup` ou quando a seleção fica parada 650 ms (`selectionchange`), porque as alças
  nativas do Android não disparam `pointerup` no documento. Captura idêntica não é reenviada; o trecho é aparado de espaços.
- **Mensagens novas**: `studySelectAt` (x, y do contêiner da página → palavra inteira; ponto fora do texto é recusado com mensagem) e
  `studyAdjust` (`growStart`, `growEnd`, `shrinkStart`, `shrinkEnd`, `sentence`). Ambas mostram a seleção no documento e respondem
  com a âncora `epub-text` validada; nenhuma envia mensagem de página. `studySelection` desligado limpa a seleção.
- **App**: `ReadingTouchZones` converte o pressionar e segurar para coordenadas da página (mesmo contêiner da WebView);
  `HighlightSelectionPopup` grava com uma cor via `createStudyHighlight` (mesmo formato do painel), ajusta e passa a nota ao painel.
  Com o pop-up aberto as zonas de toque não existem. Só EPUB.
- **Próximo passo natural**: o card de trecho (Fase C) entra como ação do pop-up.

## Card de trecho (Fase C, 16/11/2026)

- **Regras** (`src/domain/reader/quoteCard.ts`): até 400 caracteres (decisão do dono; acima disso explica e não desenha), espaços colapsados,
  formatos Stories 9:16, Post 4:5 e Quadrado 1:1, modelos Papel/Claro/Noite/Destaque a partir das paletas do app, título/autor e marca ocultáveis.
- **Desenho**: `QUOTE_CARD_RENDERER` é fonte JavaScript literal (Hermes não dá fonte por `toString`). Android: `QuoteCardCanvas.native`
  (WebView invisível só para o canvas, sem rede e sem navegação, separada do documento do livro); site: canvas fora da tela. JPEG 0,9; respostas
  de desenhos antigos são ignoradas.
- **Envio**: Android grava o JPEG no cache do app e abre a folha do sistema com `expo-sharing` (sem botão direto de Stories, decisão do dono);
  site usa `navigator.share` com arquivo quando aceito, senão baixa a imagem. Só o trecho (e título/autor, se ligados) sai do aparelho.

## Virar página (Fase D, 16/11/2026)

- **Modos** (`src/domain/reader/pageTurn.ts`): `none`, `slide` (padrão, a transição de 0,24 s de sempre) e `flip`. A escolha fica nos
  ajustes de leitura; o app manda `updateMotion` já resolvido com o reduzir movimento do sistema (`useReduceMotion`), e o documento também
  respeita `prefers-reduced-motion`. Mudar o modo não refaz layout.
- **Folhear** (`flipToPage` no documento): gira o `#reader-viewport` em 3D (origem na lombada), troca o `translateX` quando a página está de
  lado e abre a nova. A largura é lida antes de girar. Um temporizador de 700 ms encerra a virada se `transitionend` não vier.
- **Invariantes**: a mensagem de página só sai no fim da virada (`finishNavigation`); toques durante a virada acumulam em `deferredPage`;
  nada fica girado depois. O PDF Original não usa estes modos.

## Rolagem contínua (Fase E, 16/11/2026)

- **Fatia 1, PDF Original (feita, `b2d35e0`)**: ajuste `flow` ("paged" | "scroll") nos ajustes do PDF por livro, local (não entra em
  `pdfPositionPayload`). `createPdfScroller` (fonte literal) empilha as páginas na largura, desenha só perto da área visível e libera as
  distantes (±3 da atual), informa a página do topo 220 ms depois de parar, separa toque de arrasto (< 10 px) e não ecoa a navegação do app
  (`goTo` suprime relatórios por 450 ms). Sem zonas de toque nesse modo. Progresso = página do topo; o deslocamento dentro da página não é salvo.
- **Fatias 2 e 3, EPUB e Leitura Livre (feitas juntas, `0c31cf2`)**: o livro inteiro já está no documento, então não há carga por capítulo.
  `html.reader-scroll` troca as colunas por uma coluna vertical; páginas = telas virtuais (`scrollPageFor`). Toda conversão âncora→página usa
  `pageForRect`; na rolagem `topForRect` põe o trecho no topo (Páginas ↔ Rolagem sem deriva). `updateFlow` guarda a âncora do topo, troca o
  layout e volta a ela (origem SETTINGS_LAYOUT, mesma âncora). Rolagem do leitor: relato 200 ms após parar, origem SCROLL, nova âncora.
  `goToPage` com LAYOUT_RECALC/SETTINGS_LAYOUT não move a rolagem. Sem zonas de toque: o documento envia `tap` (< 10 px) e `longPress`
  (500 ms parado); toques são ignorados com seleção armada. Imagens fora da tela no modo página carregam na rolagem e podem deslocar páginas
  ao voltar: a posição segue a âncora.

## Ajustes depois do teste no aparelho (16/11/2026)

- **Folhear = dobra de página** (`curlToPage`): `curlPageRange` acha o intervalo do primeiro ao último caractere visível (busca binária,
  a partir do capítulo atual), `curlCopy` clona esse intervalo numa folha alinhada à primeira linha original; a cada quadro, o canto de baixo
  percorre um arco, `curlClip` corta a folha pela linha da dobra (mediatriz entre o canto original e o atual), o verso é o reflexo da parte
  levantada e a sombra cai na página de baixo. Voltar copia a página de destino e desdobra. Sem texto visível: desliza.
- **Textura**: o ruído `fractalNoise` tem opacidade perto de 0,5; sem a tabela `feFuncA` vira um tom liso. Intensidade por tema limitada
  pelo contraste do texto (`paperTextureCss(texture, background, text)`).
- **Passar página**: uma escolha global na primeira tela do painel (`readingFlow`), também para o PDF Original (que usa página única na rolagem).
- **Dobra sem repintura** (`841ae54`, depois do retorno "travada" no Redmi): nada de `clip-path`/degradê por quadro. `curlBox` cria contêineres
  girados pela linha da dobra (recorte = borda do contêiner, conteúdo contra-girado); o verso é a página espelhada (`scale(-1,1)`); sombra e borda são
  faixas fixas. 30 quadros-chave para `element.animate` (compositor); `requestAnimationFrame` só como reserva. Medir com trace: Paint por virada.

## Plano 18/11/2026: card de trecho com capa e capítulo (PLANO, sem código)
Fatia C do plano "a leitura além do arquivo" (`biblioteca-sync.md` §7), tamanho P. `QuoteCardSpec` ganha capa (miniatura
da capa já guardada do livro, lida do aparelho, nunca de rede) e posição pelo **capítulo** (`chapterTitle`); "página X de Y"
não vale no EPUB, onde a página muda com a letra. Cada um com interruptor "Mostrar capa" / "Mostrar capítulo"; sem capa
guardada, o card sai sem ela. Renderer nativo e Web em sincronia (string literal, Hermes). Testes: `test-quote-card`,
`test-quote-card-modal`, recurso na lista de entrega. Depois de A, citação digitada para livro sem arquivo (mesmo limite
de 400 caracteres). Padrão da capa (ligada ou desligada) é decisão do dono.
