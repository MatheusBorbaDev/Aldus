# Log de 10/11/2026 (movido do PROJECT_CONTEXT.md §10, sem edição)

### 10/11/2026 — Redesenho, Etapa 2: título e avisos do Reader (Claude)
- IMPLEMENTADO: `src/presentation/services/bookDisplay.ts` (`readableBookTitle`, `catalogBookFor`) é a regra única de título para Biblioteca e
  Reader: livro do acervo embutido mostra o título do catálogo (antes o Reader mostrava o nome do arquivo, ex. "sobre-a-vida-feliz"); título
  que é só nome de arquivo troca `-`/`_` por espaço; título salvo com espaços não muda. Nada gravado no banco (só exibição).
  Aviso "Leitura livre pronta." virou confirmação passageira (4 s, faixa estreita, sem botão, sem `alert`); avisos de falha, OCR e âncora
  continuam até o leitor fechar (botão com alvo de 44 px). O temporizador só limpa a própria confirmação, nunca um aviso mais novo.
- Não feito: subtítulo "Início" do Reflow (é o nome do primeiro capítulo gerado pelo `PdfReflowDocumentBuilder`; mudar é do motor).
- Corrigido no caminho: a faixa de acentos do regex ficou literal no arquivo novo e quebrava o bundle da fixture servido sem charset; voltou a
  escapes Unicode (faixa U+0300–U+036F) com trava no teste. VALIDADO: ver §3. NÃO TESTADO: Android.
