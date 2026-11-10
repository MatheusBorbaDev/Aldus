# Log de 09/11/2026 (movido do PROJECT_CONTEXT.md §10, sem edição)

### 09/11/2026 — Revisão de qualidade: Onda 5, erros silenciosos e dependências (Claude)
- R4 classificado (86 `catch` que engolem erro por `rg` amplo; lista e critérios no BUG 21). IMPLEMENTADO só onde havia perda de dado:
  ajustes de leitura (`ReaderSettingsContext`), tema (`AppThemeContext`) e ajustes do PDF (`ReaderScreen` → `pdfReaderSettings.save`) agora
  passam por `latestWriteTracker` (`src/core/utils/latestWrite.ts`): falha da gravação mais recente vira `saveError`, mostrado no painel de
  ajustes do Reader e em Aparência, e some no próximo sucesso; o valor segue em memória. **BUG 21** corrigido: leitura de preferências que
  falhava gravava os padrões por cima das salvas (reproduzido com o HEAD anterior); agora nada é gravado até o usuário mudar algo. No Reader
  só mudou a gravação dos ajustes do PDF e um aviso no painel (sem remontagem, posição ou âncora). `DownloadManager` não precisava de mudança.
- R5 só investigado (nada instalado): ver BUG 13 (audit 0 crít./6 altos; 9 patches do SDK 57 pendentes; `js-polyfills` 0.76.9 e
  `metro-cache` 0.81.5 declarados à mão). Proposta aguarda o usuário; qualquer opção exige novo APK.
- Testes: `test-preference-persistence` (critical); `test-reader-concentration` libera o módulo puro `latestWrite`. VALIDADO: ver §3.
  NÃO TESTADO: Android e falha real do AsyncStorage/IndexedDB.
