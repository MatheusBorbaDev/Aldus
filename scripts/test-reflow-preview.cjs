// Leitura Livre preview (18/11/2026, owner: "pode incluir o 3"): the first pages are readable while the rest is prepared, and the
// complete book continues from the paragraph at the top of the preview, found by its text. Nothing unchecked is shown, the extracted
// pages are not touched, and a paragraph that is absent or not unique gives no position (the screen says so; no silent jump).
const assert = require('node:assert/strict');
const { loader } = require('./library-test-utils.cjs');
const load = loader({ 'react-native': { Platform: { OS: 'android' } } });
const { buildPdfReflowPreviewAsync, REFLOW_PREVIEW_PAGES } = load('src/data/local/pdfReflowPreview.ts');
const { buildPdfReflowDocument, toStoredReflowChapters } = load('src/data/local/PdfReflowDocumentBuilder.ts');
const { previewReadingAnchor, previewResumeText } = load('src/domain/reader/reflowPreviewAnchor.ts');
const { resolveTextAnchor, parseReadingAnchor } = load('src/domain/types/readingAnchor.ts');

// Indented first line, second line at the margin, split between words.
const lines = text => { const cut = text.lastIndexOf(' ', text.length >> 1); return [{ text: text.slice(0, cut), x: 70, y: 700, width: 400, height: 11 }, { text: text.slice(cut + 1), x: 40, y: 684, width: 430, height: 11 }]; };
// Each page: one paragraph of numbered sentences (unique text), opening with an indent after the previous page's full stop.
const sentence = (page, i) => `Frase ${i} da página ${page} conta a vida de Marx em Londres e o trabalho na biblioteca.`;
const page = (pageNumber, text = Array.from({ length: 12 }, (_, i) => sentence(pageNumber, i)).join(' ')) => ({
  pageNumber, pageWidth: 500, pageHeight: 760,
  images: [{ src: 'data:image/jpeg;base64,AAAA', x: 40, y: 600, width: 200, height: 120 }],
  textItems: lines(text),
});
const onePage = (pageNumber, text) => ({ pageNumber, pageWidth: 500, pageHeight: 760, images: [], textItems: lines(text) });
const pages = Array.from({ length: 60 }, (_, index) => page(index + 1));
const before = JSON.stringify(pages);

(async () => {
  // 1. Preview: first 40 pages, text only, the input left as it was.
  const preview = await buildPdfReflowPreviewAsync(pages, new AbortController().signal);
  assert.equal(REFLOW_PREVIEW_PAGES, 40);
  assert.equal(preview.pageCount, 40);
  assert.ok(preview.blocks.every(block => (block.type === 'paragraph' || block.type === 'heading') && block.text.trim() === block.text && block.text));
  assert.ok(preview.blocks.some(block => block.text.includes(sentence(40, 0))), 'page 40 is in the preview');
  assert.ok(!preview.blocks.some(block => block.text.includes(sentence(41, 0))), 'page 41 is not');
  assert.equal(JSON.stringify(pages), before, 'the extracted pages (geometry, images) are not changed by the preview');

  // Unreadable text gives no preview; cancellation stops it.
  const scanned = Array.from({ length: 40 }, (_, index) => ({ ...page(index + 1), textItems: [] }));
  assert.equal(await buildPdfReflowPreviewAsync(scanned, new AbortController().signal), null);
  const garbage = Array.from({ length: 40 }, (_, index) => page(index + 1, '\u0001\u0002\u0003 �� '.repeat(80)));
  assert.equal(await buildPdfReflowPreviewAsync(garbage, new AbortController().signal), null);
  const stop = new AbortController(); stop.abort();
  await assert.rejects(buildPdfReflowPreviewAsync(pages, stop.signal));

  // 2. Top of the screen → paragraph to continue from.
  const blocks = [{ type: 'heading', text: 'Capítulo 1' }, { type: 'paragraph', text: 'primeiro' }, { type: 'heading', text: 'Capítulo 2' }, { type: 'paragraph', text: 'segundo' }];
  const tops = [20, 60, 400, 440];
  assert.equal(previewResumeText(blocks, tops, 0), null, 'still at the opening: nothing to carry over');
  assert.equal(previewResumeText(blocks, tops, 100), 'primeiro');
  assert.equal(previewResumeText(blocks, tops, 395), 'segundo', 'a heading at the top gives the paragraph after it');
  assert.equal(previewResumeText(blocks, [20, 60], 900), 'primeiro', 'blocks not laid out yet are skipped');

  // 3. Paragraph → place in the complete book, checked against the text the reader shows.
  const full = buildPdfReflowDocument(pages, pages.length);
  const resume = preview.blocks.find(block => block.text.includes(sentence(30, 0)));
  const anchor = previewReadingAnchor('marx', full, resume.text);
  assert.ok(anchor, 'paragraph found in the complete book');
  assert.deepEqual(parseReadingAnchor(anchor), anchor, 'a valid reading anchor');
  const chapters = toStoredReflowChapters('marx', full);
  const chapter = chapters.find(item => item.id === anchor.chapterId);
  assert.ok(chapter, 'anchor names a chapter of the stored book');
  const shownText = chapter.html.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const resolved = resolveTextAnchor(shownText, anchor);
  assert.ok(resolved.status === 'exact' || resolved.status === 'relocated', `the reader finds it (${resolved.status})`);
  assert.ok(shownText.slice(resolved.start).startsWith(resume.text.slice(0, 40)), 'at the paragraph that was at the top');
  assert.ok(resume.text.startsWith(sentence(30, 0)) && full.chapters.flatMap(c => c.blocks).length >= 60, 'one paragraph per page: page 30, not the opening');

  // Opening words shared with another paragraph: the quote grows until it is unique.
  const shared = 'Este começo de parágrafo se repete em dois lugares do livro inteiro, palavra por palavra';
  const twin = buildPdfReflowDocument([onePage(1, `${shared}, mas aqui segue para o exílio em Paris.`), onePage(2, `${shared}, e aqui segue para Londres em 1849.`)], 2);
  const twinText = twin.chapters.flatMap(c => c.blocks).filter(b => b.type === 'paragraph').map(b => b.text);
  assert.equal(twinText.length, 2);
  const grown = previewReadingAnchor('twin', twin, twinText[1]);
  assert.ok(grown && grown.quote.length > 60 && grown.quote.includes('Londres'), 'lengthened past the shared words');
  // Absent or never unique → no position.
  assert.equal(previewReadingAnchor('twin', twin, 'Texto que não existe no livro completo.'), null);
  const same = buildPdfReflowDocument([onePage(1, `${shared}.`), onePage(2, `${shared}.`)], 2);
  assert.equal(previewReadingAnchor('same', same, same.chapters[0].blocks.filter(b => b.type === 'paragraph')[1].text), null, 'two identical paragraphs: no guess');
  assert.equal(previewReadingAnchor('same', same, '   '), null);

  console.log('PASS Leitura Livre preview: first 40 pages, text only, pages untouched, unreadable text gives none; resume paragraph from the scroll position; located once by its text in the complete book (unique quote, absent/ambiguous gives none).');
})().catch(error => { console.error(error); process.exitCode = 1; });
