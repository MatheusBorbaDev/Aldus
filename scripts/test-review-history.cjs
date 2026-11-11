// Onda A4: histórico de revisão medido nos eventos gravados (sem eventos → nada exibido; nada estimado).
const assert = require('node:assert/strict'), fs = require('node:fs');
const load = require('./community-test-loader.cjs')({});
const { reviewHistory, isCorrectRating } = load('src/domain/study/reviewHistory.ts');
const day = 86_400_000, now = Date.UTC(2026, 10, 11, 12);
const ev = (cardId, rating, daysAgo) => ({ id: `${cardId}-${daysAgo}-${rating}`, cardId, rating, reviewedAt: now - daysAgo * day, durationMs: 0 });
const cards = [{ id: 'a', deckId: 'd1', title: 'Virtude' }, { id: 'b', deckId: 'd1', title: 'Fortuna' }, { id: 'c', deckId: 'd2', title: 'Tempo' }];
assert.equal(reviewHistory([], cards, now), null, 'no reviews → null (no invented zeros)');
assert.deepEqual([1, 2, 3, 4].map(isCorrectRating), [false, false, true, true], 'ratings 3–4 are correct answers (answerStudy mapping)');
const reviews = [ev('a', 1, 0.5), ev('a', 2, 1), ev('a', 4, 2), ev('b', 3, 1), ev('b', 1, 9), ev('c', 4, 20), ev('gone', 1, 1), ev('gone', 1, 2), ev('old', 4, 60)];
const h = reviewHistory(reviews, cards, now);
assert.equal(h.total, 9);
assert.deepEqual(h.weeks.map(w => [w.reviewed, w.correct]), [[0, 0], [1, 1], [1, 0], [6, 2]], 'four 7-day windows, oldest → current; >28 days ignored');
assert.deepEqual(h.missed.map(m => [m.card.id, m.wrong, m.total]), [['a', 2, 3]], 'only existing cards with at least 2 wrong answers');
const study = fs.readFileSync('app/(tabs)/study.tsx', 'utf8');
assert.match(study, /snapshot \? reviewHistory\(snapshot\.reviews \?\? \[\], snapshot\.cards\) : null/);
assert.match(study, /\{history \? \(/, 'block rendered only with measured history');
console.log('PASS review history: null without reviews, 4 rolling weeks with accuracy, most missed among existing cards (≥2 errors).');
