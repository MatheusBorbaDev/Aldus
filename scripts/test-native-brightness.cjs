// Onda B1: brilho do Reader extraído do ReaderScreen (useNativeReaderBrightness). Hook real com expo-brightness e AppState
// controlados: aplica com o automático desligado, restaura ao religar, ao ir para segundo plano e ao sair; nada na Web.
const assert = require('node:assert/strict');
const React = require('../.expo/auth-test-tools/node_modules/react');
const { act, create } = require('../.expo/auth-test-tools/node_modules/react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const calls = []; let listener = null; const platform = { OS: 'android' };
const brightness = {
  isAvailableAsync: async () => true, getBrightnessAsync: async () => { calls.push('get'); return 0.7; },
  setBrightnessAsync: async value => { calls.push(['set', value]); }, restoreSystemBrightnessAsync: async () => { calls.push('restore'); },
};
const load = require('./community-test-loader.cjs')({
  react: React, 'expo-brightness': brightness,
  'react-native': { Platform: platform, AppState: { addEventListener: (_event, fn) => { listener = fn; return { remove: () => { listener = null; } }; } } },
});
const { useNativeReaderBrightness } = load('src/presentation/hooks/useNativeReaderBrightness.ts');
const flush = () => act(async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); });
function Probe(props) { useNativeReaderBrightness(props); return null; }
(async () => {
  let tree; const render = async props => { await act(async () => { tree ? tree.update(React.createElement(Probe, props)) : tree = create(React.createElement(Probe, props)); }); await flush(); };
  await render({ bookId: 'b', ready: false, brightness: 50, useSystemBrightness: false });
  assert.deepEqual(calls, [], 'nothing before the book is ready');
  await render({ bookId: 'b', ready: true, brightness: 50, useSystemBrightness: false });
  assert.deepEqual(calls.slice(-2), ['get', ['set', 0.5]], 'saves the system level once, then applies the reader level');
  await render({ bookId: 'b', ready: true, brightness: 10, useSystemBrightness: false });
  assert.deepEqual(calls.slice(-3), ['restore', 'get', ['set', 0.2]], 'a change restores the system level, rereads it and applies the new level (clamped to 20%), as before the extraction');
  await act(async () => listener('background')); await flush(); assert.equal(calls.at(-1), 'restore', 'restores in background');
  await act(async () => listener('active')); await flush(); assert.deepEqual(calls.at(-1), ['set', 0.2], 'reapplies when active again');
  await render({ bookId: 'b', ready: true, brightness: 10, useSystemBrightness: true }); assert.equal(calls.at(-1), 'restore', 'turning automatic on restores');
  await render({ bookId: 'b', ready: true, brightness: 60, useSystemBrightness: false });
  await act(async () => tree.unmount()); await flush(); assert.equal(calls.at(-1), 'restore', 'leaving the reader restores'); assert.equal(listener, null, 'listener removed');
  calls.length = 0; platform.OS = 'web'; tree = null; await render({ bookId: 'w', ready: true, brightness: 40, useSystemBrightness: false });
  assert.deepEqual(calls, [], 'Web never touches device brightness'); await act(async () => tree.unmount());
  console.log('PASS native reader brightness (extracted hook): apply when ready, restore-reread-apply on change, 20% floor, background/active, automatic restores, unmount restores, Web untouched.');
})().catch(e => { console.error(e); process.exitCode = 1; });
