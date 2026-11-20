// Descobrir tab (app/(tabs)/search.tsx). Since 19/11/2026 (owner: "troca essa aba descobrir pelo catalogo estilo netflix ... e remove
// esses negocios de gutendex biblion e mec livros") the tab is the catalog showcase (covered in test-catalog-records) with Suas
// fontes at the end. Here: the tab wiring and the account-scoped sources block. Stub stores/host components; not a visual/Android proof.
const assert = require('node:assert/strict');
const React = require('../.expo/auth-test-tools/node_modules/react');
const { act, create } = require('../.expo/auth-test-tools/node_modules/react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;

const { appThemeTokens } = require('./community-test-loader.cjs')()('src/theme/tokens.ts');
const palette = appThemeTokens.light;
const routes = [];
const searches = [];
const selected = [];
const host = name => {
  const Component = ({ children, ...props }) => React.createElement(name, props, typeof children === 'function' ? children({ pressed: false }) : children);
  Component.displayName = name;
  return Component;
};
const FlatList = ({ data, renderItem, ListHeaderComponent, ListFooterComponent }) => React.createElement('FlatList', null,
  ListHeaderComponent, ...data.map((item, index) => React.createElement(React.Fragment, { key: index }, renderItem({ item, index }))), ListFooterComponent);
const store = state => Object.assign(selector => (selector ? selector(state) : state), { getState: () => state });
const accountA = '00000000-0000-4000-8000-00000000000a';
const sourcesState = {
  sources: [
    { id: 'drive-a', name: 'Meu Drive', kind: 'google-drive', ownerId: accountA, enabled: true, status: 'active' },
    { id: 'link-a', name: 'Clube de leitura', kind: 'json', ownerId: accountA, enabled: false, status: 'active' },
    { id: 'drive-b', name: 'Drive de outra conta', kind: 'google-drive', ownerId: 'other-account', enabled: true, status: 'active' },
  ],
  load: async () => undefined,
};
const searchState = {
  query: '', results: [], sourceStatuses: [], nextPageUrl: null, status: 'idle', error: null, isSearching: false, pendingSources: [],
  selectedSource: 'Todos', setQuery: value => { searchState.query = value; }, search: async filter => searches.push(filter), loadMore: async () => undefined,
  cancel: () => undefined, selectSource: value => selected.push(value),
};
const overrides = {
  react: React,
  'react/jsx-runtime': require('../.expo/auth-test-tools/node_modules/react/jsx-runtime'),
  'react-native': {
    View: host('View'), Text: host('Text'), Pressable: host('Pressable'), ScrollView: host('ScrollView'), TextInput: host('TextInput'), FlatList,
    ActivityIndicator: host('ActivityIndicator'), Modal: ({ visible, children }) => (visible ? React.createElement('Modal', null, children) : null), Linking: { openURL: async () => undefined },
    StyleSheet: { create: styles => styles, hairlineWidth: 1, absoluteFill: {} }, Platform: { OS: 'android', select: options => options.android ?? options.default },
    useWindowDimensions: () => ({ width: 390, height: 844 }),
  },
  '@expo/vector-icons': { Ionicons: host('Icon') },
  'expo-router': { router: { push: route => routes.push(route), replace: route => routes.push(route), back: () => undefined, canGoBack: () => false } },
  'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }) },
  '@/src/presentation/contexts/AppThemeContext': { useAppTheme: () => ({ palette }) },
  '@/src/presentation/components/BookCover': { BookCover: host('BookCover') },
  '@/src/presentation/components/AuthGuard': { AuthGuard: ({ children }) => React.createElement('AuthGuard', null, children) },
  '@/src/presentation/screens/CatalogScreen': { CatalogScreen: props => React.createElement('CatalogScreen', props) },
  '@/src/presentation/stores/searchStore': { useSearchStore: store(searchState) },
  '@/src/presentation/stores/downloadStore': { useDownloadStore: store({ jobs: {}, enqueue: async () => undefined, cancel: async () => undefined }) },
  '@/src/presentation/stores/sourceStore': { useSourceStore: store(sourcesState) },
  '@/src/presentation/stores/libraryStore': { useLibraryStore: store({ load: async () => undefined }) },
  '@/src/data/scraping/catalogPlugins': { BUILTIN_CATALOG_NAMES: ['Gutendex', 'Gutenberg'] },
  '@/src/data/scraping/BNDigitalSearchPlugin': { BNDIGITAL_BLOCK_REASON: 'BNDigital indisponível.' },
  '@/src/presentation/services/dependencies': { appDependencies: { searchBooks: {} } },
  '@/src/presentation/components/sourcePresentation': {
    useSourceAccountId: () => accountA,
    sourceVisibleInAccount: (source, account) => (source.ownerId ?? null) === account,
    sourceLibraryTypeLabel: kind => (kind === 'google-drive' ? 'Google Drive' : kind === 'json' ? 'Biblioteca por link' : 'Catálogo de pesquisa'),
  },
  '@/src/domain/types/sourceCatalog': {
    sourceIdentity: () => 'identity',
    sourceCapabilities: source => ({ supportsCatalog: source.kind !== 'search', supportsSearch: source.kind === 'search' }),
  },
};
const load = require('./community-test-loader.cjs')(overrides);
// `@/src/ui` is a folder: resolve its index through the same loader.
Object.defineProperty(overrides, "@/src/ui", { get: () => load("src/ui/index.ts") });
const text = node => typeof node === 'string' ? node : (node.children ?? []).map(text).join('');

(async () => {
  // The tab is the catalog in tab mode, behind the same guard as the /catalog route; the old search/sources code is gone.
  const Discover = load('app/(tabs)/search.tsx').default;
  let view;
  await act(async () => { view = create(React.createElement(Discover)); });
  const screens = view.root.findAll(node => node.type === 'CatalogScreen');
  assert.equal(screens.length, 1); assert.equal(screens[0].props.tab, true);
  assert.equal(view.root.findAll(node => node.type === 'AuthGuard').length, 1);
  const tabSource = require('node:fs').readFileSync('app/(tabs)/search.tsx', 'utf8');
  assert.doesNotMatch(tabSource, /Gutendex|Gutenberg|BibliON|MEC|BNDigital|searchStore|downloadStore/, 'old catalogs and digital libraries removed from the tab');
  const settings = require('node:fs').readFileSync('src/presentation/screens/SettingsScreen.tsx', 'utf8');
  assert.doesNotMatch(settings, /BibliON e MEC Livros/, 'Conta no longer links to BibliON/MEC');
  // 19/11 (dono: "ficou muito escondido o drive"): Suas fontes vêm antes das fileiras do catálogo, sem esperar que carreguem.
  const catalogScreen = require('node:fs').readFileSync('src/presentation/screens/CatalogScreen.tsx', 'utf8');
  assert.ok(catalogScreen.indexOf('<YourSources />') > 0 && catalogScreen.indexOf('<YourSources />') < catalogScreen.indexOf('<CatalogShelves'), 'Suas fontes before the shelves');
  await act(async () => view.unmount());

  // Suas fontes: only this account's sources, disabled ones say so, and every row/button goes where it should.
  const { YourSources } = load('src/presentation/components/catalog/YourSources.tsx');
  await act(async () => { view = create(React.createElement(YourSources)); });
  const all = text(view.root);
  const button = label => view.root.findAllByType('Pressable').find(node => node.props.accessibilityLabel === label);
  const has = label => Boolean(button(label));
  assert.match(all, /Suas fontes/);
  for (const label of ['Adicionar fonte', 'Gerenciar fontes', 'Meu Drive', 'Clube de leitura']) assert.ok(has(label), 'visible: ' + label);
  assert.equal(has('Drive de outra conta'), false, 'other account sources stay hidden');
  assert.match(all, /Biblioteca por link · desativada/);
  await act(async () => button('Adicionar fonte').props.onPress()); assert.equal(routes.pop(), '/sources?add=1');
  await act(async () => button('Gerenciar fontes').props.onPress()); assert.equal(routes.pop(), '/sources');
  await act(async () => button('Meu Drive').props.onPress());
  assert.deepEqual(routes.pop(), { pathname: '/sources/[sourceId]', params: { sourceId: 'drive-a' } });
  await act(async () => view.unmount());

  console.log('PASS Descobrir: catalog tab behind AuthGuard, no Gutendex/Gutenberg/BibliON/MEC, account-scoped Suas fontes with Adicionar/Gerenciar/open routes. Stub stores; not a visual/Android proof.');
})().catch(error => { console.error(error); process.exit(1); });
