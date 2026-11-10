# Log de 10/11/2026 (movido do PROJECT_CONTEXT.md §10, sem edição)

### 10/11/2026 — Redesenho, Etapa 1: painel de ajustes de leitura (Claude)
- Pedido do usuário após ver o APK no Redmi (painel confuso). Plano em 5 etapas aprovado, com liberdade para mudar estrutura: 1 painel de
  leitura; 2 cabeçalho/avisos do Reader; 3 menu do livro; 4 Descobrir e Estudo; 5 telas antigas (Batalha, decks, Plano, Admin, Community).
- IMPLEMENTADO Etapa 1 (`ReaderSettingsPanel.tsx`, mesma interface de props; `ReaderScreen`, contextos, valores, limites e padrões intocados):
  folha baixa (62% recolhida, 90% expandida, fundo 18% para ver o texto mudar) com **sempre à mão** tamanho da letra (A−/slider/A+), temas como
  amostras com a cor real e brilho (slider + "Automático"; mexer no slider sai do automático); **Texto · Página · Conforto** no lugar das 4 abas
  em grade; seleção por contorno + peso + ✓ (sem bloco sólido); rótulos em frase, sem caixa alta; fonte com prévia na própria família;
  "Compacto/Padrão/Amplo"; alinhamento do Reflow como par de opções; "Restaurar texto e página padrão" com confirmação (não toca tema/brilho);
  PDF: Original/Leitura Livre no topo, zoom na área rápida, Original sem a seção Texto. **"Modo e-reader" removido**: só alternava Papel/Sépia
  (não tinha valor próprio; quem usava segue no tema Papel). Seções ficam montadas (controles não são recriados; navegar não grava nada).
- Testes reescritos: `test-reader-settings-categories`, `test-reader-settings-web` (exige folha recolhida com texto visível, 5 amostras sem
  rolagem, abas 44 px); fixture Web com temas reais e ícones em texto. Não feito do plano: virar página e alinhamento do EPUB (não existem
  no motor; seriam Reader/onda 6), OCR no menu do livro (Etapa 3). VALIDADO: ver §3. NÃO TESTADO: Android.
