// "Organizar livro" (18/11/2026): private rating and review, saving on top of the stored record (fields the sheet does not show are
// kept), "Quero ler", and "Ligar ao catálogo" for a file book. Real component with stub React Native; organization parser checks.
const assert = require('node:assert/strict');
const React = require('../.expo/auth-test-tools/node_modules/react');
const { act, create } = require('../.expo/auth-test-tools/node_modules/react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const saved = [], routes = [];
const h = React.createElement;
const load = require('./community-test-loader.cjs')({
  react: React, 'react/jsx-runtime': require('../.expo/auth-test-tools/node_modules/react/jsx-runtime'),
  'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView', TextInput: 'TextInput', Switch: 'Switch', Modal: ({ children }) => h('Modal', null, children), StyleSheet: { create: x => x } },
  'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) },
  'expo-router': { router: { push: target => routes.push(target) } },
  '@/src/presentation/services/dependencies': { libraryOrganization: { save: async value => { saved.push(value); } } },
  '@/src/presentation/contexts/AppThemeContext': { useAppTheme: () => ({ palette: { panel: '#fff', text: '#111', secondaryText: '#666', accent: '#a54', separator: '#ddd' } }) },
});
const { BookOrganizationModal } = load('src/presentation/components/BookOrganizationModal.tsx');
const { parseOrganizationRecord } = load('src/domain/types/libraryOrganization.ts');
const book = { id: 'b1', title: 'Dom Casmurro', author: 'Machado de Assis', fileName: 'dom.epub', mimeType: 'application/epub+zip', isDeleted: false };
const textOf = node => typeof node === "string" ? node : (node.children ?? []).map(textOf).join("");
const record = { bookId: 'b1', favorite: false, collections: ['Clássicos'], tags: [], series: '', volume: null, readingStatus: 'reading', wantToRead: true, rating: 4, review: 'Capitu!', manualProgress: { page: 10, totalPages: 200, updatedAt: 5 }, updatedAt: 1, revision: 3 };

(async () => {
  // Parser: rating 1–5 only, review up to 20 thousand characters, empty review not stored.
  const base = { bookId: 'x', favorite: false, collections: [], tags: [], series: '', volume: null, readingStatus: null, updatedAt: 1, revision: 1 };
  assert.equal(parseOrganizationRecord({ ...base, rating: 5, review: '  Ótimo  ' }).review, 'Ótimo');
  assert.ok(!('review' in parseOrganizationRecord({ ...base, review: '   ' })));
  for (const rating of [0, 6, 2.5, '4']) assert.throws(() => parseOrganizationRecord({ ...base, rating }), /nota/);
  assert.throws(() => parseOrganizationRecord({ ...base, review: 'x'.repeat(20001) }), /resenha/);
  assert.ok(!('rating' in parseOrganizationRecord(base)), 'old records stay valid');

  let tree; const closed = [];
  await act(async () => { tree = create(h(BookOrganizationModal, { book, record, onClose: () => closed.push(1), onSaved: async () => {} })); });
  const star = n => tree.root.findAll(node => node.type === 'Pressable' && node.props.accessibilityLabel === `Nota ${n} de 5`)[0];
  assert.equal(star(4).props.accessibilityState.checked, true, 'stored rating shown');
  await act(async () => star(2).props.onPress());
  const reviewInput = tree.root.findAll(node => node.type === 'TextInput' && node.props.accessibilityLabel === 'Sua resenha (só você vê)')[0];
  assert.equal(reviewInput.props.value, 'Capitu!'); assert.equal(reviewInput.props.multiline, true);
  await act(async () => reviewInput.props.onChangeText('Olhos de ressaca.'));
  const save = tree.root.findAll(node => node.type === 'Pressable' && textOf(node).includes('Salvar'))[0];
  await act(async () => { await save.props.onPress(); });
  const value = saved.at(-1);
  assert.deepEqual([value.rating, value.review, value.wantToRead, value.revision], [2, 'Olhos de ressaca.', true, 4]);
  assert.deepEqual(value.manualProgress, record.manualProgress, 'fields the sheet does not show are kept');
  assert.doesNotThrow(() => parseOrganizationRecord(value));
  // Tapping the chosen star again removes the rating; an emptied review is not stored.
  await act(async () => star(2).props.onPress());
  await act(async () => reviewInput.props.onChangeText('   '));
  await act(async () => { await save.props.onPress(); });
  assert.ok(!('rating' in parseOrganizationRecord(saved.at(-1))) && !('review' in parseOrganizationRecord(saved.at(-1))));
  // "Ligar ao catálogo" opens the catalog already searching this book's title.
  const linkButton = tree.root.findAll(node => node.type === 'Pressable' && textOf(node).includes('Ligar ao catálogo'))[0];
  await act(async () => linkButton.props.onPress());
  assert.deepEqual(routes.at(-1), { pathname: '/catalog', params: { link: 'b1', q: 'Dom Casmurro' } });
  await act(async () => tree.unmount());
  // A book without a file has no "Ligar ao catálogo" (it already came from the catalog).
  await act(async () => { tree = create(h(BookOrganizationModal, { book: { ...book, id: 'record-x', kind: 'record' }, record: undefined, onClose: () => {}, onSaved: async () => {} })); });
  assert.equal(tree.root.findAll(node => node.type === 'Pressable' && textOf(node).includes('Ligar ao catálogo')).length, 0);
  await act(async () => tree.unmount());
  console.log('PASS book organization sheet: private rating 1–5 and review saved and cleared, stored record fields kept, "Ligar ao catálogo" opens the catalog with the title; not for books without a file.');
})().catch(error => { console.error(error); process.exit(1); });
