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

## Plano de mercado — FASE 3 (planejamento, 11/11/2026; nada implementado nesta seção)

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
