// Bundled catalogue policy (acervo, etapa 1 de 3):
// - new accounts/installs receive only declared public-domain Portuguese originals;
// - the 33 legacy titles stay in the package only for existing accounts, untouched and still resolvable;
// - every shipped/published file is declared with a matching SHA-256.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');
const { spawnSync } = require('node:child_process');

// Minimal loader (same transpile as community-test-loader) that also provides Metro's require.context.
function makeLoader(overrides = {}) {
  const cache = new Map();
  const context = (directory, _recursive, filter) => {
    const names = fs.readdirSync(path.resolve('src/data/local', directory)).filter(name => filter.test(name));
    const ctx = key => ({ key });
    ctx.keys = () => names.map(name => './' + name);
    return ctx;
  };
  function load(file) {
    file = path.resolve(file);
    if (!fs.existsSync(file)) file = [file + '.ts', file + '.tsx'].find(candidate => fs.existsSync(candidate)) ?? file;
    if (cache.has(file)) return cache.get(file).exports;
    if (file.endsWith('.json')) return require(file);
    const module = { exports: {} }; cache.set(file, module);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const resolve = name => Object.hasOwn(overrides, name) ? overrides[name] : name.startsWith('@/') ? load(name.slice(2)) : name.startsWith('.') ? load(path.resolve(path.dirname(file), name)) : require(name);
    resolve.context = context;
    new Function('require', 'module', 'exports', code)(resolve, module, module.exports);
    return module.exports;
  }
  return load;
}
const load = makeLoader({ 'expo-asset': { Asset: { fromModule: () => { throw new Error('asset bytes must not be read during registration'); } } }, 'react-native': { Platform: { OS: 'android' } } });

const { BUNDLED_BOOKS, findBundledBookByFileName } = load('src/data/library/bundledCatalog.ts');
const { LEGACY_BUNDLED_BOOKS } = load('src/data/library/legacyBundledCatalog.ts');
const identity = load('src/data/library/BundledBookIdentity.ts');
const { bookSyncPayload } = load('src/data/library/LibrarySyncPayload.ts');
const { libraryAccountScope } = load('src/data/library/LibraryAccountScope.ts');

const files = fs.readdirSync('assets/Livros').filter(name => /\.(pdf|epub)$/i.test(name));
const active = identity.bundledBookManifest, legacy = identity.legacyBundledAssets;
const sha = file => crypto.createHash('sha256').update(fs.readFileSync('assets/Livros/' + file)).digest('hex');
const thisYear = new Date().getFullYear();

// 1. Active catalogue: declared, licensed, public domain in Brazil, hash-checked.
assert.equal(active.length, BUNDLED_BOOKS.length, 'active manifest and catalogue must list the same titles');
for (const record of active) {
  const entry = findBundledBookByFileName(record.fileName);
  assert.ok(entry, `${record.fileName} must be declared in src/data/library/bundledCatalog.ts`);
  assert.ok(entry.source && entry.license, `${record.fileName} must declare source and license`);
  // Lei 9.610/98 art. 41: 70 years counted from 1 January after the author's death.
  assert.ok(entry.authorDeathYear + 70 < thisYear, `${record.fileName}: author must have died more than 70 years ago`);
  assert.ok(files.includes(record.fileName), `${record.fileName} missing from assets/Livros`);
  assert.equal(record.hash, sha(record.fileName), `${record.fileName} active manifest hash is stale`);
  assert.equal(identity.isLegacyBundledAsset(record.id), false, `${record.fileName} cannot be active and legacy`);
}
for (const book of BUNDLED_BOOKS) if (book.coverUri) assert.ok(fs.existsSync(book.coverUri), `missing cover ${book.coverUri}`);

// 2. Legacy list: exactly the 33 previously shipped titles, still present with the same bytes (stage 1 keeps them).
assert.equal(legacy.length, 33, 'legacy list keeps every previously shipped identity');
for (const record of legacy) {
  assert.ok(files.includes(record.fileName), `${record.fileName}: legacy files stay in the package until stage 3`);
  assert.equal(record.hash, sha(record.fileName), `${record.fileName} legacy hash changed`);
  assert.ok(record.size > 0 && record.legacyId, `${record.fileName} keeps size/legacyId for Sync replicas`);
  assert.ok(LEGACY_BUNDLED_BOOKS.some(book => book.fileUri.split('/').pop() === record.fileName), `${record.fileName} keeps its display metadata`);
}
for (const file of files) assert.ok(active.some(r => r.fileName === file) || legacy.some(r => r.fileName === file), `${file} is not declared as active or legacy`);

// 3. Existing records keep working unchanged: identity lookup, Sync payload and legacy short ids.
const user = '11111111-1111-4111-8111-111111111111';
const old = legacy[0];
const existing = { id: `${old.id}--${user}`, bundledAssetId: old.id, filePath: `bundled-pdf://${old.id}--${user}`, fileHash: old.hash, remotePath: null, mimeType: 'application/pdf', fileSize: old.size, title: 'x', author: 'y', fileName: old.fileName };
assert.equal(identity.findBundledAsset(existing.id)?.hash, old.hash);
assert.equal(identity.findBundledAsset(`${old.legacyId}--${user}`)?.id, old.id, 'short legacy ids still resolve');
assert.equal(bookSyncPayload(existing).bundledAssetId, old.id, 'Sync payload still identifies the bundled content (no upload, no new storage)');
assert.equal(identity.isLegacyBundledBook(existing), true);
assert.equal(identity.isLegacyBundledBook({ ...existing, filePath: 'file:///imported/own.pdf' }), false, 'own copies are not legacy-dependent');
assert.equal(identity.isLegacyBundledBook({ ...existing, remotePath: 'u/b/hash.pdf' }), false, 'private cloud copies are not legacy-dependent');
assert.match(identity.LEGACY_BUNDLED_UNAVAILABLE_MESSAGE, /saiu do acervo incluído/);

(async () => {
  // 4. Registration: a new account gets only the active titles; an existing account keeps legacy records untouched.
  const { BundledEpubCatalog } = load('src/data/epub/BundledEpubCatalog.ts');
  const { BundledPdfCatalog } = load('src/data/local/BundledPdfCatalog.ts');
  libraryAccountScope.set(user);
  const repository = (initial = []) => {
    const rows = new Map(initial.map(book => [book.id, structuredClone(book)])); const saves = [];
    return { rows, saves, listOwned: async () => [...rows.values()], listActive: async () => [...rows.values()].filter(b => !b.isDeleted), findById: async id => rows.get(id) ?? null, save: async book => { saves.push(book.id); rows.set(book.id, structuredClone(book)); } };
  };
  const importer = { importFromUri: async (uri, fileName, id) => ({ id, title: fileName, author: '', fileName, filePath: uri, fileHash: null, mimeType: 'application/pdf', fileSize: 0, coverImagePath: null, totalChapters: 0, totalWords: 0, addedDate: 1, lastOpenedDate: null, isDeleted: false, progress: 0, importComplete: true }) };

  const fresh = repository();
  await new BundledEpubCatalog(fresh).registerAll();
  await new BundledPdfCatalog(importer, fresh).importAll();
  const registered = [...fresh.rows.values()];
  assert.deepEqual(registered.map(b => b.bundledAssetId).sort(), active.map(r => r.id).sort(), 'new accounts receive only the public-domain catalogue');
  assert.ok(registered.every(b => !identity.isLegacyBundledAsset(b.bundledAssetId)));

  const progressed = { ...existing, title: 'Título antigo', progress: 0.42, isDeleted: false, importComplete: true, addedDate: 1, lastOpenedDate: 2, totalChapters: 3, totalWords: 4, coverImagePath: null };
  const deletedLegacy = { ...progressed, id: `${legacy[1].id}--${user}`, bundledAssetId: legacy[1].id, fileName: legacy[1].fileName, fileHash: legacy[1].hash, isDeleted: true };
  const legacyEpub = legacy.find(r => r.format === 'epub');
  const epubRecord = { ...progressed, id: `${legacyEpub.id}--${user}`, bundledAssetId: legacyEpub.id, fileName: legacyEpub.fileName, fileHash: legacyEpub.hash, filePath: `bundled-epub://${legacyEpub.id}--${user}`, mimeType: 'application/epub+zip' };
  const before = [progressed, deletedLegacy, epubRecord];
  const existingAccount = repository(before);
  await new BundledEpubCatalog(existingAccount).registerAll();
  await new BundledPdfCatalog(importer, existingAccount).importAll();
  for (const book of before) assert.deepEqual(existingAccount.rows.get(book.id), book, `${book.fileName}: existing legacy record must stay intact (visible, progress, tombstone)`);
  assert.ok(existingAccount.saves.every(id => !before.some(book => book.id === id)), 'legacy records are never rewritten');
  assert.equal(existingAccount.rows.size, before.length + active.length, 'existing accounts also gain the new public-domain titles');

  // 5. Web export: every file in assets/Livros declared (active or legacy) with matching hash; nothing copied to dist/assets/Livros.
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'aldus-dist-books-'));
  try {
    fs.mkdirSync(path.join(sandbox, 'src/data/library'), { recursive: true });
    for (const name of ['bundledBookManifest.json', 'legacyBundledAssets.json']) fs.copyFileSync(`src/data/library/${name}`, path.join(sandbox, 'src/data/library', name));
    fs.mkdirSync(path.join(sandbox, 'assets/Livros'), { recursive: true });
    const sample = [...active.map(r => r.fileName), legacy[0].fileName];
    for (const file of sample) fs.copyFileSync('assets/Livros/' + file, path.join(sandbox, 'assets/Livros', file));
    fs.mkdirSync(path.join(sandbox, 'dist/assets/Livros'), { recursive: true });
    fs.writeFileSync(path.join(sandbox, 'dist/assets/Livros', 'stale.pdf'), 'stale copy');
    const script = path.resolve('scripts/copy-books-to-dist.mjs');
    const run = env => spawnSync(process.execPath, [script], { cwd: sandbox, encoding: 'utf8', env: { ...process.env, ...env } });
    // A main não copia livros para dist/assets/Livros (o Metro já os empacota com hash; onda 2). O script só confere e limpa cópia antiga.
    let result = run({});
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.existsSync(path.join(sandbox, 'dist/assets/Livros')), false, 'stale dist copy removed; no second copy of the books');
    assert.ok(result.stdout.includes(active.length + ' em domínio público + 1 legado'), result.stdout);
    fs.writeFileSync(path.join(sandbox, 'assets/Livros', legacy[0].fileName), 'conteúdo trocado');
    result = run({});
    assert.notEqual(result.status, 0, 'hash divergente falha o export'); assert.match(result.stderr, /hash diferente/);
    fs.copyFileSync('assets/Livros/' + legacy[0].fileName, path.join(sandbox, 'assets/Livros', legacy[0].fileName));
    fs.writeFileSync(path.join(sandbox, 'assets/Livros', 'nao-declarado.pdf'), '%PDF-1.4 undeclared');
    result = run({});
    assert.notEqual(result.status, 0, 'undeclared files fail the export'); assert.match(result.stderr, /não declarado/);
  } finally { fs.rmSync(sandbox, { recursive: true, force: true }); }
  console.log(`PASS bundled catalogue: ${active.length} public-domain titles for new accounts; ${legacy.length} legacy identities kept intact for existing accounts; dist declared and hash-checked.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
