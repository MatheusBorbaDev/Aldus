// Onda A2: "Continue lendo" com até 3 leituras recentes e a coleção automática "Parados há 30 dias".
// Só usa atividade medida (abertura/gravação de progresso); livro sem registro nunca entra como parado nem como recente.
const assert = require('node:assert/strict'), fs = require('node:fs');
const load = require('./community-test-loader.cjs')({});
const { recentReads, isStalled, lastReadingActivity, STALLED_AFTER_MS } = load('src/domain/library/readingShelves.ts');
const now = Date.UTC(2026, 10, 11), day = 86_400_000;
const book = (id, extra) => ({ id, title: id, author: 'A', progress: 0.3, lastOpenedDate: null, lastReadAt: null, ...extra });
const books = [
  book('a', { lastReadAt: now - 1 * day }),
  book('b', { lastOpenedDate: now - 2 * day }),
  book('c', { lastReadAt: now - 40 * day }),
  book('d', { lastReadAt: now - 3 * day, progress: 1 }),
  book('e', {}),
  book('f', { lastReadAt: now - 50 * day, progress: 0.5 }),
];
assert.equal(lastReadingActivity(books[4]), 0, 'no activity → 0, never invented');
assert.deepEqual(recentReads(books, {}, 3).map(b => b.id), ['a', 'b', 'c'], 'most recent first, completed excluded, limited to 3');
assert.deepEqual(recentReads(books, { a: { readingStatus: 'completed' } }, 2).map(b => b.id), ['b', 'c'], 'manual completed status is respected');
assert.equal(STALLED_AFTER_MS, 30 * day);
assert.deepEqual(books.filter(b => isStalled(b, undefined, now)).map(b => b.id), ['c', 'f'], 'reading and idle for more than 30 days');
assert.equal(isStalled(books[4], undefined, now), false, 'no activity recorded → not stalled');
assert.equal(isStalled(books[2], { readingStatus: 'interrupted' }, now), false, 'interrupted on purpose is not "stalled"');
const library = fs.readFileSync('app/(tabs)/library.tsx', 'utf8');
assert.match(library, /recentReads\(books, organization, 3\)/); assert.match(library, /stalledCount \|\| filter === "stalled" \?/, 'the automatic chip only appears when it has books');
assert.match(library, /accessibilityLabel=\{`Continuar lendo \$\{card\.title\}`\}/, 'accessible label kept, now with the display title');
console.log('PASS reading shelves: up to 3 recent unfinished reads, stalled after 30 days of measured inactivity, no invented dates; chip only when non-empty.');
