// Goodreads import (owner's plan, item B; 18/11/2026). CSV parsing, mapping of a real Goodreads export, round trip with the Aldus
// export, saving on real repositories (books without a file, local only) and the review screen. Nothing leaves the device.
const assert = require('node:assert/strict');
const { backend, device } = require('./test-library-reading-sync.cjs');
const React = require('../.expo/auth-test-tools/node_modules/react');
const { act, create } = require('../.expo/auth-test-tools/node_modules/react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const A = '11111111-1111-4111-8111-111111111111';
const HEADER = 'Book Id,Title,Author,Author l-f,Additional Authors,ISBN,ISBN13,My Rating,Average Rating,Publisher,Binding,Number of Pages,Year Published,Original Publication Year,Date Read,Date Added,Bookshelves,Bookshelves with positions,Exclusive Shelf,My Review,Spoiler,Private Notes,Read Count,Owned Copies';
const row = values => values.map(v => /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v).join(',');
const EXPORT = [HEADER,
  row(['123', 'Dom Casmurro', 'Machado de Assis', 'Assis, Machado de', '', '="8535902775"', '="9788535902778"', '5', '3.9', 'Cia', 'Paperback', '256', '2016', '1899', '2025/01/02', '2024/12/01', 'classicos, favoritos', '', 'read', 'Capitu<br/>olhos de ressaca', '', '', '1', '0']),
  row(['456', 'Torto arado', 'Itamar Vieira Junior', '', '', '=""', '=""', '0', '4.5', '', '', '', '', '', '', '2025/03/01', 'to-read', '', 'to-read', '', '', '', '0', '0']),
  row(['789', 'Livro, com "aspas"', 'Autora X', '', '', '', '', '3', '', '', '', 'abc', '', '', '', '', 'currently-reading, faculdade', '', 'currently-reading', 'Linha 1\nLinha 2', '', '', '0', '0']),
  row(['790', 'Abandonado', 'Y', '', '', '', '', '', '', '', '', '', '', '', '', '', 'did-not-finish', '', 'read', '', '', '', '0', '0']),
  row(['791', 'Dom Casmurro', 'Machado de Assis', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'read', '', '', '', '0', '0']),
  row(['792', '   ', 'Sem título', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'read', '', '', '', '0', '0']),
].join('\r\n');

(async () => {
  const remote = backend(), a = await device(remote);
  const { parseCsv, parseGoodreadsCsv, candidateCatalogItem } = a.load('src/domain/library/goodreadsImport.ts');
  // 1. CSV.
  assert.deepEqual(parseCsv('﻿a,"b,1","c ""q"""\r\n"multi\nline",,x\n'), [['a', 'b,1', 'c "q"'], ['multi\nline', '', 'x']]);
  assert.throws(() => parseCsv('a,"open'), /aspas/);
  assert.throws(() => parseGoodreadsCsv('Name,Other\nx,y', []), /não parece uma exportação do Goodreads/);
  // 2. Mapping of a real export.
  const owned = [{ id: 'b', title: 'Torto Arado', author: 'Itamar Vieira Júnior', isDeleted: false }];
  const found = parseGoodreadsCsv(EXPORT, owned);
  assert.deepEqual(found.map(item => item.title), ['Dom Casmurro', 'Torto arado', 'Livro, com "aspas"', 'Abandonado'], 'empty title and repeated book left out');
  const [dom, torto, quoted, dropped] = found;
  assert.deepEqual([dom.isbn13, dom.goodreadsId, dom.pages, dom.rating, dom.start, dom.review], ['9788535902778', '123', 256, 5, 'completed', 'Capitu\nolhos de ressaca']);
  assert.deepEqual(dom.collections, ['classicos', 'favoritos']);
  assert.deepEqual([torto.isbn13, torto.rating, torto.start, torto.inLibrary], [null, null, 'want', true], 'rating 0 is no rating; owned starts unchecked');
  assert.deepEqual([quoted.start, quoted.pages, quoted.collections, quoted.review], ['reading', null, ['faculdade'], 'Linha 1\nLinha 2']);
  assert.equal(dropped.start, 'interrupted'); assert.deepEqual(dropped.collections, []);
  assert.deepEqual([candidateCatalogItem(dom).id, candidateCatalogItem(quoted).id], ['isbn:9788535902778', 'gr:789']);
  assert.deepEqual(candidateCatalogItem(dom).categories, [], 'no category invented');
  // 3. Round trip with the Aldus export.
  const csv = a.load('src/domain/library/goodreadsCsv.ts');
  const back = parseGoodreadsCsv(csv.goodreadsCsv([{ title: 'T, x', author: 'A', addedDate: null, status: 'completed', collections: ['C'], rating: 4, review: 'R "q"' }]), []);
  assert.deepEqual([back[0].title, back[0].start, back[0].rating, back[0].review, back[0].collections], ['T, x', 'completed', 4, 'R "q"', ['C']]);

  // 4. Saving on real repositories: books without a file with shelf, rating, review and collections; nothing journaled for the server yet.
  const { importGoodreadsCandidates } = a.load('src/data/catalog/goodreadsImporter.ts');
  let n = 0; const progress = [];
  const count = await importGoodreadsCandidates({ books: a.books, organization: a.org, newId: () => `gr-test-${++n}0000` }, [dom, quoted, dropped], 'ebook', value => progress.push(value), 7);
  assert.equal(count, 3); assert.deepEqual(progress, [1, 2, 3]);
  const books = (await a.books.listActive()).filter(book => book.kind === 'record');
  assert.equal(books.length, 3); assert.ok(books.every(book => book.recordFormat === 'ebook' && book.filePath === ''));
  const org = await a.org.list(), byTitle = title => org[books.find(book => book.title === title).id];
  assert.deepEqual([byTitle('Dom Casmurro').readingStatus, byTitle('Dom Casmurro').rating, byTitle('Dom Casmurro').review], ['completed', 5, 'Capitu\nolhos de ressaca']);
  assert.equal(byTitle('Abandonado').readingStatus, 'interrupted'); assert.equal(byTitle('Abandonado').wantToRead, undefined);
  assert.equal(a.sync.status.pending, 0, 'books without a file stay on the device');
  let failAt = 2, m = 0;
  await assert.rejects(importGoodreadsCandidates({ books: { save: async () => { if (++m === failAt) throw Error('disco cheio'); } }, organization: { save: async () => {} }, newId: () => `gr-fail-${m}0000` }, [dom, torto, quoted], 'physical'),
    /1 livro entrou; os demais não puderam ser gravados \(disco cheio\)/);
  a.db.close();

  // 5. Review screen: read the chosen CSV locally, owned unchecked, choose the format, import the checked ones.
  const saved = [], organized = [], routes = [];
  const h = React.createElement, Plain = type => props => h(type, props, props.children);
  const load = require('./community-test-loader.cjs')({
    react: React, 'react/jsx-runtime': require('../.expo/auth-test-tools/node_modules/react/jsx-runtime'),
    'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', Platform: { OS: 'android' }, StyleSheet: { create: x => x, hairlineWidth: 1 },
      FlatList: ({ data, renderItem, ListHeaderComponent, ListFooterComponent }) => h('List', null, ListHeaderComponent, data.map((item, index) => h(React.Fragment, { key: index }, renderItem({ item, index }))), ListFooterComponent) },
    'expo-document-picker': { getDocumentAsync: async () => ({ canceled: false, assets: [{ uri: 'file:///cache/goodreads.csv', size: EXPORT.length, name: 'goodreads_library_export.csv' }] }) },
    'expo-file-system/legacy': { readAsStringAsync: async uri => { assert.equal(uri, 'file:///cache/goodreads.csv'); return EXPORT; } },
    'expo-router': { router: { replace: target => routes.push(target) } }, '@expo/vector-icons': { Ionicons: props => h('Icon', props) },
    '@/src/ui': { AppText: Plain('Text'), Screen: ({ header, children }) => h('Screen', null, header, children), ScreenHeader: ({ title }) => h('Text', null, title),
      Button: props => h('Pressable', { ...props, accessibilityLabel: props.label }, props.label), Chip: props => h('Pressable', { ...props, accessibilityLabel: props.label, accessibilityState: { selected: props.selected } }, props.label) },
    '@/src/presentation/contexts/AppThemeContext': { useAppTheme: () => ({ palette: { surfaceSecondary: '#eee', separator: '#ddd', accent: '#a54', secondaryText: '#666' } }) },
    '@/src/presentation/services/dependencies': { appDependencies: { bookRepository: { listActive: async () => owned, save: async book => saved.push(book) } }, libraryOrganization: { save: async value => organized.push(value) } },
  });
  const { GoodreadsImportScreen } = load('src/presentation/screens/GoodreadsImportScreen.tsx');
  const text = node => typeof node === 'string' ? node : (node.children ?? []).map(text).join('');
  const flush = () => act(async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); });
  const press = async label => { const node = tree.root.findAll(x => x.type === 'Pressable' && (x.props.accessibilityLabel === label || String(x.props.accessibilityLabel ?? '').startsWith(label + ','))); assert.ok(node.length, 'missing ' + label); await act(async () => { await node[0].props.onPress(); }); await flush(); };
  let tree; await act(async () => { tree = create(h(GoodreadsImportScreen)); });
  assert.match(text(tree.root), /não é enviado a ninguém/);
  await press('Escolher arquivo CSV');
  const box = title => tree.root.findAll(x => x.type === 'Pressable' && x.props.accessibilityRole === 'checkbox' && x.props.accessibilityLabel.startsWith(title))[0];
  assert.equal(box('Torto arado').props.accessibilityState.checked, false, 'owned starts unchecked');
  assert.equal(box('Dom Casmurro').props.accessibilityState.checked, true);
  assert.match(text(tree.root), /Importar 3 livros/);
  await press('Abandonado'); assert.match(text(tree.root), /Importar 2 livros/);
  await press('Audiolivro'); await press('Importar 2 livros');
  assert.equal(saved.length, 2); assert.ok(saved.every(book => book.kind === 'record' && book.recordFormat === 'audiobook'));
  assert.deepEqual(saved.map(book => book.title), ['Dom Casmurro', 'Livro, com "aspas"']);
  assert.match(text(tree.root), /2 livros entraram na sua estante/);
  await press('Ir para a Biblioteca'); assert.deepEqual(routes, ['/library']);
  await act(async () => tree.unmount());
  console.log('PASS Goodreads import: RFC 4180 CSV, real export mapping (ISBN ="…", rating 0, <br/>, shelves, interrupted, duplicates), round trip with the Aldus export, saved as local books without a file with partial-failure count, review screen with owned unchecked, format and selection. Nothing leaves the device.');
})().catch(error => { console.error(error); process.exit(1); });
