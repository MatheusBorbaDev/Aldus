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
// Admin paste: one work per line, numbering ignored, separators accepted, line errors named.
let pasted = v.parseBookLines('1. Iracema — José de Alencar\n\n2) Dom Casmurro - Machado de Assis\nO cortiço; Aluísio Azevedo');
assert.deepEqual(pasted.errors, []); assert.deepEqual(pasted.books.map(b => [b.position, b.title, b.author]), [[1, 'Iracema', 'José de Alencar'], [2, 'Dom Casmurro', 'Machado de Assis'], [3, 'O cortiço', 'Aluísio Azevedo']]);
assert.deepEqual(v.parseBookLines('Iracema — José de Alencar\nSem autor aqui').errors, ['Linha 2: use "Título — Autor".']);
assert.deepEqual(v.parseBookLines('  ').errors, ['Cole ao menos uma obra.']);
assert.equal(v.parseBookLines('A-B — C').books[0].title, 'A-B', 'hyphen inside a title is kept');
// Download match: the same work only (title prefix, accents/case/punctuation folded, author surname when present).
const iracema = { title: 'Iracema', author: 'José de Alencar' };
assert.ok(v.sameWork({ title: 'Iracema: Lenda do Ceará', author: 'Alencar, José Martiniano de' }, iracema));
assert.ok(v.sameWork({ title: 'iracema.epub' }, iracema), 'file name without author');
assert.ok(!v.sameWork({ title: 'Iracema', author: 'Outro Autor' }, iracema), 'wrong author');
assert.ok(!v.sameWork({ title: 'Lenda de Iracema', author: 'José de Alencar' }, iracema), 'title must start with the work');
assert.ok(v.sameWork({ title: 'Memorias Posthumas de Braz Cubas'.replace('Posthumas','Póstumas').replace('Braz','Brás'), author: 'Machado de Assis' }, { title: 'Memórias Póstumas de Brás Cubas', author: 'Machado de Assis' }));
assert.ok(!v.sameWork({ title: 'Dom', author: 'Machado de Assis' }, { title: 'Dom Casmurro', author: 'Machado de Assis' }), 'partial title is not the work');
assert.equal(v.vestibularDownloadQuery({ title: 'O cortiço', author: 'Aluísio Azevedo' }), 'O cortiço azevedo');
console.log('PASS vestibular readings: upcoming (nearest first) and past (newest first) per vestibular, target year pending said instead of invented, strict contract with official https source, bounded suggestions.');

// Data layer: server first, device copy when offline, copy re-validated, suggestions mapped to readable errors.
(async () => {
  const { VestibularReadingsService, VESTIBULAR_CACHE_KEY, VESTIBULAR_CHOICE_KEY } = load('src/data/study/VestibularReadingsService.ts');
  const store = new Map(); let failWrite = false;
  const storage = { getItem: async k => store.get(k) ?? null, setItem: async (k, val) => { if (failWrite) throw Error('quota'); store.set(k, val); } };
  const vrows = [{ id: 'fuvest', name: 'Fuvest', institution: 'USP', official_url: 'https://www.fuvest.br' }];
  let online = true, answer = { ok: true }, sent = [];
  const remote = { readVestibulares: async () => { if (!online) throw Error('offline'); return vrows; }, readLists: async () => { if (!online) throw Error('offline'); return [row(2027)]; }, suggest: async (id, m) => { sent.push([id, m]); return answer; } };
  const service = new VestibularReadingsService(remote, storage, () => new Date('2026-11-25T12:00:00Z'));
  let r = await service.read(); assert.equal(r.source, 'server'); assert.equal(r.snapshot.lists[0].books[0].title, 'Iracema'); assert.ok(store.has(VESTIBULAR_CACHE_KEY));
  online = false; r = await service.read(); assert.equal(r.source, 'copy', 'offline uses the device copy'); assert.equal(r.snapshot.savedAt, '2026-11-25T12:00:00.000Z'); assert.equal(r.snapshot.lists[0].sourceUrl, 'https://www.fuvest.br/edital-2027');
  store.set(VESTIBULAR_CACHE_KEY, JSON.stringify({ savedAt: 'x', vestibulares: [], lists: [{ vestibularId: 'fuvest', examYear: 2027, sourceUrl: 'http://bad', books: [] }] }));
  r = await service.read(); assert.equal(r.source, 'unavailable', 'a tampered copy is not shown');
  online = true; failWrite = true; r = await service.read(); assert.equal(r.source, 'server', 'a failed copy write still shows the list'); failWrite = false;
  assert.equal((await new VestibularReadingsService(null, new Map() && { getItem: async () => null, setItem: async () => undefined }).read()).source, 'unavailable');
  // Choice stays on the device and is validated.
  await service.saveChoice('unicamp'); assert.equal(await service.readChoice(), 'unicamp'); store.set(VESTIBULAR_CHOICE_KEY, '../x'); assert.equal(await service.readChoice(), null);
  // Suggestions.
  await service.suggest({ vestibularId: 'fuvest', message: '  Faltou um livro  ' }); assert.deepEqual(sent.at(-1), ['fuvest', 'Faltou um livro']);
  answer = { ok: false, code: 'rate' }; await assert.rejects(service.suggest({ vestibularId: null, message: 'Incluir UERJ' }), /5 sugestões hoje/);
  answer = { ok: false, code: 'account' }; await assert.rejects(service.suggest({ vestibularId: null, message: 'Incluir UERJ' }), /Entre na sua conta/);
  await assert.rejects(service.suggest({ vestibularId: null, message: 'oi' }), /Escreva um pouco mais/);
  remote.suggest = async () => { throw Error('net'); }; await assert.rejects(service.suggest({ vestibularId: null, message: 'Incluir UERJ' }), /Confira a internet/);
  console.log('PASS vestibular data: server first with device copy, offline copy with its date, tampered copy refused, failed copy write still shows, device-only choice, suggestion errors in plain language.');
})().catch(error => { console.error(error); process.exitCode = 1; });
