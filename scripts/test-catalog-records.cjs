// Catalog phase 2 (owner, 18/11/2026): book without a file ("record"), "Quero ler", Sync guards and the catalog screen.
// Real repositories over SQLite with a fake backend; the screen runs with stub React Native and a controlled catalog.
const assert = require('node:assert/strict');
const { backend, device } = require('./test-library-reading-sync.cjs');
const React = require('../.expo/auth-test-tools/node_modules/react');
const { act, create } = require('../.expo/auth-test-tools/node_modules/react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const A = '11111111-1111-4111-8111-111111111111';
const dom = { id: 'ol:OL45883W', source: 'openlibrary', title: 'Dom Casmurro', subtitle: null, authors: ['Machado de Assis'], firstPublishYear: 1899, isbns: ['9788535902778'], pages: 256, subjects: ['Brazilian fiction'], categories: ['literatura-brasileira'], coverUrl: 'https://covers.openlibrary.org/b/id/8231856-M.jpg', sourceUrl: 'https://openlibrary.org/works/OL45883W' };

(async () => {
  // 1. Domain: a record book carries only metadata and is never mistaken for a file.
  const remote = backend(), a = await device(remote), b = await device(remote);
  const { createRecordBook, recordBookOrganization, libraryMatchesForCatalog, RECORD_START_LABELS } = a.load('src/domain/catalog/recordBook.ts');
  const { isRecordBook, isRecordBookId, RECORD_BOOK_MIME, RECORD_BOOKS_SYNC_ENABLED } = a.load('src/domain/entities/LibraryBook.ts');
  const { parseOrganizationRecord } = a.load('src/domain/types/libraryOrganization.ts');
  assert.equal(RECORD_BOOKS_SYNC_ENABLED, false, 'stays local until the server migration is applied');
  const record = createRecordBook({ catalog: dom, format: 'physical', id: 'abc12345-xyz', now: 1000 });
  assert.equal(record.id, 'record-abc12345-xyz'); assert.equal(record.kind, 'record'); assert.equal(record.catalogId, dom.id);
  assert.deepEqual([record.filePath, record.fileHash, record.fileSize, record.mimeType, record.totalChapters], ['', null, 0, RECORD_BOOK_MIME, 0], 'no file data invented');
  assert.equal(record.author, 'Machado de Assis'); assert.equal(record.coverImagePath, dom.coverUrl);
  assert.equal(createRecordBook({ catalog: { ...dom, authors: [], coverUrl: null }, format: 'ebook', id: 'abc12345', now: 1 }).author, 'Autor não informado');
  for (const bad of ['short', '../../etc/passwd', 'x'.repeat(65)]) assert.throws(() => createRecordBook({ catalog: dom, format: 'physical', id: bad, now: 1 }), /inválido/);
  assert.ok(isRecordBook(record)); assert.ok(!isRecordBook({ id: 'record-x', kind: undefined }), 'a prefix alone is not enough');
  assert.ok(!isRecordBook({ id: 'book-x', kind: 'record' })); assert.ok(isRecordBookId(record.id));
  assert.equal(recordBookOrganization(record.id, 'want', 5).wantToRead, true);
  assert.equal(recordBookOrganization(record.id, 'want', 5).readingStatus, null);
  assert.equal(recordBookOrganization(record.id, 'reading', 5).readingStatus, 'reading'); assert.ok(!('wantToRead' in recordBookOrganization(record.id, 'completed', 5)));
  assert.deepEqual(Object.values(RECORD_START_LABELS), ['Quero ler', 'Estou lendo', 'Já li']);
  const base = { bookId: 'book-x', favorite: false, collections: [], tags: [], series: '', volume: null, readingStatus: null, updatedAt: 1, revision: 1 };
  assert.equal(parseOrganizationRecord({ ...base, wantToRead: true }).wantToRead, true);
  assert.ok(!('wantToRead' in parseOrganizationRecord({ ...base, wantToRead: false })), 'false is not stored');
  assert.ok(!('wantToRead' in parseOrganizationRecord(base)), 'old records stay valid');
  assert.throws(() => parseOrganizationRecord({ ...base, wantToRead: 'yes' }), /Quero ler/);
  assert.equal(libraryMatchesForCatalog([record, { ...record, id: 'record-2', isDeleted: true }, { ...record, id: 'record-3', catalogId: 'ol:OTHER' }], dom.id).length, 1);

  // 2. Sync guards: a record book and its organization stay on this device; a normal book's "Quero ler" travels.
  const owned = { ...record, ownerUserId: A };
  await a.books.save(owned); assert.equal(a.sync.status.pending, 0, 'saving a record book journals nothing');
  const stored = await a.books.findById(record.id);
  assert.deepEqual([stored.kind, stored.catalogId, stored.recordFormat], ['record', dom.id, 'physical'], 'SQLite keeps the record fields');
  assert.equal((await a.books.listActive()).filter(isRecordBook).length, 1, 'shown in the library');
  await a.org.save(recordBookOrganization(record.id, 'want', 2)); assert.equal(a.sync.status.pending, 0, 'its organization journals nothing');
  assert.equal((await a.org.list())[record.id].wantToRead, true);
  const file = { ownerUserId: A, id: 'book-file', title: 'Com arquivo', author: 'Autora', fileName: 'f.epub', filePath: 'file:///f.epub', fileHash: null, mimeType: 'application/epub+zip', fileSize: 10, coverImagePath: null, totalChapters: 1, totalWords: 5, addedDate: 1, lastOpenedDate: null, isDeleted: false, progress: 0, importComplete: true };
  await a.books.save(file); await a.org.save({ ...base, bookId: file.id, wantToRead: true });
  await a.org.saveMany([{ ...recordBookOrganization(record.id, 'reading', 3), revision: 2 }]);
  await a.org.merge({ [record.id]: recordBookOrganization(record.id, 'completed', 4) }, 'use-imported');
  await a.synchronize(); await b.synchronize();
  const sent = [...remote.rows.values()];
  assert.ok(sent.every(row => !row.book_id.startsWith('record-')), 'nothing about the record book reaches the server');
  assert.equal(sent.find(row => row.kind === 'organization' && row.book_id === file.id).payload.wantToRead, true, '"Quero ler" of a file book syncs');
  assert.equal((await b.org.list())[file.id].wantToRead, true); assert.equal(await b.books.findById(record.id), null, 'the other device does not see it yet');
  // Its status says where it is, never "pending sync" for something that is not sent.
  const { LibrarySyncCoordinator, availabilityLabels } = a.load('src/data/library/LibrarySyncCoordinator.ts');
  const view = { scope: { userId: A }, state: { entries: {} }, engine: { quotaBlockMessage: () => null }, files: { states: new Map() }, needsFile: () => false };
  const availability = book => LibrarySyncCoordinator.prototype.availability.call(view, book);
  assert.equal(availabilityLabels[availability(owned)], 'Neste dispositivo');
  assert.equal(availability({ ...file, filePath: '' }), 'SYNC_PENDING', 'a file book without its file still reports pending');
  await a.books.softDelete(record.id); assert.equal(a.sync.status.pending, 0, 'deleting it journals nothing');
  assert.equal(await a.books.findById(record.id).then(book => book?.isDeleted ?? true), true);
  await a.synchronize(); assert.ok([...remote.rows.values()].every(row => !row.book_id.startsWith('record-')));

  // 3. The catalog screen: search only on request, show results, add from the sheet, then "Na sua biblioteca".
  const saved = [], organized = [], searches = []; let library = [], fail = null, resolveSearch = null;
  const catalog = { search: (text, signal) => { searches.push(text); if (fail) return Promise.reject(fail); return new Promise(resolve => { resolveSearch = () => resolve([dom, { ...dom, id: 'ol:OL2W', title: 'Memórias póstumas', coverUrl: null, categories: [], subjects: [] }]); }); } };
  const { CatalogUnavailableError } = a.load('src/data/catalog/catalogSources.ts');
  const h = React.createElement, Plain = type => props => h(type, props, props.children);
  const ui = {
    AppText: Plain('Text'), Screen: ({ header, children }) => h('Screen', null, header, children), ScreenHeader: ({ title }) => h('Text', null, title),
    SearchField: props => h('Search', props), Button: props => h('Pressable', { ...props, accessibilityLabel: props.label }, props.label),
    Chip: props => h('Pressable', { ...props, accessibilityLabel: props.label, accessibilityState: { selected: props.selected } }, props.label),
    EmptyState: ({ title, description, children }) => h('Empty', null, title, ' ', description, children),
  };
  const opened = [];
  const load = require('./community-test-loader.cjs')({
    react: React, 'react/jsx-runtime': require('../.expo/auth-test-tools/node_modules/react/jsx-runtime'),
    'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView', Modal: ({ children }) => h('Modal', null, children), Linking: { openURL: async url => opened.push(url) }, StyleSheet: { create: x => x, absoluteFill: {}, hairlineWidth: 1 } },
    '@/src/ui': ui, '@/src/presentation/contexts/AppThemeContext': { useAppTheme: () => ({ palette: { separator: '#ccc', panel: '#fff', border: '#ddd', surfaceSecondary: '#eee' } }) },
    '@/src/presentation/services/dependencies': { appDependencies: { bookRepository: { listActive: async () => library, save: async book => { saved.push(book); library = [...library, book]; } } }, libraryOrganization: { save: async value => organized.push(value) } },
    '@/src/data/catalog/catalogDependencies': { catalog }, '@/src/data/catalog/catalogSources': { CatalogUnavailableError },
    '@/src/presentation/components/BookCover': { BookCover: props => h('Cover', props) },
  });
  const { CatalogScreen } = load('src/presentation/screens/CatalogScreen.tsx');
  const text = node => typeof node === 'string' ? node : (node.children ?? []).map(text).join('');
  const flush = () => act(async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); });
  let tree; await act(async () => { tree = create(h(CatalogScreen)); }); await flush();
  const field = () => tree.root.findByType('Search');
  const press = async label => { const node = tree.root.findAll(n => n.type === 'Pressable' && (n.props.accessibilityLabel === label || String(n.props.accessibilityLabel ?? '').startsWith(label + ','))); assert.ok(node.length, 'missing ' + label); await act(async () => node[0].props.onPress()); await flush(); };
  assert.match(text(tree.root), /Busque qualquer livro/); assert.equal(searches.length, 0, 'nothing leaves the device before a search');
  await act(async () => field().props.onChangeText('d')); assert.equal(tree.root.findAll(n => n.props.label === 'Buscar' && n.props.disabled).length > 0, true, 'one letter does not search');
  await act(async () => field().props.onChangeText('  dom casmurro ')); await act(async () => field().props.onSubmit()); await flush();
  assert.deepEqual(searches, ['dom casmurro'], 'trimmed text only');
  await act(async () => field().props.onSubmit()); assert.equal(searches.length, 1, 'no second request while one is running');
  await act(async () => resolveSearch()); await flush();
  assert.match(text(tree.root), /Dom Casmurro/); assert.match(text(tree.root), /Memórias póstumas/); assert.match(text(tree.root), /Literatura brasileira/);
  await press('Dom Casmurro');
  assert.match(text(tree.root), /Como você tem este livro\?/); assert.match(text(tree.root), /Primeira publicação: 1899/); assert.match(text(tree.root), /ISBN 9788535902778/);
  await press('Audiolivro'); await press('Quero ler');
  assert.equal(saved.length, 1); assert.equal(saved[0].recordFormat, 'audiobook'); assert.equal(saved[0].catalogId, dom.id); assert.ok(saved[0].id.startsWith('record-'));
  assert.equal(organized[0].bookId, saved[0].id); assert.equal(organized[0].wantToRead, true);
  assert.match(text(tree.root), /Guardado na sua biblioteca como “Quero ler”/); assert.match(text(tree.root), /ficam só neste aparelho/, 'says honestly that it stays local');
  assert.equal(tree.root.findAll(n => n.props.accessibilityLabel === 'Já li').length, 0, 'no duplicate add after saving');
  await press('Ver a fonte destas informações no Open Library'); assert.deepEqual(opened, [dom.sourceUrl]);
  await press('Fechar'); assert.match(text(tree.root), /Dom Casmurro, Machado de Assis · 1899, na sua biblioteca|Na sua biblioteca/);
  assert.ok(tree.root.findAll(n => String(n.props.accessibilityLabel ?? '').endsWith('na sua biblioteca')).length === 1, 'the row says it is in the library');
  // Errors: the source's own message, a retry, and no stack or private detail.
  fail = new CatalogUnavailableError('O catálogo está indisponível agora.');
  await act(async () => field().props.onChangeText('outro livro')); await act(async () => field().props.onSubmit()); await flush();
  assert.match(text(tree.root), /Catálogo indisponível/); assert.match(text(tree.root), /indisponível agora/);
  fail = Error('PRIVATE stack'); await press('Tentar de novo');
  assert.match(text(tree.root), /Não foi possível buscar agora/); assert.doesNotMatch(text(tree.root), /PRIVATE/);
  await act(async () => tree.unmount());
  a.db.close(); b.db.close();
  console.log('catalog records: domain, local-only Sync guards, "Quero ler" and the catalog screen OK');
})().catch(error => { console.error(error); process.exit(1); });
