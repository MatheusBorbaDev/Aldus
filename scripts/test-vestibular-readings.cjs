// Leituras de vestibular (25/11/2026): ordem próximas/passadas, "ainda não publicada", contrato estrito e sugestões.
const assert = require('node:assert/strict');
const load = require('./community-test-loader.cjs')({});
const v = load('src/domain/study/vestibularReadings.ts');
const row = (year, extra = {}) => ({ vestibular_id: 'fuvest', exam_year: year, source_url: `https://www.fuvest.br/edital-${year}`, books: [{ position: 2, title: 'Dom Casmurro', author: 'Machado de Assis' }, { position: 1, title: 'Iracema', author: 'José de Alencar', note: null }], ...extra });
const lists = v.parseReadingLists([row(2025), row(2027), row(2026), row(2028), row(2024), { ...row(2027), vestibular_id: 'unicamp' }]);
assert.deepEqual(lists[0].books.map(b => b.title), ['Iracema', 'Dom Casmurro'], 'books in the order of the edital');
// Nov 2026: the exam ahead is the 2027 edition; 2026 already happened in January? It still counts as upcoming during 2026.
let view = v.vestibularReadingsView(lists, 'fuvest', new Date(2026, 10, 25));
assert.equal(view.targetYear, 2027); assert.equal(view.targetPending, false);
assert.deepEqual(view.upcoming.map(l => l.examYear), [2026, 2027, 2028], 'upcoming nearest first, future published lists included');
assert.deepEqual(view.past.map(l => l.examYear), [2025, 2024], 'past newest first');
assert.ok(view.upcoming.every(l => l.vestibularId === 'fuvest') && view.past.every(l => l.vestibularId === 'fuvest'), 'only the chosen vestibular');
view = v.vestibularReadingsView(lists, 'fuvest', new Date(2028, 2, 1));
assert.equal(view.targetYear, 2029); assert.equal(view.targetPending, true, 'no 2029 list yet: said, not invented');
assert.deepEqual(view.upcoming.map(l => l.examYear), [2028]);
view = v.vestibularReadingsView(lists, 'ufpr', new Date(2026, 10, 25));
assert.deepEqual([view.upcoming.length, view.past.length, view.targetPending], [0, 0, true], 'vestibular without lists');
// Strict contract: no source, http, empty list, bad id or year are refused instead of shown.
for (const bad of [{ source_url: null }, { source_url: 'http://x.br' }, { books: [] }, { vestibular_id: 'Fuvest!' }, { exam_year: 2026.5 }, { books: [{ title: '', author: 'x' }] }])
  assert.throws(() => v.parseReadingLists([row(2027, bad)]), v.VestibularContractError, JSON.stringify(bad));
assert.throws(() => v.parseReadingLists(null), v.VestibularContractError);
assert.deepEqual(v.parseVestibulares([{ id: 'fuvest', name: 'Fuvest', institution: 'Universidade de São Paulo (USP)', official_url: 'https://www.fuvest.br' }]), [{ id: 'fuvest', name: 'Fuvest', institution: 'Universidade de São Paulo (USP)', officialUrl: 'https://www.fuvest.br' }]);
assert.throws(() => v.parseVestibulares([{ id: 'x y', name: 'A', institution: 'B' }]), v.VestibularContractError);
// Suggestions: trimmed, bounded, optional vestibular.
assert.deepEqual(v.validSuggestion({ vestibularId: null, message: '  Incluir a UERJ  ' }), { vestibularId: null, message: 'Incluir a UERJ' });
assert.throws(() => v.validSuggestion({ vestibularId: null, message: 'oi' }), /Escreva um pouco mais/);
assert.throws(() => v.validSuggestion({ vestibularId: null, message: 'x'.repeat(601) }), /até 600/);
assert.throws(() => v.validSuggestion({ vestibularId: 'A B', message: 'Faltou um livro' }));
console.log('PASS vestibular readings: upcoming (nearest first) and past (newest first) per vestibular, target year pending said instead of invented, strict contract with official https source, bounded suggestions.');
