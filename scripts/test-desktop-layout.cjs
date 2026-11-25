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
  '@/src/utils/epubOpenMetrics': { epubDiagnosticConsole: { log() {} } },
  '@/src/presentation/layout/useFormFactor': { useFormFactor: () => globalThis.__formFactor || 'phone' },
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


  // Fase 2: Ctrl/Shift na Biblioteca do PC, clique duplo e o painel de detalhes.
  const { pointerSelection, isDoubleActivation, pointerKeysFrom } = load('src/presentation/layout/desktopSelection.ts');
  const order = ['a', 'b', 'c', 'd', 'e'];
  let step = pointerSelection(order, new Set(), null, 'b', { toggle: true, range: false });
  assert.deepEqual([[...step.selection], step.anchor], [['b'], 'b'], 'Ctrl marks one book and anchors it');
  step = pointerSelection(order, step.selection, step.anchor, 'd', { toggle: false, range: true });
  assert.deepEqual([[...step.selection].sort(), step.anchor], [['b', 'c', 'd'], 'b'], 'Shift adds the range in the shown order');
  step = pointerSelection(order, step.selection, step.anchor, 'a', { toggle: false, range: true });
  assert.deepEqual([...step.selection].sort(), ['a', 'b', 'c', 'd'], 'the range also goes backwards');
  step = pointerSelection(order, step.selection, step.anchor, 'c', { toggle: true, range: false });
  assert.deepEqual([[...step.selection].sort(), step.anchor], [['a', 'b', 'd'], 'c'], 'Ctrl unmarks and moves the anchor');
  assert.deepEqual([...pointerSelection(order, new Set(), null, 'e', { toggle: false, range: true }).selection], ['e'], 'Shift without an anchor marks the book');
  assert.deepEqual([...pointerSelection(order, new Set(), 'gone', 'e', { toggle: false, range: true }).selection], ['e'], 'an anchor filtered out of the list is not a range');
  assert.equal(isDoubleActivation({ id: 'a', at: 1000 }, 'a', 1300), true);
  assert.equal(isDoubleActivation({ id: 'a', at: 1000 }, 'a', 1600), false, 'slow second click only shows the book');
  assert.equal(isDoubleActivation({ id: 'a', at: 1000 }, 'b', 1100), false, 'another book is not a double click');
  assert.equal(isDoubleActivation(null, 'a', 1), false);
  assert.deepEqual(pointerKeysFrom({ nativeEvent: { metaKey: true, shiftKey: true } }), { toggle: true, range: true }, 'Cmd counts as Ctrl');
  assert.deepEqual(pointerKeysFrom(undefined), { toggle: false, range: false });

  // Fase 3: atalhos do leitor no PC (Espaço/Page Down avançam, Shift+Espaço/Page Up voltam; nada enquanto se digita).
  const listeners = {};
  global.window = { addEventListener: (type, fn) => { listeners[type] = fn; }, removeEventListener: () => {} };
  const { ReadingTouchZones } = load('src/presentation/components/reader/ReadingTouchZones.tsx');
  const turns = [];
  let zones;
  await act(async () => { zones = create(React.createElement(ReadingTouchZones, { onPreviousPage: () => turns.push('prev'), onNextPage: () => turns.push('next'), onToggleControls: () => turns.push('controls') })); });
  const press = (key, extra = {}) => listeners.keydown({ key, shiftKey: false, altKey: false, ctrlKey: false, metaKey: false, target: { closest: () => null }, preventDefault() {}, ...extra });
  press(' '); press('PageDown'); press('ArrowRight'); press(' ', { shiftKey: true }); press('PageUp'); press('ArrowLeft'); press('Escape');
  press(' ', { target: { closest: () => ({}) } }); press('PageDown', { ctrlKey: true });
  assert.deepEqual(turns, ['next', 'next', 'next', 'prev', 'prev', 'prev', 'controls'], 'Space/PageDown forward, Shift+Space/PageUp back; typing or Ctrl does not turn');
  await act(async () => zones.unmount());
  delete global.window;

  // Fase 3b: sumário à esquerda e ajustes/busca/marcações à direita, em altura inteira, por cima do livro (sem relayout).
  const { desktopSheetStyles, DESKTOP_SHEET_WIDTH } = load('src/presentation/layout/desktopSheet.ts');
  const left = desktopSheetStyles('left'), right = desktopSheetStyles('right');
  assert.equal(left.backdrop.justifyContent, 'flex-start');assert.equal(right.backdrop.justifyContent, 'flex-end');
  assert.deepEqual([right.panel.width, right.panel.height, right.panel.borderRadius], [DESKTOP_SHEET_WIDTH, '100%', 0]);
  assert.equal(left.panel.borderRightWidth, 1);assert.equal(right.panel.borderLeftWidth, 1);

  // Fase 4: com o site aberto, a biblioteca busca mudanças a cada 90 s, só com a aba visível e online; parar cancela o relógio.
  const { startWebPeriodicSync, WEB_SYNC_INTERVAL_MS } = load('src/presentation/services/webPeriodicSync.ts');
  const ticks = [];let cleared = null;let runs = 0;
  const env = { setInterval: (fn, ms) => { ticks.push([fn, ms]); return 'timer'; }, clearInterval: id => { cleared = id; }, document: { visibilityState: 'visible' }, navigator: { onLine: true } };
  const stop = startWebPeriodicSync(() => runs++, env);
  assert.equal(WEB_SYNC_INTERVAL_MS, 90000);assert.equal(ticks[0][1], 90000);
  ticks[0][0]();assert.equal(runs, 1, 'visible and online: fetches changes');
  env.document.visibilityState = 'hidden';ticks[0][0]();assert.equal(runs, 1, 'hidden tab: nothing');
  env.document.visibilityState = 'visible';env.navigator.onLine = false;ticks[0][0]();assert.equal(runs, 1, 'offline: nothing');
  stop();assert.equal(cleared, 'timer');
  assert.equal(typeof startWebPeriodicSync(() => runs++, { setInterval() { throw Error('no timer without a page'); }, clearInterval() {} })(), 'undefined', 'no document (native): no timer');

  // Fase 5: Estudo e Comunidade em colunas no PC; no celular, os mesmos filhos numa coluna, na mesma ordem.
  const { DesktopGrid, DesktopSplit, DESKTOP_ASIDE_WIDTH } = load('src/presentation/components/desktop/DesktopColumns.tsx');
  const card = name => React.createElement('Text', { key: name }, name);
  let grid;
  await act(async () => { grid = create(React.createElement(DesktopGrid, null, card('Pessoas'), null, card('Clubes'), false, card('Fóruns'))); });
  assert.equal(grid.root.findAllByType('View').length, 0, 'phone: no extra wrappers');assert.deepEqual(grid.root.findAllByType('Text').map(t => t.props.children), ['Pessoas', 'Clubes', 'Fóruns']);
  globalThis.__formFactor = 'desktop';
  await act(async () => { grid.update(React.createElement(DesktopGrid, null, card('Pessoas'), null, card('Clubes'), false, card('Fóruns'))); });
  const gridViews = grid.root.findAllByType('View');
  assert.deepEqual([gridViews[0].props.style.flexDirection, gridViews[0].props.style.flexWrap], ['row', 'wrap']);assert.equal(gridViews.length, 4, 'PC: one cell per card, empty children take no cell');
  let split;
  await act(async () => { split = create(React.createElement(DesktopSplit, { main: card('Revisar'), aside: card('Seus decks') })); });
  const splitViews = split.root.findAllByType('View');
  assert.equal(splitViews[0].props.style.flexDirection, 'row');assert.equal(splitViews[2].props.style.width, DESKTOP_ASIDE_WIDTH);
  globalThis.__formFactor = 'phone';
  await act(async () => { split.update(React.createElement(DesktopSplit, { main: card('Revisar'), aside: card('Seus decks') })); });
  assert.deepEqual(split.root.findAllByType('Text').map(t => t.props.children), ['Revisar', 'Seus decks'], 'phone: decks after the review, one column');assert.equal(split.root.findAllByType('View').length, 0);
  delete globalThis.__formFactor;

  // Barra de status (23/11/2026): no Android de ponta a ponta, uma faixa da cor do fundo cobre o que rola por baixo do relógio.
  for (const [os, top, expected] of [['android', 32, 32], ['web', 32, null], ['android', 0, null]]) {
    const scrimLoad = require('./community-test-loader.cjs')({
      react: React, 'react/jsx-runtime': require('../.expo/auth-test-tools/node_modules/react/jsx-runtime'),
      'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView', Platform: { OS: os, select: o => o[os] ?? o.default }, StyleSheet: { create: x => x }, useWindowDimensions: () => ({ width: 390, height: 800 }) },
      'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top, bottom: 0, left: 0, right: 0 }) },
      '@/src/presentation/contexts/AppThemeContext': { useAppTheme: () => ({ palette: { background: '#F7F3EA' } }) },
      'expo-router': { router: {} }, '@expo/vector-icons': { Ionicons: 'Icon' },
    });
    const { StatusBarScrim } = scrimLoad('src/ui/Screen.tsx');
    let scrim;await act(async () => { scrim = create(React.createElement(StatusBarScrim)); });
    const view = scrim.root.findAllByType('View')[0];
    if (expected === null) assert.equal(view, undefined, os + ' with top ' + top + ': no scrim');
    else { const style = Object.assign({}, ...view.props.style);assert.deepEqual([style.position, style.top, style.height, style.backgroundColor, view.props.pointerEvents], ['absolute', 0, expected, '#F7F3EA', 'none']); }
  }

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
  assert.equal(syncButton.props.accessibilityHint, 'Com o site aberto, a biblioteca busca mudanças sozinha a cada 90 segundos.');
  await act(async () => syncButton.props.onPress());assert.equal(pushed.at(-1), '/settings');
  await act(async () => tree.unmount());
  // 25/11/2026 (owner's screenshot): on the PC the reader opened two pages inside the 430 px phone frame. The frame is for non-PC windows only.
  assert.match(require('fs').readFileSync('app/_layout.tsx','utf8'), /usePhoneFrame = Platform\.OS === "web" && width > 480 && formFactor !== "desktop" && String\(segments\[0\]\) === 'reader'/);
  console.log('PASS desktop layout: Android status bar scrim (height of the bar, background colour, no touch; none on Web or without a bar); Study/Community columns (grid skips empty children, split aside 420 px, phone keeps one column); periodic web sync (90 s, visible and online only, stops); reader side sheets (contents left, others right, full height); reader keys (Space/PageDown/Shift+Space/PageUp, not while typing); Ctrl/Shift selection (range both ways, stale anchor), double click window, Cmd as Ctrl; PC only for Web + window >= 1024 + mouse (narrow PC window, touch tablet, phone site and Android keep the touch layout); sidebar with labelled sections, hidden Estudo, search to the catalog, honest sync status. Component test, not a browser capture.');
})().catch(error => { console.error(error); process.exitCode = 1; });
