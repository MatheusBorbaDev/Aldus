// Leitura Livre assembly (18/11/2026, owner: "os 4 minutos e meio não são demais?"). A long paragraph (footnotes run together) was
// rebuilt and re-scanned at every line, so assembly grew with the square of its size: ~4.5 min of "Montando documento" for a 1,144-page
// PDF on the Redmi. The paragraph is now kept in pieces. Checks the joining rules and that 4x the text costs far less than 16x the time.
const assert = require('node:assert/strict');
const { loader } = require('./library-test-utils.cjs');
const { buildPdfReflowDocument } = loader({ 'react-native': { Platform: { OS: 'android' } } })('src/data/local/PdfReflowDocumentBuilder.ts');
const page = (pageNumber, lines) => ({ pageNumber, pageWidth: 500, pageHeight: 760, images: [],
  textItems: lines.map(([text, indent = 0, gap = 16], i) => ({ text, x: 40 + indent, y: 720 - i * gap, width: 420, height: 11 })) });
const paragraphs = doc => doc.chapters.flatMap(chapter => chapter.blocks).filter(block => block.type === 'paragraph').map(block => block.text);

// 1. Joining rules (unchanged): hyphenated word rejoined only before a lowercase letter, soft hyphen dropped, one space otherwise,
//    new paragraph after sentence end + indent.
const filler = 'texto corrido para dar corpo a esta linha de teste da montagem';
const doc = buildPdfReflowDocument([page(1, [
  [`${filler} cons-`], ['trução da frase seguinte e uma pala­'], ['vra partida; Rio-'], ['Grande fica junto. Fim da ideia.'], [`${filler} novo parágrafo`, 30],
])], 1);
assert.deepEqual(paragraphs(doc), [
  `${filler} construção da frase seguinte e uma palavra partida; Rio- Grande fica junto. Fim da ideia.`,
  `${filler} novo parágrafo`,
]);

// 2. Linear growth: one paragraph with no break across every page.
const book = pages => Array.from({ length: pages }, (_, p) => page(p + 1, Array.from({ length: 40 }, (_, i) => [`palavras corridas de uma nota longa sem recuo nem espaço ${p}-${i}`])));
const time = pages => { const input = book(pages); const start = performance.now(); const result = buildPdfReflowDocument(input, pages); const ms = performance.now() - start; assert.equal(paragraphs(result).length, 1); return ms; };
time(40); // warm up
const small = Math.max(time(100), 1), large = time(400);
assert.ok(large / small < 9, `4x the text must not cost ~16x the time (got ${(large / small).toFixed(1)}x: ${small.toFixed(0)} ms → ${large.toFixed(0)} ms)`);
// 3. Text quality counts (run at every stage and on every cached open): numeric checks give exactly the regex results.
{ const { assessTextExtractionQuality } = loader({ 'react-native': { Platform: { OS: 'android' } } })('src/data/local/pdfReflowQuality.ts');
  const reference = items => { let totalChars = 0, controlChars = 0, letterChars = 0, replacementChars = 0;
    for (const { text } of items) { totalChars += text.length; for (const char of text) {
      if (char === '�') replacementChars++; if (/^[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]$/u.test(char)) controlChars++; if (/\p{L}/u.test(char)) letterChars++; } }
    return { version: 1, totalChars, controlChars, letterChars, replacementChars }; };
  const every = []; for (let code = 0; code < 0x10000; code++) every.push(String.fromCharCode(code));
  const samples = [every.join(''), 'Ação, “Marx” 😀 𝒜 \uD800 sozinho \uDC00 e \u0000\u001F\u007F� fim', 'cão\tlinha\nnova\r'];
  for (const text of samples) assert.deepEqual(assessTextExtractionQuality([{ text }]), reference([{ text }]), 'same counts as the regular expressions'); }
console.log(`PASS Leitura Livre assembly: joining rules kept; one long paragraph grows linearly (100 → 400 pages: ${(large / small).toFixed(1)}x time); text quality counts equal the regex reference for every BMP code point, astral and lone surrogates.`);
