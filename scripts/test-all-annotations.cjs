// FASE 3, A2: "Todas as anotações". Domínio real (juntar grifos e marcadores de todos os livros, fixados primeiro, busca sem
// acento, filtros) e a tela real com repositórios simulados: só livros da conta, abrir leva ao livro, vazio dito como vazio.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const React = require('../.expo/auth-test-tools/node_modules/react');
const { act, create } = require('../.expo/auth-test-tools/node_modules/react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;

const domainLoad = require('./community-test-loader.cjs')({ 'react-native': { Platform: { OS: 'android' } } });
const { collectAnnotations, filterAnnotations, normalizeSearch } = domainLoad('src/domain/study/allAnnotations.ts');

const hl = (id, bookId, text, createdAt, extra = {}) => ({ id, bookId, chapterId: 'c', startCfi: JSON.stringify({ note: extra.note ?? '', chapterTitle: extra.chapter ?? '' }), endCfi: 's', highlightedText: text, colorLabel: 'green', createdAt, pinned: extra.pinned });
const bm = (id, bookId, text, createdAt, note = null) => ({ id, bookId, chapterId: 'c', cfiPosition: null, textPreview: text, note, createdAt });
const read = highlight => { const value = JSON.parse(highlight.startCfi); return { note: value.note, chapterTitle: value.chapter ?? value.chapterTitle }; };

const items = collectAnnotations([
  { book: { id: 'b1', title: 'Dom Casmurro' }, highlights: [hl('h1', 'b1', 'Olhos de ressaca', 5, { note: 'Capitu', chapter: 'XXXII' }), hl('h2', 'b1', 'Trecho fixado', 1, { pinned: true }), hl('intruso', 'b2', 'De outro livro', 9)], bookmarks: [bm('m1', 'b1', 'Marcador do capítulo', 7, 'voltar aqui')] },
  { book: { id: 'b2', title: 'Quincas Borba' }, highlights: [hl('h3', 'b2', 'Ao vencedor, as batatas', 3)], bookmarks: [] },
], read);
assert.deepEqual(items.map(item => item.key), ['h:h2', 'b:m1', 'h:h1', 'h:h3'], 'fixado primeiro, depois do mais recente ao mais antigo; grifo de outro livro ignorado');
assert.deepEqual({ ...items[2] }, { key: 'h:h1', kind: 'highlight', bookId: 'b1', bookTitle: 'Dom Casmurro', text: 'Olhos de ressaca', note: 'Capitu', chapterTitle: 'XXXII', color: 'green', pinned: false, createdAt: 5 });
assert.equal(items[1].chapterTitle, null, 'marcador sem capítulo inventado');
assert.equal(normalizeSearch('  ÁGUA Ação '), 'agua acao');
assert.deepEqual(filterAnnotations(items, 'capítu', 'all').map(i => i.key), ['b:m1', 'h:h1'], 'busca sem acento em trecho e nota');
assert.deepEqual(filterAnnotations(items, 'quincas', 'all').map(i => i.key), ['h:h3'], 'busca pelo título do livro');
assert.deepEqual(filterAnnotations(items, '', 'pinned').map(i => i.key), ['h:h2']);
assert.deepEqual(filterAnnotations(items, '', 'bookmark').map(i => i.key), ['b:m1']);
assert.deepEqual(filterAnnotations(items, '', 'highlight').map(i => i.key), ['h:h2', 'h:h1', 'h:h3']);

(async () => {
  const navigations = [];
  let account = 'A';
  const library = {
    A: { books: [{ id: 'b1', title: 'Dom Casmurro', isDeleted: false }, { id: 'apagado', title: 'Removido', isDeleted: true }], highlights: { b1: [hl('h1', 'b1', 'Olhos de ressaca', 5, { note: 'Capitu' })], apagado: [hl('x', 'apagado', 'Não deve aparecer', 9)] }, bookmarks: { b1: [] } },
    B: { books: [], highlights: {}, bookmarks: {} },
  };
  const deps = { appDependencies: {
    bookRepository: { listActive: async () => library[account].books },
    highlightRepository: { listByBookId: async id => library[account].highlights[id] ?? [] },
    bookmarkRepository: { listByBookId: async id => library[account].bookmarks[id] ?? [] },
  } };
  const ui = {
    AppText: ({ children }) => React.createElement('Text', null, children), Screen: ({ header, children }) => React.createElement('View', null, header, children),
    ScreenHeader: ({ title }) => React.createElement('Text', null, title), EmptyState: ({ title, description }) => React.createElement('Text', null, `${title} ${description ?? ''}`),
    SearchField: props => React.createElement('TextInput', props), Chip: props => React.createElement('Pressable', { accessibilityLabel: props.label, onPress: props.onPress }), ChipRow: ({ children }) => React.createElement('View', null, children),
  };
  const load = require('./community-test-loader.cjs')({
    react: React, 'react/jsx-runtime': require('../.expo/auth-test-tools/node_modules/react/jsx-runtime'),
    'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', StyleSheet: { create: x => x, hairlineWidth: 1 }, Platform: { OS: 'android' } },
    'expo-router': { router: { push: target => navigations.push(target) } },
    '@/src/ui': ui,
    '@/src/presentation/contexts/AppThemeContext': { useAppTheme: () => ({ palette: { border: '#ddd', surface: '#fff' } }) },
    '@/src/presentation/services/dependencies': deps,
    '@/src/presentation/services/bookDisplay': { readableBookTitle: book => book.title },
    '@/src/presentation/components/StudyPanelControls': { studyColorSwatches: { green: '#0f0', yellow: '#ff0', blue: '#00f', pink: '#f0f', purple: '#80f' } },
    '@/src/domain/usecases/StudyHighlights': { readHighlightLocation: read },
    '@/src/data/library/LibraryAccountScope': { libraryAccountScope: { capture: () => ({ check: () => undefined }) } },
  });
  const { AllAnnotationsScreen } = load('src/presentation/screens/AllAnnotationsScreen.tsx');
  let tree;
  const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  await act(async () => { tree = create(React.createElement(AllAnnotationsScreen)); }); await flush();
  const text = () => tree.root.findAllByType('Text').map(n => [n.props.children].flat().join('')).join('\n');
  assert.match(text(), /Olhos de ressaca/); assert.match(text(), /Capitu/); assert.ok(!text().includes('Não deve aparecer'), 'livro excluído não entra');
  const open = tree.root.findAllByType('Pressable').find(n => n.props.accessibilityLabel?.startsWith('Abrir Dom Casmurro'));
  await act(async () => open.props.onPress()); assert.deepEqual(navigations.at(-1), { pathname: '/reader/[bookId]', params: { bookId: 'b1' } });
  const search = tree.root.findByType('TextInput'); await act(async () => search.props.onChangeText('batata')); assert.match(text(), /Nenhuma anotação corresponde/);
  await act(async () => tree.unmount());
  account = 'B'; await act(async () => { tree = create(React.createElement(AllAnnotationsScreen)); }); await flush();
  assert.match(text(), /Nenhuma anotação ainda/, 'conta sem anotações: vazio dito como vazio'); assert.ok(!text().includes('Olhos de ressaca'), 'conta B não vê anotações de A');
  await act(async () => tree.unmount());

  assert.match(fs.readFileSync('app/(tabs)/library.tsx', 'utf8'), /label: "Todas as anotações"[^\n]*router\.push\("\/annotations"/);
  assert.match(fs.readFileSync('app/annotations.tsx', 'utf8'), /<AuthGuard><AllAnnotationsScreen \/><\/AuthGuard>/);
  console.log('PASS all annotations: grifos e marcadores de todos os livros, fixados primeiro, busca sem acento (trecho, nota, capítulo, livro), filtros, livro excluído fora, conta B isolada, abrir leva ao livro. Sem aparelho.');
})().catch(error => { console.error(error); process.exit(1); });
