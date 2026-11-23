// Módulo PC (23/11/2026): uma só decisão de layout (PC = Web, janela >= 1024 e mouse) e a barra lateral do PC renderizada
// de verdade com react-test-renderer e um React Native de teste. Não é captura de tela nem prova de navegador real.
const assert = require('node:assert/strict');
const React = require('../.expo/auth-test-tools/node_modules/react');
const { act, create } = require('../.expo/auth-test-tools/node_modules/react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const pushed = [];
const sync = { status: { running: false, pendingFiles: 0, error: null }, engine: { status: { pending: 0, lastSync: null, error: null } } };
const load = require('./community-test-loader.cjs')({
  react: React, 'react/jsx-runtime': require('../.expo/auth-test-tools/node_modules/react/jsx-runtime'),
  'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', TextInput: 'TextInput', Platform: { OS: 'web' }, StyleSheet: { create: x => x, hairlineWidth: 1 } },
  '@expo/vector-icons': { Ionicons: 'Icon' },
  'expo-router': { router: { push: route => pushed.push(route) } },
  '@/src/presentation/contexts/AppThemeContext': { useAppTheme: () => ({ palette: { tabBar: '#FBF9F4', border: '#ddd', text: '#203B32', secondaryText: '#5C6A63', accent: '#8F4528', accentSoft: '#F6E9E1', input: '#fff', surfaceSecondary: '#EDEFE5' } }) },
  '@/src/presentation/components/LibrarySyncControls': { useLibrarySync: () => sync },
  '@/src/presentation/i18n/ptBR': { numberLabel: n => String(n) },
  '@/src/ui': { radius: { md: 10 }, space: { xxs: 2, sm: 8, md: 12, lg: 16, xl: 20 }, typography: { title: {}, label: {}, bodySmall: {}, caption: {} } },
});

(async () => {
  const { formFactorFor, DESKTOP_MIN_WIDTH } = load('src/presentation/layout/formFactor.ts');
  assert.equal(DESKTOP_MIN_WIDTH, 1024);
  assert.equal(formFactorFor({ web: true, width: 1280, finePointer: true }), 'desktop', 'PC: Web, wide window, mouse');
  assert.equal(formFactorFor({ web: true, width: 1024, finePointer: true }), 'desktop');
  assert.equal(formFactorFor({ web: true, width: 1023, finePointer: true }), 'tablet', 'a narrow PC window keeps the touch layout');
  assert.equal(formFactorFor({ web: true, width: 1366, finePointer: false }), 'tablet', 'a wide touch tablet is not a PC');
  assert.equal(formFactorFor({ web: true, width: 390, finePointer: false }), 'phone', 'the site on a phone keeps the phone layout');
  assert.equal(formFactorFor({ web: false, width: 1280, finePointer: true }), 'tablet', 'the Android app is never the PC layout');
  assert.equal(formFactorFor({ web: false, width: 390, finePointer: false }), 'phone');

  const { DesktopSidebar, sidebarSyncLabel, DESKTOP_SIDEBAR_WIDTH } = load('src/presentation/components/desktop/DesktopSidebar.tsx');
  assert.equal(sidebarSyncLabel({ running: true, pending: 3, lastSync: 1, error: null }), 'Sincronizando…');
  assert.equal(sidebarSyncLabel({ running: false, pending: 0, lastSync: 1, error: 'x' }), 'Sincronização com erro');
  assert.equal(sidebarSyncLabel({ running: false, pending: 1, lastSync: 1, error: null }), '1 alteração pendente');
  assert.equal(sidebarSyncLabel({ running: false, pending: 4, lastSync: null, error: null }), '4 alterações pendentes');
  assert.equal(sidebarSyncLabel({ running: false, pending: 0, lastSync: 1, error: null }), 'Biblioteca sincronizada');
  assert.equal(sidebarSyncLabel({ running: false, pending: 0, lastSync: null, error: null }), 'Ainda não sincronizada', 'never claims a sync that did not happen');

  const names = [['library', 'Biblioteca'], ['search', 'Descobrir'], ['study', 'Estudo'], ['community', 'Comunidade'], ['settings', 'Conta']];
  const routes = names.map(([name]) => ({ key: name + '-k', name }));
  const descriptors = Object.fromEntries(names.map(([name, title]) => [name + '-k', { options: { title, tabBarItemStyle: name === 'study' ? { display: 'none' } : undefined, tabBarIcon: () => React.createElement('Icon', { name }) } }]));
  const events = [], navigated = [];
  const navigation = { emit: event => { events.push(event.target); return { defaultPrevented: false }; }, navigate: (name, params) => navigated.push(name) };
  let tree;
  await act(async () => { tree = create(React.createElement(DesktopSidebar, { state: { index: 0, routes }, descriptors, navigation })); });
  const bar = tree.root.findAllByType('View')[0];
  assert.equal(bar.props.style[0].width, DESKTOP_SIDEBAR_WIDTH);assert.equal(bar.props.role, 'navigation');
  const links = tree.root.findAllByType('Pressable').filter(p => p.props.accessibilityRole === 'link');
  assert.deepEqual(links.map(l => l.props.accessibilityLabel), ['Biblioteca', 'Descobrir', 'Comunidade', 'Conta'], 'labelled sections; Estudo hidden like the tab bar when there is no access');
  assert.deepEqual(links.map(l => l.props.accessibilityState.selected), [true, false, false, false]);
  await act(async () => links[2].props.onPress());assert.deepEqual([events.at(-1), navigated.at(-1)], ['community-k', 'community']);
  await act(async () => links[0].props.onPress());assert.equal(navigated.length, 1, 'the open section is not navigated again');
  const input = tree.root.findByType('TextInput');
  assert.equal(input.props.accessibilityLabel, 'Buscar livros no catálogo');
  await act(async () => input.props.onChangeText('a'));await act(async () => input.props.onSubmitEditing());assert.equal(pushed.length, 0, 'one letter does not search');
  await act(async () => input.props.onChangeText('  Dom Casmurro '));await act(async () => input.props.onSubmitEditing());
  assert.deepEqual(pushed.at(-1), { pathname: '/catalog', params: { q: 'Dom Casmurro' } });
  const syncButton = tree.root.findAllByType('Pressable').find(p => p.props.accessibilityRole === 'button');
  assert.equal(syncButton.props.accessibilityLabel, 'Ainda não sincronizada. Abrir sincronização na Conta');
  await act(async () => syncButton.props.onPress());assert.equal(pushed.at(-1), '/settings');
  await act(async () => tree.unmount());
  console.log('PASS desktop layout: PC only for Web + window >= 1024 + mouse (narrow PC window, touch tablet, phone site and Android keep the touch layout); sidebar with labelled sections, hidden Estudo, search to the catalog, honest sync status. Component test, not a browser capture.');
})().catch(error => { console.error(error); process.exitCode = 1; });
