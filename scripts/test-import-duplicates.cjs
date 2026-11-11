// Fase 1, item 3: aviso de duplicado por SHA-256 na importação local. Índice local por conta, sem merge, sem novo
// modelo de UUID e sem tocar fileHash/Sync. Domínio + serviço com armazenamento/arquivos controlados; sem aparelho.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loader(mocks = {}) {
  const cache = new Map();
  return function load(file) {
    if (cache.has(file)) return cache.get(file);
    const exports = {}; cache.set(file, exports);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    new Function('require', 'exports', code)(name => {
      if (name in mocks) return mocks[name];
      const base = name.startsWith('@/') ? name.slice(2) : path.posix.join(path.posix.dirname(file), name);
      const target = ['.ts', '.tsx', ''].map(extension => base + extension).find(candidate => fs.existsSync(candidate));
      return target ? load(target) : require(name);
    }, exports);
    return exports;
  };
}

const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const book = (id, extra = {}) => ({ id, title: 'Livro ' + id, author: 'Teste', fileName: id + '.epub', filePath: 'file:///' + id, fileHash: null, mimeType: 'application/epub+zip', fileSize: 1, coverImagePath: null, totalChapters: 1, totalWords: 1, addedDate: 1, lastOpenedDate: null, isDeleted: false, progress: 0, ...extra });

(async () => {
  const load = loader({
    'react-native': { Platform: { OS: 'android' } },
    'expo-file-system/legacy': {},
    '@react-native-async-storage/async-storage': {},
  });
  const domain = load('src/domain/import/importDuplicates.ts');
  const { ImportDuplicateService, importHashKey } = load('src/data/imports/ImportDuplicateService.ts');
  const { libraryAccountScope } = load('src/data/library/LibraryAccountScope.ts');

  // Domínio: parse tolerante, limites, ordem e filtro de excluídos.
  const h1 = 'a'.repeat(64), h2 = 'b'.repeat(64);
  assert.deepEqual(domain.parseImportHashIndex(null).entries, {});
  assert.deepEqual(domain.parseImportHashIndex('{corrompido').entries, {});
  assert.deepEqual(domain.parseImportHashIndex(JSON.stringify({ version: 2, entries: { [h1]: ['x'] } })).entries, {});
  assert.deepEqual({ ...domain.parseImportHashIndex(JSON.stringify({ version: 1, entries: { [h1]: ['x', 'x', 5], NOTHASH: ['y'] } })).entries }, { [h1]: ['x'] });
  let index = domain.rememberImportHash(domain.emptyImportHashIndex(), h1, 'old');
  index = domain.rememberImportHash(index, h1, 'new');
  assert.deepEqual(index.entries[h1], ['old', 'new']);
  assert.equal(domain.rememberImportHash(index, 'curto', 'z'), index, 'hash inválido não entra');
  for (let i = 0; i < domain.MAX_BOOKS_PER_IMPORT_HASH + 5; i++) index = domain.rememberImportHash(index, h2, 'id' + i);
  assert.equal(index.entries[h2].length, domain.MAX_BOOKS_PER_IMPORT_HASH);
  assert.equal(index.entries[h2].at(-1), 'id' + (domain.MAX_BOOKS_PER_IMPORT_HASH + 4));
  const library = new Map([['old', book('old')], ['new', book('new', { isDeleted: true })]]);
  const found = await domain.findImportedDuplicate(index, h1, async id => library.get(id) ?? null);
  assert.equal(found.id, 'old', 'o mais recente ativo; excluído não conta');
  assert.equal(await domain.findImportedDuplicate(index, h1, async () => null), null, 'livro removido da biblioteca não gera aviso');
  assert.equal(await domain.findImportedDuplicate(index, h1, async () => { throw new Error('db'); }), null, 'erro de leitura não bloqueia');
  let capped = domain.emptyImportHashIndex();
  for (let i = 0; i < domain.MAX_IMPORT_HASHES + 3; i++) capped = domain.rememberImportHash(capped, i.toString(16).padStart(64, '0'), 'b' + i);
  assert.equal(Object.keys(capped.entries).length, domain.MAX_IMPORT_HASHES);
  assert.equal(capped.entries['0'.repeat(64)], undefined, 'sai o hash mais antigo');

  // Serviço: hash real (nativo base64 em blocos e Web Blob), por conta, sem conta = sem aviso.
  const bytes = crypto.randomBytes(1024 * 1024 + 4321);
  const expected = sha(bytes);
  const store = new Map();
  const storage = { getItem: async key => store.get(key) ?? null, setItem: async (key, value) => { store.set(key, value); } };
  const reads = [];
  const files = {
    getInfoAsync: async () => ({ exists: true, isDirectory: false, size: bytes.length }),
    readAsStringAsync: async (uri, options) => { reads.push([options.position, options.length]); return bytes.subarray(options.position, options.position + options.length).toString('base64'); },
  };
  const books = new Map();
  const service = new ImportDuplicateService({ findById: async id => books.get(id) ?? null }, storage, files, 'android');
  const picked = { uri: 'file:///cache/livro.epub', name: 'livro.epub', size: null };
  const signal = new AbortController().signal;

  libraryAccountScope.set(null);
  assert.deepEqual(await service.check(picked, signal), { hash: null, existing: null, userId: null }, 'sem conta: não calcula nem avisa');
  assert.equal(reads.length, 0);

  const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
  libraryAccountScope.set(A);
  const first = await service.check(picked, signal);
  assert.equal(first.hash, expected, 'SHA-256 nativo em blocos de 1 MiB');
  assert.deepEqual(reads.map(r => r[0]), [0, 1024 * 1024]);
  assert.equal(first.existing, null, 'primeira importação: sem aviso');
  books.set('book-1', book('book-1'));
  await service.remember(first, 'book-1');
  assert.ok(store.has(importHashKey(A)));
  const second = await service.check(picked, signal);
  assert.equal(second.existing.id, 'book-1', 'mesmo arquivo de novo: aviso com o livro existente');
  assert.equal(books.get('book-1').fileHash, null, 'fileHash do Sync não é tocado');

  libraryAccountScope.set(B);
  assert.equal((await service.check(picked, signal)).existing, null, 'conta B não vê o índice de A');
  await service.remember(second, 'outro', 'conta mudou: não grava no índice de A');
  assert.deepEqual(JSON.parse(store.get(importHashKey(A))).entries[expected], ['book-1']);
  assert.equal(store.has(importHashKey(B)), false);

  libraryAccountScope.set(A);
  books.set('book-1', book('book-1', { isDeleted: true }));
  assert.equal((await service.check(picked, signal)).existing, null, 'livro excluído: reimportar não avisa');

  const web = new ImportDuplicateService({ findById: async () => null }, storage, files, 'web');
  assert.equal((await web.check({ uri: 'blob:x', name: 'a.pdf', file: new Blob([bytes]) }, signal)).hash, expected, 'Web usa o Blob do seletor');
  assert.equal((await web.check({ uri: 'blob:x', name: 'a.pdf' }, signal)).hash, null, 'Web sem Blob: importa sem aviso');

  const huge = new ImportDuplicateService({ findById: async () => null }, storage, files, 'android');
  assert.equal((await huge.check({ ...picked, size: 513 * 1024 * 1024 }, signal)).hash, null, 'acima de 512 MiB: importa sem aviso');
  const broken = new ImportDuplicateService({ findById: async () => null }, storage, { ...files, readAsStringAsync: async () => { throw new Error('io'); } }, 'android');
  assert.equal((await broken.check(picked, signal)).hash, null, 'falha de leitura não bloqueia a importação');
  const aborted = new AbortController(); aborted.abort();
  await assert.rejects(service.check(picked, aborted.signal), error => error.name === 'AbortError', 'cancelar durante o hash cancela a importação');

  // Fluxo: verificar antes de importar, gravar depois do sucesso, cancelar responde ao aviso.
  const hook = fs.readFileSync('src/presentation/hooks/useBookImport.ts', 'utf8');
  assert.ok(hook.indexOf('importDuplicates.check(') < hook.indexOf('localBookImporter.import('), 'verifica antes de importar');
  assert.ok(hook.indexOf('lifecycle.succeed(') < hook.indexOf('importDuplicates.remember('), 'grava só depois do sucesso');
  assert.match(hook, /const cancel = \(\) => \{[\s\S]*answerDuplicate\("cancel"\)/);
  const modal = fs.readFileSync('src/presentation/components/BookImportModal.tsx', 'utf8');
  for (const label of ['Este livro já está na biblioteca', 'Abrir o existente', 'Importar outra cópia']) assert.ok(modal.includes(label), label);
  const screen = fs.readFileSync('app/(tabs)/library.tsx', 'utf8');
  assert.match(screen, /duplicate=\{bookImport\.duplicate\}/);
  console.log('PASS import duplicates: SHA-256 nativo/Web, índice local por conta (A≠B), excluído/removido/sem conta/>512 MiB/falha sem aviso, cancelamento, fileHash intacto. Sem aparelho.');
})().catch(error => { console.error(error); process.exit(1); });
