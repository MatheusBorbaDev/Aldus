# Log — Leitura e compartilhamento, Fase B: grifo (16/11/2026)

Entrada movida sem edição do §10 do PROJECT_CONTEXT em 16/11/2026.

### 16/11/2026 — Leitura e compartilhamento, Fase B: grifo (Claude)
- Relato do dono: "a seleção do grifo está ruim e quando termino de selecionar ele não abre o pop up". Causa confirmada no código: o documento
  só capturava no `pointerup` com o modo armado pelo painel; as alças nativas do Android mudam a seleção sem esse evento (BUGS_ATUAIS, GRIFO 01).
- `763feca` documento: captura também quando a seleção para de mudar (650 ms após o último `selectionchange`), sem eco repetido; `studySelectAt`
  seleciona a palavra sob o dedo (ponto fora do texto é recusado, o Chromium "gruda" na palavra mais próxima); `studyAdjust` (palavra antes/depois,
  tirar a última, frase inteira); desligar o modo limpa a seleção. Nada disso move a página.
  `ee53a66` app: pressionar e segurar na página abre o pop-up de grifo (5 cores gravam na hora, 4 ajustes, "Adicionar nota" leva ao painel,
  Cancelar); o "Grifar um trecho" do painel também termina no pop-up; zonas de toque suspensas com o pop-up aberto; `createStudyHighlight`.
- VALIDADO (local): typecheck; `test:critical` 126/126 (nova `highlight-popup`; `reader-screen` com o fluxo novo); `test:reader:browser` no
  documento real (seleção parada capturada sem `pointerup`, palavra por ponto, ajustes, ponto fora recusado, página parada); study/markings/epub web
  PASS; `export:web` e lista de entrega com 31 recursos. Pop-up medido em fixture react-native-web (24 combinações 320/390 × 1/1,3/1,6 × tema × trecho).
- Limites: só EPUB (como os grifos); o pop-up pode cobrir a palavra quando ela está embaixo na página. NÃO TESTADO: Android (pressionar e segurar,
  alças nativas, TalkBack) — é exatamente onde o problema aparecia; precisa de APK e Redmi.
