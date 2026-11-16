// PDF Original continuous scroll (phase E, 16/11/2026): option rules and the literal controller source. The behaviour on a real
// PDF.js document is covered by test:reader:pdf:web; this suite runs in the critical matrix without a browser.
const assert = require('node:assert/strict');
const { PDF_FLOWS, PDF_SCROLL_SOURCE, isPdfFlow } = require('./community-test-loader.cjs')()('src/domain/reader/pdfScroll.ts');
assert.deepEqual(PDF_FLOWS.map(f => [f.value, f.label]), [['paged', 'Página a página'], ['scroll', 'Rolagem contínua']]);
assert.ok(isPdfFlow('scroll') && isPdfFlow('paged') && !isPdfFlow('continuous') && !isPdfFlow(undefined));
const factory = new Function(`${PDF_SCROLL_SOURCE}; return createPdfScroller;`)();
assert.equal(typeof factory, 'function', 'the literal source defines createPdfScroller');
assert.ok(!/`/.test(PDF_SCROLL_SOURCE), 'no template literals: the source is embedded in the Android viewer template');
console.log('PASS PDF scroll rules: two options, unknown values rejected, controller source parses and embeds safely. Behaviour in Chromium: test:reader:pdf:web.');
