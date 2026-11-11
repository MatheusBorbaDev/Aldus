// Onda A5: primeiro uso guiado. Cartão real com AsyncStorage controlado: aparece só sem registro, percorre os 3 passos,
// "Entendi"/"Pular" gravam e escondem; com registro ou leitura falha, não aparece.
const assert = require('node:assert/strict');
const React = require('../.expo/auth-test-tools/node_modules/react');
const { act, create } = require('../.expo/auth-test-tools/node_modules/react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const store = new Map(); let failRead = false;
const storage = { getItem: async key => { if (failRead) throw Error('read'); return store.get(key) ?? null; }, setItem: async (key, value) => { store.set(key, value); } };
const palette = { surface: '#fff', border: '#ddd', accent: '#a54', accentSoft: '#fde', separator: '#eee', text: '#111', secondaryText: '#555', onAccent: '#fff', danger: '#b00', success: '#070', panel: '#fff', surfaceSecondary: '#eee' };
const overridesRef = {
  react: React, 'react/jsx-runtime': require('../.expo/auth-test-tools/node_modules/react/jsx-runtime'),
  'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', ActivityIndicator: 'Spinner', ScrollView: 'ScrollView', Modal: 'Modal', TextInput: 'TextInput', Platform: { OS: 'android', select: o => o.android ?? o.default }, useWindowDimensions: () => ({ width: 390, height: 844 }), StyleSheet: { create: x => x, hairlineWidth: 1, absoluteFill: {} } },
  '@expo/vector-icons': { Ionicons: 'Icon' }, 'expo-router': { router: { back() {}, replace() {}, canGoBack: () => false } },
  'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
  '@react-native-async-storage/async-storage': { default: storage, ...storage },
  '@/src/presentation/contexts/AppThemeContext': { useAppTheme: () => ({ palette, resolvedTheme: 'light' }) },
};
const load = require('./community-test-loader.cjs')(overridesRef);
Object.defineProperty(overridesRef, '@/src/ui', { get: () => load('src/ui/index.ts') });
const { FirstStepsCard, FIRST_STEPS_KEY, FIRST_STEPS } = load('src/presentation/components/FirstStepsCard.tsx');
const text = node => typeof node === 'string' ? node : (node.children ?? []).map(text).join('');
const flush = () => act(async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); });
(async () => {
  assert.equal(FIRST_STEPS_KEY.startsWith('@kindle/'), true, 'legacy key prefix preserved'); assert.equal(FIRST_STEPS.length, 3);
  let tree; await act(async () => { tree = create(React.createElement(FirstStepsCard)); }); await flush();
  const press = async label => { const b = tree.root.findAllByType('Pressable').find(n => n.props.accessibilityLabel === label); assert.ok(b, 'missing ' + label); await act(async () => b.props.onPress()); await flush(); };
  assert.ok(text(tree.root).includes('Traga seus livros'), 'first step visible without a record');
  await press('Próximo'); assert.ok(text(tree.root).includes('Leia do seu jeito'));
  await press('Próximo'); assert.ok(text(tree.root).includes('Revise o que leu'));
  assert.equal(tree.root.findAllByType('Pressable').some(n => n.props.accessibilityLabel === 'Pular primeiros passos'), false, 'last step has no skip');
  await press('Entendi'); assert.equal(text(tree.root), '', 'hidden after Entendi'); assert.ok(store.has(FIRST_STEPS_KEY), 'dismissal recorded on this device');
  await act(async () => tree.unmount()); await act(async () => { tree = create(React.createElement(FirstStepsCard)); }); await flush();
  assert.equal(text(tree.root), '', 'not shown again'); await act(async () => tree.unmount());
  store.clear(); await act(async () => { tree = create(React.createElement(FirstStepsCard)); }); await flush(); await press('Pular primeiros passos');
  assert.ok(store.has(FIRST_STEPS_KEY), 'skip also records'); await act(async () => tree.unmount());
  store.clear(); failRead = true; await act(async () => { tree = create(React.createElement(FirstStepsCard)); }); await flush();
  assert.equal(text(tree.root), '', 'read failure: do not nag'); await act(async () => tree.unmount());
  console.log('PASS first steps: shown once per device, 3 steps, Entendi/Pular record and hide, hidden after read failure; legacy @kindle/ key prefix.');
})().catch(e => { console.error(e); process.exitCode = 1; });
