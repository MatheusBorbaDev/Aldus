// Redesign step 4: "Para revisar hoje" counts only measured, playable, due cards of existing decks.
const assert = require('node:assert/strict'), fs = require('node:fs');
const load = require('./community-test-loader.cjs')({});
const { reviewSummary } = load('src/domain/study/flashcardSrs.ts');
const { isPlayableFlashcard } = load('src/domain/types/flashcards.ts');
const now = 1_000_000;
const card = (id, deckId, extra = {}) => ({ id, deckId, title: 'T', statement: 'Afirmação', explanation: 'Explicação', front: 'Afirmação', back: 'Explicação', isTrue: true, status: 'approved', dueAt: now - 1, ...extra });
const decks = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
const cards = [card('1', 'a'), card('2', 'b'), card('3', 'b'), card('4', 'b', { dueAt: now + 60_000 }), card('5', 'c', { status: 'draft' }), card('6', 'c', { isTrue: undefined }), card('7', 'gone')];
const summary = reviewSummary(decks, cards, isPlayableFlashcard, now);
assert.equal(summary.total, 3, 'future, draft, incomplete and orphan cards are not counted');
assert.deepEqual([...summary.byDeck], [['a', 1], ['b', 2]]); assert.equal(summary.nextDeckId, 'b', 'start with the deck that has most due cards');
const none = reviewSummary(decks, [card('4', 'b', { dueAt: now + 1 })], isPlayableFlashcard, now);
assert.equal(none.total, 0); assert.equal(none.nextDeckId, null);
const study = fs.readFileSync('app/(tabs)/study.tsx', 'utf8');
assert.match(study, /if \(!snapshot\) return null;/, 'no number before the local snapshot loads');
assert.match(study, /variant=\{review\?\.next \? "secondary" : "primary"\}/, 'one primary action: Revisar when there is something due');
console.log('PASS study review: due playable cards per existing deck, next deck, measured zero, nothing shown before the snapshot; single primary action.');
