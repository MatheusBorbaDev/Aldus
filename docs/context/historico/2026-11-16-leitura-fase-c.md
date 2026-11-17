# Log — Leitura e compartilhamento, Fase C: card de trecho (16/11/2026)

Entrada movida sem edição do §10 do PROJECT_CONTEXT em 17/11/2026.

### 16/11/2026 — Leitura e compartilhamento, Fase C: card de trecho (Claude)
- Pedido do dono: compartilhar trecho "igual o Spotify", para Stories do Instagram e X, card bonito e seleção simples. Decisões do dono antes
  de produzir: instalar `expo-sharing` = sim; limite = **400 caracteres** (nunca corta em silêncio); botão direto de Stories (cadastro Meta) = não.
- `d1c1402` `expo-sharing ~57.0.26` (plugin sem opções não mexe no Android; avisos de licença regenerados, 41 dependências). `68e2d13`
  `quoteCard.ts`: regras, 3 formatos (Stories 9:16, Post 4:5, Quadrado 1:1), 4 modelos (Papel, Claro, Noite, Destaque) a partir das paletas, e o
  desenho em canvas como fonte JavaScript literal. `9e5b2ad` botão "Compartilhar" no pop-up de grifo → tela "Compartilhar trecho" com prévia
  da imagem real, modelo, formato, título/autor e marca ocultáveis; Android desenha numa WebView invisível só de canvas e envia JPEG do cache pelo
  `expo-sharing`; site usa o compartilhamento do navegador ou baixa a imagem. Só o trecho sai; nunca o arquivo do livro.
- VALIDADO (local): typecheck; `test:critical` 128/128 (novas `quote-card` e `quote-card-modal`); `export:web`; lista de entrega com 32
  recursos (`--source`/`--dist`); legal PASS. Card renderizado no Chrome com o canvas real (5 combinações) e a tela medida em fixture
  react-native-web (24 combinações 320/390 × 1/1,3/1,6, sem estouro).
- NÃO TESTADO: Android (WebView de desenho, folha de compartilhamento, Instagram/X), fontes do aparelho no card (Georgia não existe no Android:
  cai em Noto Serif). Precisa de APK novo (dependência nativa).
