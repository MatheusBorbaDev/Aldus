// Painel de obra do vestibular (25/11/2026): domínio público primeiro, só a mesma obra, baixar e adicionar, depois a ficha do catálogo.
const assert = require('node:assert/strict');
const React = require('../.expo/auth-test-tools/node_modules/react');
const { act, create } = require('../.expo/auth-test-tools/node_modules/react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const routes = [], queries = [], enqueued = []; let results = [], failSearch = false, jobResult = { status: 'completed', importedBookId: 'book-1' };
const owner = 'user-a';
const sources = [{ id: 'drive-a', name: 'Meu Drive', enabled: true, status: 'active', ownerId: owner, kind: 'google-drive' },
  { id: 'drive-b', name: 'Drive de outra conta', enabled: true, status: 'active', ownerId: 'user-b', kind: 'google-drive' }];
const jobs = {};
const downloadState = { jobs, enqueue: async job => { enqueued.push(job); jobs[job.id] = { ...job, ...jobResult }; } };
const useDownloadStore = Object.assign(selector => selector(downloadState), { getState: () => downloadState });
let usedPlugins = [];
const load = require('./community-test-loader.cjs')({
  react: React, 'react/jsx-runtime': require('../.expo/auth-test-tools/node_modules/react/jsx-runtime'),
  'react-native': { View: 'View', StyleSheet: { create: x => x } },
  'expo-router': { router: { push: target => routes.push(target) } },
  '@/src/ui': { AppText: ({ children }) => React.createElement('Text', null, children), Button: ({ label, onPress, disabled }) => React.createElement('Button', { label, onPress, disabled }) },
  '@/src/presentation/contexts/AppThemeContext': { useAppTheme: () => ({ palette: { border: '#ddd', surface: '#fff' } }) },
  '@/src/presentation/services/dependencies': { appDependencies: { searchBooks: {
    executeDetailed: async (query, plugins) => { queries.push(query); usedPlugins = plugins.map(p => p.name); if (failSearch) return { results: [], sources: [{ sourceName: 'Gutendex', status: 'error' }] }; return { results, sources: [{ sourceName: 'Gutendex', status: 'success' }] }; },
    resolveAcquisition: async item => item,
  } } },
  '@/src/presentation/stores/downloadStore': { useDownloadStore },
  '@/src/presentation/stores/libraryStore': { useLibraryStore: { getState: () => ({ load: async () => undefined }) } },
  '@/src/data/sources/UserSourceRepository': { UserSourceRepository: class { async list() { return sources; } } },
  '@/src/data/scraping/catalogPlugins': { builtinCatalogs: () => [{ name: 'Gutendex' }], configuredCatalog: source => ({ name: source.name }) },
  '@/src/data/library/LibraryAccountScope': { libraryAccountScope: { userId: owner } },
  '@/src/domain/types/sourceCatalog': { sourceIdentity: source => `identity:${source.id}` },
});
const { VestibularBookPanel } = load('src/presentation/components/study/VestibularBookPanel.tsx');
const raw = n => typeof n === 'string' ? n : Array.isArray(n) ? n.map(raw).join(' ') : (n?.children ?? []).map(raw).join(' ');
const text = n => raw(n).replace(/\s+/g, ' ');
const flush = () => act(async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); });
const btn = (tree, label) => tree.root.findAllByType('Button').find(b => b.props.label === label);
const book = { position: 1, title: 'Iracema', author: 'José de Alencar', note: null };
(async () => {
  results = [
    { url: 'https://drive/iracema.pdf', title: 'Iracema.pdf', format: 'pdf', sourceSite: 'Meu Drive', sourceId: 'drive-a', estimatedSize: null },
    { url: 'https://gutenberg/iracema.epub', title: 'Iracema: Lenda do Ceará', author: 'Alencar, José Martiniano de', format: 'epub', sourceSite: 'Project Gutenberg', estimatedSize: null },
    { url: 'https://gutenberg/outro.epub', title: 'Iracema', author: 'Outro Autor', format: 'epub', sourceSite: 'Project Gutenberg', estimatedSize: null },
    { url: 'https://gutenberg/iracema.mobi', title: 'Iracema', author: 'José de Alencar', format: 'mobi', sourceSite: 'Project Gutenberg', estimatedSize: null },
  ];
  let tree; await act(async () => { tree = create(React.createElement(VestibularBookPanel, { book })); }); await flush();
  // Only title + surname leaves the device; only this account's sources are searched.
  assert.deepEqual(queries, ['Iracema alencar']); assert.deepEqual(usedPlugins, ['Gutendex', 'Meu Drive'], 'another account\'s Drive is not searched');
  const shown = text(tree.toJSON());
  // Public domain first, the user's own file after; the wrong author and MOBI never appear.
  assert.ok(shown.indexOf('Domínio público · disponível para baixar') < shown.indexOf('Disponível nas suas fontes'));
  assert.ok(!shown.includes('Outro Autor') && !shown.includes('MOBI'));
  // Download and add, then open to read; the catalog sheet stays one tap away.
  await act(async () => tree.root.findAllByType('Button').filter(b => b.props.label === 'Baixar e adicionar')[0].props.onPress()); await flush();
  assert.equal(enqueued[0].url, 'https://gutenberg/iracema.epub'); assert.equal(enqueued[0].fileName, 'iracema.epub'); assert.equal(enqueued[0].source, undefined);
  assert.ok(text(tree.toJSON()).includes('Adicionado à sua Biblioteca.'));
  await act(async () => btn(tree, 'Abrir para ler').props.onPress()); assert.equal(routes.at(-1), '/reader/book-1');
  await act(async () => btn(tree, 'Ver no catálogo (Quero ler, Lendo, Lido)').props.onPress());
  assert.deepEqual(routes.at(-1), { pathname: '/catalog', params: { q: 'Iracema José de Alencar' } });
  await act(async () => tree.unmount());
  // A failed download is said, not reported as added.
  jobResult = { status: 'failed', error: 'O servidor recusou o download.' }; Object.keys(jobs).forEach(k => delete jobs[k]);
  await act(async () => { tree = create(React.createElement(VestibularBookPanel, { book })); }); await flush();
  await act(async () => tree.root.findAllByType('Button').filter(b => b.props.label === 'Baixar e adicionar')[0].props.onPress()); await flush();
  assert.ok(text(tree.toJSON()).includes('O servidor recusou o download.')); assert.ok(!btn(tree, 'Abrir para ler'));
  await act(async () => tree.unmount());
  // Nothing found: honest message, catalog still offered. Sources down: says so.
  results = []; await act(async () => { tree = create(React.createElement(VestibularBookPanel, { book })); }); await flush();
  assert.ok(text(tree.toJSON()).includes('Não achamos arquivo gratuito desta obra')); assert.ok(btn(tree, 'Ver no catálogo (Quero ler, Lendo, Lido)'));
  await act(async () => tree.unmount());
  failSearch = true; await act(async () => { tree = create(React.createElement(VestibularBookPanel, { book })); }); await flush();
  assert.ok(text(tree.toJSON()).includes('Não foi possível consultar as fontes'));
  await act(async () => tree.unmount());
  console.log('PASS vestibular download: title+surname query, own-account sources only, same work only (author, epub/pdf), public domain first, download and add then open, failure said, nothing found said, catalog still offered.');
})().catch(error => { console.error(error); process.exitCode = 1; });
