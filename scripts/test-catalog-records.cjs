// Catalog phase 2 (owner, 18/11/2026): book without a file ("record"), "Quero ler", Sync guards and the catalog screen.
// Real repositories over SQLite with a fake backend; the screen runs with stub React Native and a controlled catalog.
const assert = require('node:assert/strict');
const fs = require('node:fs');
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
  assert.equal(RECORD_BOOKS_SYNC_ENABLED, true, 'synced since migration 20261118120000');
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

  // 2. Sync (migration 20261118120000): a record book and its organization reach the other device; its status tells the truth.
  const owned = { ...record, ownerUserId: A };
  const { LibrarySyncCoordinator, availabilityLabels } = a.load('src/data/library/LibrarySyncCoordinator.ts');
  await a.books.save(owned); assert.equal(a.sync.status.pending, 1, 'a record book is journaled like any book');
  const stored = await a.books.findById(record.id);
  assert.deepEqual([stored.kind, stored.catalogId, stored.recordFormat], ['record', dom.id, 'physical'], 'SQLite keeps the record fields');
  assert.equal((await a.books.listActive()).filter(isRecordBook).length, 1, 'shown in the library');
  await a.org.save({ ...recordBookOrganization(record.id, 'want', 2), rating: 5, manualProgress: { page: 12, totalPages: 256, updatedAt: 2 } });
  const file = { ownerUserId: A, id: 'book-file', title: 'Com arquivo', author: 'Autora', fileName: 'f.epub', filePath: 'file:///f.epub', fileHash: null, mimeType: 'application/epub+zip', fileSize: 10, coverImagePath: null, totalChapters: 1, totalWords: 5, addedDate: 1, lastOpenedDate: null, isDeleted: false, progress: 0, importComplete: true };
  await a.books.save(file); await a.org.save({ ...base, bookId: file.id, wantToRead: true });
  await a.synchronize(); await b.synchronize();
  const sentBook = [...remote.rows.values()].find(row => row.kind === 'book' && row.id === record.id).payload;
  assert.deepEqual([sentBook.format, sentBook.kind, sentBook.recordFormat, sentBook.remotePath, sentBook.coverUrl, sentBook.catalogId], ['record', 'record', 'physical', null, dom.coverUrl, dom.id], 'only metadata, never a path');
  const there = await b.books.findById(record.id);
  assert.deepEqual([there.kind, there.recordFormat, there.filePath, there.fileHash, there.mimeType, there.coverImagePath, there.catalogId], ['record', 'physical', '', null, RECORD_BOOK_MIME, dom.coverUrl, dom.id], 'the other device rebuilds the book without a file');
  assert.deepEqual(there.catalogCategories, ['literatura-brasileira']);
  const otherOrg = (await b.org.list())[record.id];
  assert.deepEqual([otherOrg.wantToRead, otherOrg.rating, otherOrg.manualProgress.page], [true, 5, 12], 'organization, rating and manual progress travel');
  assert.equal((await b.org.list())[file.id].wantToRead, true, '"Quero ler" of a file book syncs');
  const view = { scope: { userId: A }, state: await a.persistence.read(A), engine: { quotaBlockMessage: () => null }, files: { states: new Map() }, needsFile: () => false };
  assert.equal(availabilityLabels[LibrarySyncCoordinator.prototype.availability.call(view, owned)], 'Sincronizado na nuvem');
  assert.equal(LibrarySyncCoordinator.prototype.availability.call({ ...view, state: { entries: {} } }, { ...file, filePath: '' }), 'SYNC_PENDING', 'a file book without its file still reports pending');
  // A remote row this version does not know (a newer app's format) is skipped; the sync continues.
  await a.replica.apply(A, { kind: 'book', id: 'future-1', bookId: 'future-1', deleted: false, payload: { title: 'Futuro', format: 'audio-file' } });
  assert.equal(await a.books.findById('future-1'), null);
  // A record can never replace a file book, and a file payload never takes a record- id.
  await assert.rejects(a.replica.apply(A, { kind: 'book', id: file.id, bookId: file.id, deleted: false, payload: { title: 'X', format: 'record' } }), /inválidos/);
  // Deleting travels as a tombstone.
  await a.books.softDelete(record.id); await a.synchronize(); await b.synchronize();
  assert.equal(await b.books.findById(record.id), null, 'deleted on the other device');

  // 3. The catalog screen: search only on request, show results, add from the sheet, then "Na sua biblioteca".
  const saved = [], organized = [], searches = [], shelfRequests = [], routes = []; let params = {}; let fail = null, resolveSearch = null;
  // Vitrine (fase 4): a fantasy shelf, and a library with one fantasy book already kept → "Para você" from cached books, owned excluded.
  const fantasy = n => ({ ...dom, id: 'ol:OLF' + n + 'W', title: 'Fantasia ' + n, authors: ['Autora ' + n], categories: ['fantasia'], subjects: ['Fantasy'] });
  const shelfBooks = [1, 2, 3, 4, 5].map(fantasy);
  let library = [{ ...createRecordBook({ catalog: fantasy(1), format: 'physical', id: 'owned-fantasy', now: 1 }), ownerUserId: A }];
  const organizationRecords = { [library[0].id]: { ...recordBookOrganization(library[0].id, 'completed', 1) } };
  const catalog = {
    cachedBooks: async () => shelfBooks,
    search: (text, signal) => { if (text.startsWith('subject:')) { shelfRequests.push(text); return Promise.resolve(text === 'subject:fantasy' ? shelfBooks : []); } searches.push(text); if (fail) return Promise.reject(fail); return new Promise(resolve => { resolveSearch = () => resolve([dom, { ...dom, id: 'ol:OL2W', title: 'Memórias póstumas', coverUrl: null, categories: [], subjects: [] }]); }); } };
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
    'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView', Image: 'Image', Modal: ({ children }) => h('Modal', null, children), Linking: { openURL: async url => opened.push(url) }, StyleSheet: { create: x => x, absoluteFill: {}, hairlineWidth: 1 } },
    '@/src/ui': ui, '@/src/presentation/contexts/AppThemeContext': { useAppTheme: () => ({ palette: { separator: '#ccc', panel: '#fff', border: '#ddd', surfaceSecondary: '#eee' } }) },
    '@/src/presentation/services/dependencies': { appDependencies: { bookRepository: { listActive: async () => library, findById: async id => library.find(book => book.id === id) ?? null, save: async book => { saved.push(book); library = [...library.filter(item => item.id !== book.id), book]; } } }, libraryOrganization: { save: async value => organized.push(value), list: async () => organizationRecords } },
    '@/src/data/catalog/catalogDependencies': { catalog }, '@/src/data/catalog/catalogSources': { CatalogUnavailableError },
    '@/src/presentation/components/BookCover': { BookCover: props => h('Cover', props) },
    'expo-router': { router: { back: () => routes.push('back'), push: route => routes.push(route) }, useLocalSearchParams: () => params },
    '@/src/presentation/components/catalog/YourSources': { YourSources: () => h('YourSources') },
  });
  const { CatalogScreen } = load('src/presentation/screens/CatalogScreen.tsx');
  const text = node => typeof node === 'string' ? node : (node.children ?? []).map(text).join('');
  const flush = () => act(async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); });
  let tree; await act(async () => { tree = create(h(CatalogScreen)); }); await flush();
  const field = () => tree.root.findByType('Search');
  const press = async label => { const node = tree.root.findAll(n => n.type === 'Pressable' && (n.props.accessibilityLabel === label || String(n.props.accessibilityLabel ?? '').startsWith(label + ','))); assert.ok(node.length, 'missing ' + label); await act(async () => node[0].props.onPress()); await flush(); };
  // Vitrine: only the fixed category rows are requested, the same for everyone; nothing from the library is sent.
  const { INITIAL_SHELVES, CATEGORY_QUERIES } = a.load('src/domain/catalog/catalogShelves.ts');
  assert.deepEqual([...shelfRequests].sort(), INITIAL_SHELVES.map(key => CATEGORY_QUERIES[key]).sort(), 'fixed category rows');
  assert.equal(searches.length, 0, 'no typed search before the person searches');
  assert.ok(shelfRequests.every(q => !/Fantasia 1|Autora 1|owned/.test(q)), 'no library data in requests');
  assert.match(text(tree.root), /Para você/); assert.match(text(tree.root), /Calculado neste aparelho/);
  const forYou = tree.root.findAll(n => n.type === 'Pressable' && /porque você lê Fantasia$/.test(String(n.props.accessibilityLabel ?? ''))).map(n => n.props.accessibilityLabel.split(',')[0]);
  assert.deepEqual(forYou, ['Fantasia 2', 'Fantasia 3', 'Fantasia 4', 'Fantasia 5'], 'recommended from cached books by library categories, owned book excluded');
  // A category shortcut loads that category on request and the person can go back.
  await press('Terror'); assert.equal(shelfRequests.at(-1), 'subject:horror'); assert.match(text(tree.root), /Categoria: Terror/);
  await press('Voltar à vitrine'); assert.match(text(tree.root), /Para você/);
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
  assert.match(text(tree.root), /Guardado na sua biblioteca como “Quero ler”/); assert.match(text(tree.root), /outros aparelhos quando a biblioteca sincronizar/);
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

  // 4. A5: "Ligar ao catálogo" from a file book's menu. The search starts with its title; the sheet links instead of keeping a copy.
  const fileBook = { ownerUserId: A, id: 'file-dom', title: 'Dom Casmurro', author: 'Arquivo local', fileName: 'dom.epub', filePath: 'file:///dom.epub', fileHash: null, mimeType: 'application/epub+zip', fileSize: 10, coverImagePath: null, totalChapters: 1, totalWords: 5, addedDate: 1, lastOpenedDate: null, isDeleted: false, progress: 0, importComplete: true };
  library = [...library, fileBook]; params = { link: 'file-dom', q: 'Dom Casmurro' }; fail = null; searches.length = 0; saved.length = 0;
  await act(async () => { tree = create(h(CatalogScreen)); }); await flush();
  assert.deepEqual(searches, ['Dom Casmurro'], 'the title is searched at once'); await act(async () => resolveSearch()); await flush();
  assert.match(text(tree.root), /Escolha o livro do catálogo que corresponde a “Dom Casmurro”/);
  await press('Dom Casmurro');
  assert.equal(tree.root.findAll(n => n.props.accessibilityLabel === 'Quero ler').length, 0, 'no keep-a-copy buttons while linking');
  await press('Ligar “Dom Casmurro” a este livro');
  assert.equal(saved.length, 1); assert.equal(saved[0].id, 'file-dom'); assert.equal(saved[0].catalogId, dom.id); assert.deepEqual(saved[0].catalogCategories, ['literatura-brasileira']); assert.equal(saved[0].catalogPages, 256);
  assert.match(text(tree.root), /“Dom Casmurro” ligado a “Dom Casmurro”/); await press('Voltar'); assert.deepEqual(routes, ['back']);
  await act(async () => tree.unmount()); params = {};
  // Ficha mais rica (19/11): com o arquivo já ligado, "Ler livro" abre o leitor; capa desfocada ao fundo, fora da leitura de tela.
  await act(async () => { tree = create(h(CatalogScreen)); }); await flush();
  await act(async () => field().props.onChangeText('Dom Casmurro')); await act(async () => field().props.onSubmit()); await act(async () => resolveSearch()); await flush();
  await press('Dom Casmurro');
  const backdrops = tree.root.findAll(n => n.type === 'Image');
  assert.ok(backdrops.length >= 1 && backdrops.every(n => n.props.accessibilityElementsHidden && n.props.blurRadius > 0), 'blurred cover backdrop is decorative');
  routes.length = 0; await press('Ler livro');
  assert.deepEqual(routes, [{ pathname: '/reader/[bookId]', params: { bookId: 'file-dom' } }], 'opens the linked file in the reader');
  await act(async () => tree.unmount());
  library = library.filter(book => book.id !== 'file-dom');

  // 4b. Library search with nothing on the shelf (19/11, owner: "a biblioteca como catálogo não ta funcionando"): the words go to the
  // catalog, which searches them at once and offers to keep the book (not the linking sheet).
  const { libraryCatalogQuery } = a.load('src/domain/catalog/libraryCatalogQuery.ts');
  assert.equal(libraryCatalogQuery('  percy   jackson '), 'percy jackson');
  assert.equal(libraryCatalogQuery(' p '), null, 'one letter is not searched');
  assert.equal(libraryCatalogQuery(''), null);
  assert.equal(libraryCatalogQuery('x'.repeat(300)).length, 200, 'same limit as the catalog screen');
  const libraryScreen = fs.readFileSync('app/(tabs)/library.tsx', 'utf8');
  assert.match(libraryScreen, /label="Procurar no catálogo"[^\n]*router\.push\(\{ pathname: "\/catalog", params: \{ q: catalogQuery \} \}/, 'the empty Library search opens the catalog with the same words');
  params = { q: 'Dom Casmurro' }; fail = null; searches.length = 0; saved.length = 0; organized.length = 0;
  await act(async () => { tree = create(h(CatalogScreen)); }); await flush();
  assert.deepEqual(searches, ['Dom Casmurro'], 'searched at once, without a second tap'); assert.equal(field().props.value, 'Dom Casmurro');
  await act(async () => resolveSearch()); await flush();
  assert.doesNotMatch(text(tree.root), /Escolha o livro do catálogo que corresponde/, 'not the linking flow');
  await press('Memórias póstumas'); await press('Quero ler');
  assert.equal(saved.length, 1); assert.ok(saved[0].id.startsWith('record-'), 'kept as a book without a file'); assert.equal(organized[0].wantToRead, true);
  await act(async () => tree.unmount()); params = {};

  // 4c. Aba Descobrir (19/11, dono): a mesma vitrine sem "voltar", com "Sortear um livro" e Suas fontes no fim.
  const { pickSurprise, libraryAffinity: affinityOf } = a.load('src/domain/catalog/catalogShelves.ts');
  const ownedIds = new Set([fantasy(1).id]);
  assert.equal(pickSurprise([], new Map(), ownedIds), null, 'nothing to draw: no invented book');
  assert.equal(pickSurprise([fantasy(1)], new Map(), ownedIds), null, 'only owned books: nothing to draw');
  const seq = values => () => values.shift() ?? 0;
  assert.equal(pickSurprise(shelfBooks, new Map(), ownedIds, new Set(), seq([0.99])).id, fantasy(5).id, 'uniform over books not owned');
  assert.ok([2, 3, 4, 5].map(n => fantasy(n).id).includes(pickSurprise(shelfBooks, new Map(), ownedIds, new Set(), seq([0])).id));
  assert.equal(pickSurprise(shelfBooks, new Map(), ownedIds, new Set([2, 3, 4].map(n => fantasy(n).id)), seq([0])).id, fantasy(5).id, 'recent draws are skipped while others remain');
  assert.ok(pickSurprise(shelfBooks, new Map(), ownedIds, new Set([2, 3, 4, 5].map(n => fantasy(n).id)), seq([0])), 'all recent: draws again instead of failing');
  const mixed = [...shelfBooks, { ...dom, id: 'ol:OLX1W', categories: ['terror'] }];
  const affinity = affinityOf(library, organizationRecords);
  assert.equal(pickSurprise(mixed, affinity, ownedIds, new Set(), seq([0.1, 0])).categories[0], 'fantasia', 'half the draws come from Para você');
  shelfRequests.length = 0;
  await act(async () => { tree = create(h(CatalogScreen, { tab: true })); }); await flush();
  assert.match(text(tree.root), /Descobrir/); assert.doesNotMatch(text(tree.root), /Buscar livros/);
  assert.equal(tree.root.findAll(n => n.type === 'YourSources').length, 1, 'Suas fontes at the end of the tab');
  assert.doesNotMatch(text(tree.root), /Gutendex|Gutenberg|BibliON|MEC Livros/, 'the old public catalogs and digital libraries are gone');
  await press('Sortear um livro');
  assert.match(text(tree.root), /Como você tem este livro?/, 'the drawn book opens its sheet');
  const sheet = text(tree.root.findAllByType('Modal').at(-1)); assert.match(sheet, /Fantasia [2-5]/); assert.doesNotMatch(sheet, /Fantasia 1/, 'never a book already on the shelf');
  await press('Fechar');
  const cachedBefore = catalog.cachedBooks; catalog.cachedBooks = async () => [];
  await press('Sortear um livro');
  assert.ok(shelfRequests.some(q => INITIAL_SHELVES.map(key => CATEGORY_QUERIES[key]).includes(q)), 'empty cache: loads a fixed category first');
  catalog.cachedBooks = cachedBefore;
  await act(async () => tree.unmount());
  await act(async () => { tree = create(h(CatalogScreen)); }); await flush();
  assert.equal(tree.root.findAll(n => n.type === 'YourSources').length, 0, 'the /catalog route keeps its own layout');
  // Busca enquanto digita (19/11): a busca sai sozinha depois de uma pausa, uma vez por texto, e não com menos de 3 letras.
  searches.length = 0; fail = null;
  await act(async () => field().props.onChangeText('ma'));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 700)); }); assert.equal(searches.length, 0, 'two letters do not search');
  await act(async () => field().props.onChangeText('machado'));
  await act(async () => field().props.onChangeText('machado de assis'));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 700)); }); await flush();
  assert.deepEqual(searches, ['machado de assis'], 'only the text after the pause is searched');
  await act(async () => resolveSearch()); await flush();
  await act(async () => field().props.onSubmit()); assert.equal(searches.length, 1, 'submitting the same text does not repeat the request');
  await act(async () => tree.unmount());

  // 5. A5 domain and data: pair a fileB with a kept record, merge on request, carry the link through Sync.
  const link = a.load('src/domain/catalog/catalogLink.ts');
  const rec = { ...createRecordBook({ catalog: dom, format: 'physical', id: 'kept-dom-1', now: 1 }), ownerUserId: A };
  const fileB = { ...fileBook, id: 'file-dom-2', author: 'Machado de Assis' };
  assert.deepEqual(link.recordMatchesForFile(fileB, [fileB, rec]).map(b => b.id), [rec.id], 'same title and surname');
  assert.deepEqual(link.recordMatchesForFile({ ...fileB, author: 'Outro Autor' }, [rec]), [], 'different author is not a match');
  assert.deepEqual(link.recordMatchesForFile({ ...fileB, author: 'Arquivo local' }, [rec]).length, 1, 'unknown fileB author: title decides');
  assert.deepEqual(link.recordMatchesForFile({ ...fileB, catalogId: 'ol:X' }, [rec]), [], 'already linked');
  assert.deepEqual(link.pendingCatalogLinks([fileB, rec], new Set()).map(p => [p.file.id, p.record.id]), [[fileB.id, rec.id]]);
  assert.deepEqual(link.pendingCatalogLinks([fileB, rec], new Set([link.linkKey(fileB.id, rec.id)])), [], 'kept apart is not asked again');
  const merged = link.mergeLinkedOrganization(fileB.id, { ...recordBookOrganization(fileB.id, 'reading', 1), collections: ['Faculdade'], revision: 2 }, { ...recordBookOrganization(rec.id, 'want', 1), favorite: true, collections: ['Clássicos'] }, 9);
  assert.deepEqual([merged.bookId, merged.readingStatus, merged.favorite, merged.wantToRead, merged.revision], [fileB.id, 'reading', true, undefined, 3], 'fileB choices win; Quero ler drops when reading');
  assert.deepEqual(merged.collections, ['Faculdade', 'Clássicos']);
  assert.deepEqual(link.parseCatalogLinkFields({ catalogId: 'javascript:x', catalogCategories: ['fantasia'] }), {}, 'invalid id ignored');
  assert.deepEqual(link.parseCatalogLinkFields({ catalogId: 'ol:OL1W', catalogCategories: ['fantasia', 'nope'], catalogPages: -1 }), { catalogId: 'ol:OL1W', catalogCategories: ['fantasia'], catalogPages: null });
  // Real repositories: merge moves the organization, removes the record and the file's catalog link reaches the other device.
  const { linkFileToRecord } = a.load('src/data/catalog/catalogLinking.ts');
  await a.books.save(rec); await a.org.save({ ...recordBookOrganization(rec.id, 'completed', 3), favorite: true });
  await a.books.save(fileB); await a.synchronize();
  await linkFileToRecord({ books: a.books, organization: a.org }, fileB.id, rec.id, 50);
  assert.equal((await a.books.findById(fileB.id)).catalogId, dom.id); assert.equal(await a.books.findById(rec.id).then(b => b?.isDeleted ?? true), true, 'record removed');
  const mergedOrg = (await a.org.list())[fileB.id]; assert.deepEqual([mergedOrg.readingStatus, mergedOrg.favorite], ['completed', true]);
  await a.synchronize(); await b.synchronize();
  const remoteBook = await b.books.findById(fileB.id); assert.equal(remoteBook.catalogId, dom.id); assert.deepEqual(remoteBook.catalogCategories, ['literatura-brasileira'], 'link travels with the fileB book');
  assert.equal((await b.org.list())[fileB.id].readingStatus, 'completed', 'merged organization travels too');
  a.db.close(); b.db.close();
  console.log('catalog records: domain, Sync of books without a file, "Quero ler" and the catalog screen OK');
})().catch(error => { console.error(error); process.exit(1); });
