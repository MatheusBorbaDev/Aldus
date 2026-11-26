// Quote card (phase C, 16/11/2026): rules and the literal canvas renderer with a recording 2D context. Text width is
// simulated (0.52 x font size per character), so this proves layout rules, not the rendered look on a device.
const assert = require('node:assert/strict');
const load = require('./community-test-loader.cjs')();
const { QUOTE_CARD_MAX_CHARACTERS, QUOTE_CARD_FORMATS, QUOTE_CARD_TEMPLATES, QUOTE_CARD_RENDERER, buildQuoteCardSpec, validateQuoteForCard, readableQuote } = load('src/domain/reader/quoteCard.ts');
const { appPalettes } = load('src/theme/tokens.ts');
const lum = hex => { const c = hex.slice(1).match(/../g).map(v => parseInt(v, 16) / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
const contrast = (a, b) => { const v = [lum(a), lum(b)].sort((x, y) => y - x); return (v[0] + .05) / (v[1] + .05); };

// Rules.
assert.equal(QUOTE_CARD_MAX_CHARACTERS, 400, "owner's limit");
assert.deepEqual(validateQuoteForCard('  Ao   verme\n\n que  '), { ok: true, quote: 'Ao verme\nque' }, 'spaces collapse inside a line; line breaks stay (25/11)');
assert.equal(validateQuoteForCard('   ').ok, false);
const long = validateQuoteForCard('a'.repeat(401)); assert.equal(long.ok, false); assert.match(long.message, /até 400 caracteres \(este trecho tem 401\)/);
assert.equal(validateQuoteForCard('a'.repeat(400)).ok, true, '400 is accepted, nothing is cut');
assert.throws(() => buildQuoteCardSpec({ quote: 'b'.repeat(500), title: 'T', author: 'A', showBook: true, format: 'story', template: 'paper', paletteName: 'classic' }), /até 400/);
assert.deepEqual(QUOTE_CARD_FORMATS.map(f => [f.value, f.width, f.height]), [['story', 1080, 1920], ['portrait', 1080, 1350], ['square', 1080, 1080]]);
for (const paletteName of Object.keys(appPalettes)) for (const { value: template } of QUOTE_CARD_TEMPLATES) {
  const spec = buildQuoteCardSpec({ quote: 'Trecho', title: ' Memórias ', author: 'Machado', showBook: true, format: 'square', template, paletteName });
  assert.ok(contrast(spec.text, spec.background) >= 4.5, `${paletteName}/${template}: quote text contrast`);
  assert.ok(contrast(spec.secondary, spec.background) >= 4.5, `${paletteName}/${template}: author contrast`);
  assert.equal(spec.grain, template === 'paper'); assert.equal(spec.book, 'Memórias');
}
const hidden = buildQuoteCardSpec({ quote: 'Trecho', title: 'Livro', author: 'Autor', showBook: false, format: 'story', template: 'night', paletteName: 'ink' });
assert.equal(hidden.book, null); assert.equal(hidden.author, null); assert.equal(hidden.brand, true, 'the Aldus mark is always on the card (owner, 16/11)');
assert.equal(hidden.background, appPalettes.ink.dark.background, 'night uses the chosen palette');

// 25/11/2026: verses and paragraphs came out glued ("apagariaMas"). The reader sends a readable copy with the breaks.
assert.equal(readableQuote('eu as apagariaMas são', 'eu as apagaria\nMas são'), 'eu as apagaria\nMas são');
assert.equal(readableQuote('Ao verme\n    que', 'Ao verme que'), 'Ao verme que', 'HTML formatting newlines are not line breaks');
assert.equal(readableQuote('Ao verme\n    que', null), 'Ao verme que', 'no readable copy: one line, as before');
assert.equal(readableQuote('texto da âncora', 'outro\ntexto'), 'texto da âncora', 'a readable copy with other letters is ignored');
{
  // The real WebView functions over a minimal DOM: <p>A<br>B</p><p>C</p>, plus a source newline inside a text node.
  const { readerAnchorDocumentScript } = load('src/presentation/components/ReaderAnchorDocument.ts');
  const source = readerAnchorDocumentScript();
  const pick = name => { const start = source.indexOf('function ' + name + '('); let depth = 0, i = source.indexOf('{', start); for (; i < source.length; i++) { if (source[i] === '{') depth++; else if (source[i] === '}' && --depth === 0) break; } return source.slice(start, i + 1); };
  const block = brs => ({ getElementsByTagName: tag => (tag === 'br' ? new Array(brs) : []) });
  const p1 = block(1), p2 = block(0);
  const text = (value, parent, brBefore) => ({ length: value.length, textContent: value, brBefore, parentElement: { closest: () => parent } });
  const nodes = [text('Se as mentiras fossem\n  escritas, eu as apagaria', p1), text('Mas são faladas', p1, true), text('Que eu possa', p2)];
  const fakeDocument = { createRange: () => { let end; return { setStart() {}, setEnd(node) { end = node; }, cloneContents: () => ({ querySelector: q => (q === 'br' && end.brBefore ? {} : null) }) }; } };
  const fns = new Function('document', 'STUDY_BLOCKS', pick('studyBreaks') + pick('studyBrBetween') + pick('studyReadable') + '; return { studyReadable };')(fakeDocument, 'p');
  let raw = ''; const model = { nodes: [] }; for (const node of nodes) { model.nodes.push({ node, start: raw.length }); raw += node.textContent; } model.text = raw;
  const readable = fns.studyReadable(model, 0, raw.length);
  assert.equal(readable, 'Se as mentiras fossem   escritas, eu as apagaria\nMas são faladas\nQue eu possa', '<br> and a new paragraph become line breaks; the HTML newline becomes a space');
  assert.equal(readableQuote(raw, readable), readable, 'the readable copy has the anchor letters');
  const card = validateQuoteForCard(readableQuote(raw, readable));
  assert.equal(card.ok && card.quote, 'Se as mentiras fossem escritas, eu as apagaria\nMas são faladas\nQue eu possa');
}

// Renderer with a recording context.
const renderQuoteCard = new Function(QUOTE_CARD_RENDERER + '; return renderQuoteCard;')();
function fakeContext() {
  const drawn = [], state = { font: '10px serif' };
  const size = () => Number(/(\d+)px/.exec(state.font)[1]);
  const ctx = {
    drawn, set font(v) { state.font = v; }, get font() { return state.font; }, fillStyle: '', textBaseline: '',
    images: [], save() {}, restore() {}, drawImage(...args) { ctx.images.push(args); },
    fillRect() {}, beginPath() {}, arc() {}, fill() {}, createPattern: () => 'pattern', measureText: text => ({ width: text.length * size() * 0.52 }),
    fillText(text, x, y) { drawn.push({ text, x, y, width: text.length * size() * 0.52, size: size(), font: state.font }); },
  };
  return ctx;
}
const makeCanvas = () => ({ getContext: () => ({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) });
const quote = 'Ao verme que primeiro roeu as frias carnes do meu cadáver dedico como saudosa lembrança estas memórias póstumas.';
const fits = (spec, ctx) => ctx.drawn.every(d => d.x >= 0 && d.x + d.width <= spec.width - Math.round(spec.width * 0.09) + 1 && d.y <= spec.height);
const results = {};
for (const format of ['story', 'portrait', 'square']) {
  const spec = buildQuoteCardSpec({ quote, title: 'Memórias Póstumas de Brás Cubas', author: 'Machado de Assis', showBook: true, format, template: 'paper', paletteName: 'classic' });
  const ctx = fakeContext(); const out = renderQuoteCard(ctx, spec, makeCanvas); results[format] = out.fontSize;
  assert.ok(fits(spec, ctx), `${format}: every line stays inside the margins`);
  assert.equal(out.lines.join(' '), quote, `${format}: the whole trecho is drawn, nothing cut`);
  assert.ok(ctx.drawn.some(d => d.text === 'ALDUS') && ctx.drawn.some(d => d.text === 'Machado de Assis'));
}
assert.ok(results.story >= results.square, 'the tall Stories card keeps the larger letter');
const max = buildQuoteCardSpec({ quote: ('palavra ' .repeat(60)).slice(0, 400), title: 'T'.repeat(200), author: 'Autor', showBook: true, format: 'square', template: 'accent', paletteName: 'petroleum' });
const ctx = fakeContext(); const out = renderQuoteCard(ctx, max, makeCanvas);
assert.ok(fits(max, ctx), '400 characters in the square card stay inside');
assert.ok(out.fontSize < results.square, 'longer trecho, smaller letter');
assert.ok(ctx.drawn.some(d => d.text === 'ALDUS'), 'brand always drawn');
const bookLines = ctx.drawn.filter(d => /^T+-?…?$/.test(d.text)); assert.equal(bookLines.length, 2); assert.ok(bookLines[1].text.endsWith('…'), 'long title clamped to two lines');
{
  const verses = renderQuoteCard(fakeContext(), buildQuoteCardSpec({ quote: 'Se as mentiras fossem escritas, eu as apagaria\nMas são faladas\nQue eu possa me arrepender', title: null, author: null, showBook: true, format: 'square', template: 'night', paletteName: 'classic' }), makeCanvas);
  assert.ok(verses.lines.some(l => l.startsWith('Mas são')) && verses.lines.some(l => l.startsWith('Que eu')), 'each verse starts its own line');
  assert.ok(verses.lines.every(l => !/apagariaMas|faladasQue/.test(l)), 'verses are never glued');
}
const word = renderQuoteCard(fakeContext(), buildQuoteCardSpec({ quote: 'x'.repeat(120), title: null, author: null, showBook: true, format: 'square', template: 'light', paletteName: 'ink' }), makeCanvas);
assert.ok(word.lines.length > 1 && word.lines.slice(0, -1).every(l => l.endsWith('-')), 'a word wider than the card is hyphen-split, not overflowing');
// Cover beside the book (18/11): decoded image drawn inside the card, text moved right, chapter in italic; a wide cover is cropped.
{
  const { quoteCardCover } = load('src/domain/reader/quoteCard.ts');
  const coverUrl = 'data:image/png;base64,iVBORw0KGgo=';
  for (const [format, image] of [['story', { width: 600, height: 900 }], ['square', { width: 1600, height: 900 }]]) {
    const spec = buildQuoteCardSpec({ quote, title: 'Memórias Póstumas de Brás Cubas', author: 'Machado de Assis', showBook: true, format, template: 'paper', paletteName: 'classic', cover: coverUrl, showCover: true, chapter: 'Capítulo I. Óbito do autor', showChapter: true });
    assert.equal(spec.cover, coverUrl); assert.equal(spec.chapter, 'Capítulo I. Óbito do autor');
    const c = fakeContext(); renderQuoteCard(c, spec, makeCanvas, image);
    assert.equal(c.images.length, 1, format + ': cover drawn once');
    const [, sx, sy, sw, sh, dx, dy, dw, dh] = c.images[0];
    const M = Math.round(spec.width * 0.09);
    assert.ok(dx === M && dy > 0 && dy + dh <= spec.height && dw <= dh, format + ': cover inside the card, book-shaped');
    assert.ok(sx >= 0 && sy >= 0 && sx + sw <= image.width + 0.01 && sy + sh <= image.height + 0.01, format + ': source crop inside the image');
    const titleLine = c.drawn.find(d => d.text.startsWith('Memórias'));
    assert.ok(titleLine.x >= dx + dw + 20, format + ': text beside the cover');
    const chapterLine = c.drawn.find(d => d.text.startsWith('Capítulo I'));
    assert.ok(chapterLine && /italic/.test(chapterLine.font), format + ': chapter in italic');
    assert.ok(fits(spec, c), format + ': everything inside with a cover');
  }
  const spec = buildQuoteCardSpec({ quote, title: 'Livro', author: 'Autora', showBook: true, format: 'story', template: 'night', paletteName: 'classic', cover: coverUrl, showCover: true });
  const c = fakeContext(); renderQuoteCard(c, spec, makeCanvas, null);
  assert.equal(c.images.length, 0, 'image not decoded: card without cover'); assert.equal(c.drawn.find(d => d.text === 'Livro').x, Math.round(spec.width * 0.09));
  assert.equal(buildQuoteCardSpec({ quote, title: 'L', author: 'A', showBook: true, format: 'story', template: 'paper', paletteName: 'classic', cover: coverUrl, showCover: false }).cover, null, 'cover hideable');
  for (const bad of ['file:///data/cover.jpg', 'https://example.invalid/c.jpg', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,' + 'A'.repeat(1_400_001), 'data:image/png;base64,<script>', null, undefined]) assert.equal(quoteCardCover(bad), null, 'not a usable cover: ' + String(bad).slice(0, 30));
}
console.log('PASS quote card: cover beside the book (decoded first, cropped to book shape, hideable, embedded images only) and chapter in italic;');
console.log('PASS quote card: 400-character limit without silent cuts, 3 formats, 4 templates x 3 palettes with AA text, book/author optional and the Aldus mark always on, renderer keeps every line inside, shrinks letter for longer trechos, clamps long titles and splits huge words. Simulated text widths; not a device render.');
