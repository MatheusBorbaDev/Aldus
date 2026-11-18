// File SHA-256 off the JS thread on Android (18/11/2026; external testers: "tudo demora muito" to add a long PDF). The JavaScript path
// still matches Node's SHA-256 on multi-chunk files; with the native module the file is never read in base64, an incomplete or invalid
// result is refused, cancellation reaches the native operation, and import duplicate checks use it. The Kotlin module itself
// (modules/aldus-file-hash) is compiled by the APK build; its digest on the phone is NOT TESTED here.
const assert = require('node:assert/strict'), crypto = require('node:crypto');
const { loader } = require('./library-test-utils.cjs');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

(async () => {
  const load = loader({ 'react-native': { Platform: { OS: 'android' } }, '@react-native-async-storage/async-storage': { getItem: async () => null, setItem: async () => {} }, 'expo-file-system/legacy': {} });
  const { hashLocalBookFile, base64ToBytes, BOOK_FILE_CHUNK } = load('src/data/library/BookFileIntegrity.ts');
  const data = crypto.randomBytes(BOOK_FILE_CHUNK * 2 + 12345);
  const reads = [];
  const readBase64 = async (position, length) => { reads.push([position, length]); return data.subarray(position, position + length).toString('base64'); };

  // 1. JavaScript path (Web, tests, a build without the module): same digest, bounded reads, faster base64 decode.
  assert.equal(await hashLocalBookFile('file:///book.pdf', data.length, readBase64, undefined, null), sha(data));
  assert.equal(reads.length, 3, 'three 1 MiB-bounded reads');
  assert.deepEqual(Buffer.from(base64ToBytes(Buffer.from([0, 255, 128, 7]).toString('base64'))), Buffer.from([0, 255, 128, 7]));
  for (const size of [0, -1, 1.5, 513 * 1024 * 1024]) await assert.rejects(hashLocalBookFile('file:///x', size, readBase64, undefined, null), /limite de 512 MiB/);

  // 2. Native path: no base64 read at all, result checked.
  const calls = [], cancels = [];
  let answer = { hash: sha(data), size: data.length }, hold = null;
  const native = {
    sha256File: async (uri, operationId) => { calls.push([uri, operationId]); if (hold) await hold; return answer; },
    cancelOperation: async operationId => { cancels.push(operationId); },
  };
  reads.length = 0;
  assert.equal(await hashLocalBookFile('content://provider/doc/9', data.length, readBase64, undefined, native), sha(data));
  assert.equal(reads.length, 0, 'the file is never read in base64 when the native module exists');
  assert.equal(calls[0][0], 'content://provider/doc/9');
  answer = { hash: sha(data), size: data.length - 1 };
  await assert.rejects(hashLocalBookFile('file:///b', data.length, readBase64, undefined, native), /incompleto/, 'a short read is never accepted');
  for (const hash of ['A'.repeat(64), 'abc', null]) { answer = { hash, size: data.length }; await assert.rejects(hashLocalBookFile('file:///b', data.length, readBase64, undefined, native), /inválida/); }
  answer = { hash: sha(data), size: data.length };
  // Cancellation: the caller gets AbortError at once and the native operation is told to stop.
  let release; hold = new Promise(r => { release = r; });
  const controller = new AbortController();
  const pending = hashLocalBookFile('file:///b', data.length, readBase64, controller.signal, native);
  await new Promise(r => setImmediate(r));
  controller.abort();
  await assert.rejects(pending, error => error.name === 'AbortError');
  assert.deepEqual(cancels, [calls.at(-1)[1]], 'the same operation id is cancelled natively');
  release(); hold = null;
  const already = new AbortController(); already.abort(); const before = calls.length;
  await assert.rejects(hashLocalBookFile('file:///b', data.length, readBase64, already.signal, native), error => error.name === 'AbortError');
  assert.equal(calls.length, before, 'an aborted request never starts the native work');

  // 3. Platform files: Android takes the module when present; Web and tests have none.
  assert.equal(load('src/data/library/nativeFileHasher.ts').nativeFileHasher, null);
  const androidLoad = mod => loader({ '@/modules/aldus-file-hash/index': { __esModule: true, default: mod } })('src/data/library/nativeFileHasher.native.ts').nativeFileHasher;
  assert.equal(androidLoad(native), native); assert.equal(androidLoad(null), null, 'a build without the module falls back to JavaScript');

  // 4. Import duplicate check (before importing) uses the native digest, also for content:// documents.
  const { ImportDuplicateService } = load('src/data/imports/ImportDuplicateService.ts');
  const files = { getInfoAsync: async () => ({ exists: true, size: data.length }), readAsStringAsync: async () => { throw Error('content partial read unsupported'); } };
  const service = new ImportDuplicateService({ findById: async () => null }, { getItem: async () => null, setItem: async () => {} }, files, 'android', native);
  const scope = load('src/data/library/LibraryAccountScope.ts').libraryAccountScope; scope.set('11111111-1111-4111-8111-111111111111');
  const check = await service.check({ uri: 'content://provider/doc/9', name: 'Livro recebido', mimeType: null, size: data.length }, new AbortController().signal);
  assert.equal(check.hash, sha(data), 'duplicate check hashes natively, without the unsupported partial read');
  console.log('PASS file hash: JavaScript path equals SHA-256 on multi-chunk files; native path never reads base64, refuses short reads and invalid digests, cancels the same native operation, falls back without the module, and is used by the import duplicate check. Kotlin digest on the phone NOT TESTED.');
})().catch(error => { console.error(error); process.exit(1); });
