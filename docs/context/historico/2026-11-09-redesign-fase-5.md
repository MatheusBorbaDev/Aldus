# Log de 09/11/2026 (movido do PROJECT_CONTEXT.md §10, sem edição)

### 09/11/2026 — Redesign Fase 5: moldura do Reader (Claude)
- IMPLEMENTADO (só visual, `TopHeader.tsx` e `BottomFooter.tsx`): título serifado, capítulo em tom secundário, botões de 44 px, linha fina no
  lugar da sombra; cor com alfa só para hex `#RRGGBB` (outras notações seguem sem alfa). `ReaderControls` (slot estável/ancestralidade/opacidade),
  documento, posições, âncoras, painéis e handlers **não** foram tocados. Cabeçalho segue < 86 px (contrato do feedback do Reflow).
- VALIDADO: ver §3 (89/89, export, 7 suítes Chromium do Reader, incl. 6 botões recebendo toque acima do iframe). NÃO TESTADO: Android.
- Entrega: APK de ensaio `device-rehearsal` do `ae98991` compilado, conferido e instalado no Redmi com `install -r` (dados/`firstInstallTime` preservados).
  Homologação física parcial PASS (§3); ajustes de rótulos/nome depois validados em typecheck, 89/89, export e Chromium (Biblioteca/fontes),
  ainda fora do APK. `test-library-bulk-web` passou a esperar a fixture após reload (falhava por tempo fixo de 500 ms).
