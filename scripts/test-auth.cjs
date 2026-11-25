const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function load(file, dependencies = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Function('require', 'exports', code)(name => dependencies[name] ?? require(name), exports);
  return exports;
}

const rules = load('src/domain/auth/authRules.ts');
const profile = { id: 'a', username: 'reader_a', display_name: 'A', avatar_url: null, role: 'user', account_status: 'active' };
assert.equal(rules.normalizeUsername('  Matheus  '), 'matheus');
// 25/11/2026: the field shows the accepted form while typing (owner's sign-up with "matheus teste").
for (const [typed, shown] of [['matheus teste', 'matheus_teste'], ['João Silva', 'joao_silva'], ['@Ana-Clara', 'ana_clara'], ['x'.repeat(30), 'x'.repeat(24)]]) assert.equal(rules.usernameAsTyped(typed), shown, typed);
assert.ok(rules.validUsername(rules.usernameAsTyped('matheus teste')));
// 25/11/2026 (owner): each sign-up problem is tied to its field and names it, so a username error is never read as a password error.
const ok = { name: 'Matheus', username: 'matheus_teste', email: 'm@exemplo.com', password: 'segredo123', confirmation: 'segredo123' };
assert.deepEqual(rules.signupFieldErrors(ok), {});
assert.deepEqual(Object.keys(rules.signupFieldErrors({ ...ok, username: 'matheus teste' })), ['username']);
assert.match(rules.signupFieldErrors({ ...ok, username: 'matheus teste' }).username, /^Nome de usuário:/);
assert.deepEqual(Object.keys(rules.signupFieldErrors({ ...ok, confirmation: 'outra' })), ['confirmation']);
assert.deepEqual(Object.keys(rules.signupFieldErrors({ ...ok, password: 'curta', confirmation: 'curta' })), ['password']);
assert.deepEqual(Object.keys(rules.signupFieldErrors({ name: ' ', username: '1x', email: 'x', password: '', confirmation: '' })), ['name', 'username', 'email', 'password']);
for (const f of ['app/auth/signup.tsx', 'app/auth/complete-profile.tsx']) assert.match(require('fs').readFileSync(f, 'utf8'), /onChangeText=\{text => setUsername\(usernameAsTyped\(text\)\)\}/, f);
assert.equal(rules.validUsername(' Matheus '), true);
assert.equal(rules.validUsername('a'), false);
assert.equal(rules.validUsername('a.b'), false);
assert.equal(rules.canUseFeature(profile, {}, 'flashcards'), true);
assert.equal(rules.canUseFeature(profile, { flashcards: false }, 'flashcards'), false);
assert.equal(rules.canUseFeature({ ...profile, role: 'master' }, { flashcards: false }, 'flashcards'), true);
assert.equal(rules.canUseFeature({ ...profile, account_status: 'disabled' }, {}, 'flashcards'), false);
assert.equal(rules.canUseFeature({ ...profile, username: null }, {}, 'flashcards'), false);
assert.equal(rules.canUseFeature(null, {}, 'flashcards'), false);

if (process.argv.includes('--auth-only')) {
  console.log('PASS auth username, role, status and feature permission rules (no flashcard repository tests)');
} else {
const memory = new Map();
const storage = { getItem: async key => memory.get(key) ?? null, setItem: async (key, value) => memory.set(key, value) };
const flashcardTypes = load('src/domain/types/flashcards.ts');
const flashcardScoring = load('src/domain/study/flashcardScoring.ts', { '../types/flashcards': flashcardTypes });
const { LocalFlashcardRepository } = load('src/data/local/FlashcardRepository.ts', {
  './flashcardStorage': { flashcardStorage: storage },
  '@/src/domain/types/flashcards': flashcardTypes,
  '@/src/domain/study/flashcardScoring': flashcardScoring,
  '@react-native-async-storage/async-storage': storage,
  '@/src/domain/study/flashcardSrs': { computeFlashcardSrs: () => ({ interval: 1, repetition: 1, easeFactor: 2.5, dueAt: 0 }) },
});
(async () => {
  const a = new LocalFlashcardRepository(storage, '@kindle/flashcards.v1:account-a');
  const b = new LocalFlashcardRepository(storage, '@kindle/flashcards.v1:account-b');
  await a.createDeck({ id: 'deck-a', title: 'A', bookIds: [], createdAt: 0, updatedAt: 0 });
  assert.equal((await a.load()).decks.length, 1);
  assert.equal((await b.load()).decks.length, 0);
  assert.equal(memory.has('@kindle/flashcards.v1'), false);
  console.log('PASS auth rules and local flashcard account isolation');
})().catch(error => { console.error(error); process.exitCode = 1; });
}
