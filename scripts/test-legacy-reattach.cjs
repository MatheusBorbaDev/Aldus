// Acervo, etapas 2 e 3 (decisão do usuário em 11/11/2026: "reanexar ao importar"). Os 33 títulos protegidos saíram do pacote;
// o registro da conta continua e, quando a pessoa importa o MESMO arquivo (SHA-256 do acervo legado), ele vira a cópia própria
// desse registro (mesmo ID, progresso), sem vínculo com o pacote, e o Sync o trata como arquivo próprio. Outro aparelho deixa de
// apontar para o arquivo embutido. Serviço e réplica reais com armazenamento simulado; sem aparelho, conta real ou Supabase.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loader(mocks = {}) {
  const cache = new Map();
  return function load(file) {
    if (cache.has(file)) return cache.get(file);
    const exports = {}; cache.set(file, exports);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, resolveJsonModule: true, esModuleInterop: true },
    }).outputText;
    new Function('require', 'exports', code)(name => {
      if (name in mocks) return mocks[name];
      const base = name.startsWith('@/') ? name.slice(2) : path.posix.join(path.posix.dirname(file), name);
      const target = ['.ts', '.tsx', ''].map(extension => base + extension).find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
      if (target?.endsWith('.json')) return JSON.parse(fs.readFileSync(target, 'utf8'));
      return target ? load(target) : require(name);
    }, exports);
    return exports;
  };
}

(async () => {
  const load = loader({ 'react-native': { Platform: { OS: 'android' } }, 'expo-file-system/legacy': {} });
  const identity = load('src/data/library/BundledBookIdentity.ts');
  const { LegacyBundledReattachService } = load('src/data/imports/LegacyBundledReattachService.ts');
  const { bookSyncPayload } = load('src/data/library/LibrarySyncPayload.ts');
  const { libraryAccountScope } = load('src/data/library/LibraryAccountScope.ts');
  const { LibraryLocalReplica } = load('src/data/library/LibraryLocalReplica.ts');

  const asset = identity.legacyBundledAssets.find(item => item.format === 'pdf');
  const epubAsset = identity.legacyBundledAssets.find(item => item.format === 'epub');
  const A = '11111111-1111-4111-8111-111111111111';
  const legacyRecord = (a, extra = {}) => ({ id: `${a.id}--${A}`, ownerUserId: A, bundledAssetId: a.id, importComplete: true, title: 'Título da conta', author: 'Autor',
    fileName: a.fileName, filePath: `bundled-${a.format}://${a.id}--${A}`, fileHash: a.hash, fileSize: a.size, mimeType: a.format === 'pdf' ? 'application/pdf' : 'application/epub+zip',
    coverImagePath: null, totalChapters: 5, totalWords: 900, addedDate: 1, lastOpenedDate: 2, isDeleted: false, progress: 0.42, ...extra });
  const repo = initial => {
    const rows = new Map(initial.map(book => [book.id, { ...book }])); const saves = [];
    return { rows, saves, listOwned: async () => [...rows.values()], listActive: async () => [...rows.values()].filter(b => !b.isDeleted),
      findById: async id => rows.get(id) ?? null, save: async book => { saves.push(book.id); rows.set(book.id, { ...book }); } };
  };
  const fsCalls = [];
  const files = { documentDirectory: 'file:///docs/', makeDirectoryAsync: async () => undefined,
    copyAsync: async options => { fsCalls.push(['copy', options.from, options.to]); }, deleteAsync: async uri => { fsCalls.push(['delete', uri]); } };
  const signal = new AbortController().signal;

  // Etapa 3: arquivos fora do pacote; identidade e hash do legado continuam conhecidos.
  for (const item of identity.legacyBundledAssets) assert.equal(fs.existsSync('assets/Livros/' + item.fileName), false, item.fileName + ' saiu do pacote');
  assert.match(identity.LEGACY_BUNDLED_UNAVAILABLE_MESSAGE, /mesmo arquivo.*progresso/);

  libraryAccountScope.set(A);
  const books = repo([legacyRecord(asset), legacyRecord(epubAsset, { isDeleted: true }), { ...legacyRecord(identity.legacyBundledAssets[2]), filePath: 'file:///own.pdf', bundledAssetId: undefined }]);
  const service = new LegacyBundledReattachService(books, undefined, files, 'android');
  assert.equal((await service.find(asset.hash)).id, `${asset.id}--${A}`, 'mesmo arquivo do acervo → livro da conta');
  assert.equal(await service.find('0'.repeat(64)), null, 'arquivo qualquer não reanexa');
  assert.equal(await service.find(epubAsset.hash), null, 'livro excluído não volta');
  assert.equal(await service.find(identity.legacyBundledAssets[2].hash), null, 'livro que já tem cópia própria não é trocado');
  assert.equal(await service.find(null), null);
  libraryAccountScope.set(null); assert.equal(await service.find(asset.hash), null, 'sem conta: nada a reanexar'); libraryAccountScope.set(A);

  const target = await service.find(asset.hash);
  await assert.rejects(service.reattach(target, { uri: 'file:///cache/x.pdf', name: 'x.pdf' }, '1'.repeat(64), signal), /não corresponde/);
  assert.equal(books.saves.length, 0, 'hash divergente não grava');
  const restored = await service.reattach(target, { uri: 'file:///cache/meu.pdf', name: 'meu.pdf' }, asset.hash, signal);
  assert.equal(restored.id, target.id, 'mesmo ID'); assert.equal(restored.progress, 0.42, 'progresso mantido'); assert.equal(restored.totalChapters, 5);
  assert.equal(restored.bundledAssetId, undefined, 'sem vínculo com o pacote'); assert.equal(restored.fileHash, asset.hash); assert.equal(restored.remotePath, null);
  assert.match(restored.filePath, /^file:\/\/\/docs\/books\/imported\/acervo-bundled-pdf-[a-f0-9]+--[0-9a-f-]+\.pdf$/);
  assert.deepEqual(fsCalls.at(-1), ['copy', 'file:///cache/meu.pdf', restored.filePath]);
  assert.equal(identity.isLegacyBundledBook(restored), false, 'agora é cópia própria');
  assert.equal(bookSyncPayload(restored).bundledAssetId, null, 'o Sync envia como arquivo próprio (vai para a nuvem privada)');
  assert.equal(await service.find(asset.hash), null, 'reimportar de novo não reanexa duas vezes');

  // Falhas: cópia ou gravação falhando não deixam lixo; conta trocada depois de gravar não apaga a cópia gravada.
  const failing = repo([legacyRecord(asset)]); fsCalls.length = 0;
  const failSave = new LegacyBundledReattachService({ ...failing, save: async () => { throw new Error('disco'); } }, undefined, files, 'android');
  await assert.rejects(failSave.reattach(legacyRecord(asset), { uri: 'file:///c.pdf', name: 'c.pdf' }, asset.hash, signal), /disco/);
  assert.equal(fsCalls.filter(c => c[0] === 'delete').length, 1, 'gravação falhou: cópia apagada');
  fsCalls.length = 0;
  const switching = repo([legacyRecord(asset)]);
  const switchAfterSave = new LegacyBundledReattachService({ ...switching, save: async book => { await switching.save(book); libraryAccountScope.set('22222222-2222-4222-8222-222222222222'); } }, undefined, files, 'android');
  await assert.rejects(switchAfterSave.reattach(legacyRecord(asset), { uri: 'file:///c.pdf', name: 'c.pdf' }, asset.hash, signal));
  assert.equal(fsCalls.filter(c => c[0] === 'delete').length, 0, 'registro já aponta para a cópia: não apagar');
  libraryAccountScope.set(A);

  // Web: Blob salvo no armazenamento do navegador sob o mesmo ID.
  const webSaves = [];
  const webBooks = repo([legacyRecord(asset)]);
  const web = new LegacyBundledReattachService(webBooks, { save: async (id, name, blob) => { webSaves.push([id, name, blob.size]); }, delete: async () => undefined }, files, 'web');
  await assert.rejects(web.reattach(legacyRecord(asset), { uri: 'blob:x', name: 'a.pdf' }, asset.hash, signal), /navegador/);
  const webRestored = await web.reattach(legacyRecord(asset), { uri: 'blob:x', name: 'a.pdf', file: new Blob(['%PDF']) }, asset.hash, signal);
  assert.equal(webRestored.filePath, `web-pdf://${webRestored.id}`); assert.deepEqual(webSaves, [[webRestored.id, asset.fileName, 4]]);

  // Réplica em outro aparelho: o mesmo livro chega sem vínculo com o pacote → deixa de apontar para o arquivo embutido.
  const stored = new Map([[`${asset.id}--${A}`, legacyRecord(asset)]]);
  const storage = { listAll: async () => [...stored.values()], save: async book => { stored.set(book.id, { ...book }); } };
  const replica = new LibraryLocalReplica(storage, {}, {}, {}, {}, {});
  const entry = payload => ({ kind: 'book', id: `${asset.id}--${A}`, bookId: `${asset.id}--${A}`, deleted: false, payload });
  await replica.apply(A, entry(bookSyncPayload(legacyRecord(asset))));
  assert.equal(stored.get(`${asset.id}--${A}`).filePath, `bundled-pdf://${asset.id}--${A}`, 'antes de reanexar nada muda');
  await replica.apply(A, entry(bookSyncPayload(restored)));
  const other = stored.get(`${asset.id}--${A}`);
  assert.equal(other.filePath, '', 'outro aparelho espera a cópia privada'); assert.equal(other.bundledAssetId, undefined); assert.equal(other.progress, 0.42);
  // Na conta que reanexou, a própria réplica não apaga o caminho da cópia local.
  stored.set(restored.id, restored); await replica.apply(A, entry(bookSyncPayload(restored)));
  assert.equal(stored.get(restored.id).filePath, restored.filePath);

  // Fluxo: a importação tenta reanexar antes de perguntar sobre duplicado.
  const hook = fs.readFileSync('src/presentation/hooks/useBookImport.ts', 'utf8');
  assert.ok(hook.indexOf('legacyReattach.find(') < hook.indexOf('if (duplicateCheck.existing)'));
  assert.ok(hook.indexOf('legacyReattach.reattach(') < hook.indexOf('localBookImporter.import('));
  console.log('PASS legacy reattach: 33 arquivos fora do pacote; mesmo arquivo → mesmo livro (ID/progresso), sem vínculo com o pacote, Sync como cópia própria; excluído/já próprio/sem conta não reanexa; falhas sem lixo; Web; réplica de outro aparelho espera a nuvem. Sem aparelho.');
})().catch(error => { console.error(error); process.exit(1); });
