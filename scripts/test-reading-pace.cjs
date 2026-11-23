// Onda B4: tempo de leitura a partir do ritmo medido (sem ritmo, sem estimativa). Desde 23/11/2026: por página e no livro, não por
// capítulo (a divisão de capítulos do livro nem sempre é correta).
const assert = require('node:assert/strict'), fs = require('node:fs');
const load = require('./community-test-loader.cjs')({});
const p = load('src/domain/reader/readingPace.ts');
const t = (page, s) => ({ page, at: s * 1000 });
assert.equal(p.paceSample(null, t(2, 10)), null);
assert.equal(p.paceSample(t(1, 0), t(2, 40)), 40, 'next page after 40 s');
assert.equal(p.paceSample(t(1, 0), t(3, 40)), null, 'jumps do not count'); assert.equal(p.paceSample(t(2, 0), t(1, 40)), null, 'going back does not count');
assert.equal(p.paceSample(t(1, 0), t(2, 1)), null, 'skimming (<3 s) ignored'); assert.equal(p.paceSample(t(1, 0), t(2, 700)), null, 'pause (>10 min) ignored');
assert.equal(p.secondsPerPage([30, 40, 50, 60]), null, 'needs 5 samples'); assert.equal(p.secondsPerPage([30, 40, 50, 60, 600]), 50, 'median resists one long read');
assert.equal(p.addPaceSample(Array.from({ length: 30 }, (_, i) => i + 3), 99).length, 30);
assert.equal(p.pagesLeftInBook(12, 40), 29, 'pages to the end of the book (including current)');assert.equal(p.pagesLeftInBook(40, 40), 1);assert.equal(p.pagesLeftInBook(0, 40), null);assert.equal(p.pagesLeftInBook(3, 0), null);
assert.equal(p.pagesLeftInChapter, undefined, 'no chapter-based estimate anymore');
assert.equal(p.formatSecondsPerPage(40), '≈ 40 s');assert.equal(p.formatSecondsPerPage(0.4), '≈ 1 s');assert.equal(p.formatSecondsPerPage(59.6), '≈ 1 min');assert.equal(p.formatSecondsPerPage(150), '≈ 3 min');
assert.equal(p.formatTimeLeft(20), 'menos de 1 min'); assert.equal(p.formatTimeLeft(6 * 60), '≈ 6 min'); assert.equal(p.formatTimeLeft(65 * 60), '≈ 1 h 5 min'); assert.equal(p.formatTimeLeft(120 * 60), '≈ 2 h');
assert.equal(p.bookTimeLeftLabel([30, 30, 30], 12, 40), null, 'not enough pace → no label');assert.equal(p.bookTimeLeftLabel([30, 30, 30, 30, 30], 12, 0), null, 'no page count → no label');
assert.equal(p.bookTimeLeftLabel([30, 30, 30, 30, 30], 12, 40), '≈ 30 s por página · ≈ 15 min no livro', '29 pages × 30 s = 14.5 min');
assert.equal(p.bookTimeLeftLabel([90, 90, 90, 90, 90], 1, 200), '≈ 2 min por página · ≈ 5 h no livro');
assert.match(fs.readFileSync('src/presentation/screens/ReaderScreen.tsx', 'utf8'), /useReadingTimeLeft\(\{ enabled: [^}]*page: epubPage, totalPages: epubTotalPages \}\)/, 'from the page and the page count, no chapters');
const footer = fs.readFileSync('src/presentation/components/BottomFooter.tsx', 'utf8'), screen = fs.readFileSync('src/presentation/screens/ReaderScreen.tsx', 'utf8'), hook = fs.readFileSync('src/presentation/hooks/useChapterTimeLeft.ts', 'utf8');
assert.match(footer, /timeLeftLabel && preview === null && requestedPage == null/, 'hidden while previewing a slider target');
assert.match(footer, /style=\{\[styles\.meta, hideReadingCounts && \{ opacity: 0 \}\]\}/, 'hidden together with the counts');
assert.match(screen, /enabled: bookStatus === "ready" && \(isEpub \|\| isReflowPdf\) && !studySelecting/, 'EPUB and Reflow only (chapters measured)');
assert.match(hook, /"@kindle\/reading-pace\.v1"/);
console.log('PASS reading pace: forward-page samples 3 s–10 min, median of ≥5, time per page and to the end of the book (no chapter estimate), pt-BR label, null without measured pace; footer/visibility wiring.');
