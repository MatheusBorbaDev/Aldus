// Busca no livro (19/11/2026, dono: "apenas diz que o trecho foi encontrado, mas não leva até ele"). O documento EPUB/Leitura Livre
// tem o livro inteiro e `window.find` seleciona o trecho e vira a página; o problema era o painel continuar aberto por cima e a
// mesma busca repetida não chegar ao leitor. Verificação da ligação no código (sem WebView real; aparelho NÃO TESTADO).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const read = file => fs.readFileSync(file, 'utf8');
const screen = read('src/presentation/screens/ReaderScreen.tsx');
const adapter = read('src/presentation/components/reader/DocumentReaderAdapter.tsx');
const native = read('src/presentation/components/EpubPageViewer.native.tsx');
const web = read('src/presentation/components/EpubPageViewer.web.tsx');
const doc = read('src/presentation/components/EpubReaderDocument.ts');

// Achou: o painel fecha e os controles somem, para a página com o trecho ficar à vista.
assert.match(screen, /const handleBookSearchResult = useCallback\(\(found: boolean\) => \{\s*setBookSearchResult\(found\);\s*if \(found\) \{ setReaderPanel\(null\); setControlsVisible\(false\); \}/);
// Cada pedido muda o contador, e o contador chega aos dois leitores (aparelho e site) como dependência do efeito de busca.
assert.match(screen, /setBookSearchTerm\(term\);\s*setBookSearchNonce\(value => value \+ 1\);/);
assert.match(screen, /searchNonce=\{bookSearchNonce\}/);
assert.match(adapter, /searchNonce=\{searchNonce\}/);
assert.match(native, /\}, \[loaded, searchTerm, searchNonce\]\);/);
assert.match(web, /\}, \[searchTerm, searchNonce\]\);/);
// O documento procura no livro inteiro (todas as seções), dá a volta no fim e vai à página do trecho encontrado.
assert.match(doc, /class="epub-chapter"/);
assert.match(doc, /window\.find\(term, false, false, true, false, false, false\)/);
assert.match(doc, /window\.goToPage\(page\);/);
assert.match(read('src/presentation/components/ReaderSettingsPanel.tsx'), /Trecho encontrado\. Busque de novo para ir ao próximo\./);
console.log('PASS reader search: found → panel closes on the page with the selected passage; repeating the search moves to the next match (nonce to native and web viewers). Wiring only; device NOT TESTED.');
