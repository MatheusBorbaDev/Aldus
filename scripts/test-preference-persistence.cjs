// Quality wave 5 (R4): preference writes that used to fail silently. Checks the latest-write tracker, ReaderSettingsProvider and
// AppThemeProvider with a controlled AsyncStorage (react-test-renderer, stub RN): a failed write is reported and a later success
// clears it; a stale result cannot override the newest write; a failed READ never overwrites stored values with defaults.
// Statically checks that the PDF settings save in ReaderScreen is tracked and shown in the settings panel. No Android/device.
const assert = require('node:assert/strict'), fs = require('node:fs');
const React = require('../.expo/auth-test-tools/node_modules/react');
const { act, create } = require('../.expo/auth-test-tools/node_modules/react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const flush = () => act(async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); });

const storage = { getItem: null, setItem: null, writes: [] };
const asyncStorage = { getItem: key => storage.getItem(key), setItem: (key, value) => { storage.writes.push([key, value]); return storage.setItem(key, value); } };
const load = require('./community-test-loader.cjs')({
  react: React, 'react/jsx-runtime': require('../.expo/auth-test-tools/node_modules/react/jsx-runtime'),
  'react-native': { useColorScheme: () => 'light', Platform: { OS: 'android', select: o => o.android ?? o.default } },
  '@react-native-async-storage/async-storage': { default: asyncStorage, ...asyncStorage },
});

(async () => {
  // 1. Tracker: only the newest write decides.
  const { latestWriteTracker } = load('src/core/utils/latestWrite.ts');
  const results = []; const track = latestWriteTracker(failed => results.push(failed));
  let rejectOld; const old = new Promise((_, reject) => { rejectOld = reject; });
  track(old); track(Promise.resolve());
  await Promise.resolve(); await Promise.resolve(); rejectOld(Error('late')); await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(results, [false], 'a late failure of an older write does not flag the newest successful write');
  track(Promise.reject(Error('disk'))); await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(results, [false, true]);

  // 2. Reader settings.
  const reader = load('src/presentation/contexts/ReaderSettingsContext.tsx');
  let value; const ProbeReader = () => { value = reader.useReaderSettings(); return null; };
  const mount = async (Provider, Probe) => { let tree; await act(async () => { tree = create(React.createElement(Provider, null, React.createElement(Probe))); }); await flush(); return tree; };

  storage.writes = []; storage.getItem = async () => { throw Error('read failed'); }; storage.setItem = async () => undefined;
  let tree = await mount(reader.ReaderSettingsProvider, ProbeReader);
  assert.equal(storage.writes.length, 0, 'a failed read does not overwrite saved reader settings with defaults');
  await act(async () => value.setFontSize(20)); await flush();
  assert.equal(storage.writes.length, 1, 'a reader change is saved after a failed read');
  assert.equal(JSON.parse(storage.writes[0][1]).fontSize, 20); assert.equal(value.saveError, null);
  storage.setItem = async () => { throw Error('quota'); };
  await act(async () => value.setFontSize(21)); await flush();
  assert.equal(value.saveError, reader.READER_SETTINGS_SAVE_ERROR, 'failed save is exposed');
  assert.equal(value.fontSize, 21, 'the setting still applies in memory');
  storage.setItem = async () => undefined;
  await act(async () => value.setFontSize(22)); await flush();
  assert.equal(value.saveError, null, 'next successful save clears the notice');
  await act(async () => tree.unmount());

  storage.writes = []; storage.getItem = async () => JSON.stringify({ fontSize: 24, theme: 'dark' });
  tree = await mount(reader.ReaderSettingsProvider, ProbeReader);
  assert.equal(value.fontSize, 24); assert.equal(value.theme, 'dark');
  assert.ok(storage.writes.every(([, raw]) => JSON.parse(raw).fontSize === 24), 'a successful read never writes defaults');
  await act(async () => tree.unmount());

  // 3. App theme.
  const theme = load('src/presentation/contexts/AppThemeContext.tsx');
  let themeValue; const ProbeTheme = () => { themeValue = theme.useAppTheme(); return null; };
  storage.writes = []; storage.getItem = async () => { throw Error('read failed'); }; storage.setItem = async () => undefined;
  tree = await mount(theme.AppThemeProvider, ProbeTheme);
  assert.equal(storage.writes.length, 0, 'a failed read does not overwrite the saved theme with "system"');
  storage.setItem = async () => { throw Error('quota'); };
  await act(async () => themeValue.setMode('dark')); await flush();
  assert.deepEqual(storage.writes.at(-1), ['@kindle/appTheme', 'dark']);
  assert.equal(themeValue.saveError, theme.APP_THEME_SAVE_ERROR); assert.equal(themeValue.mode, 'dark');
  storage.setItem = async () => undefined;
  await act(async () => themeValue.setMode('light')); await flush();
  assert.equal(themeValue.saveError, null);
  await act(async () => tree.unmount());

  // 4. PDF settings (ReaderScreen is not mountable here: static contract).
  const screen = fs.readFileSync('src/presentation/screens/ReaderScreen.tsx', 'utf8'), panel = fs.readFileSync('src/presentation/components/ReaderSettingsPanel.tsx', 'utf8');
  assert.ok(!/pdfReaderSettings\.save\([^)]*\)\.catch\(\(\) => undefined\)/.test(screen), 'PDF settings save is no longer swallowed');
  assert.match(screen, /trackPdfSettingsSave\(appDependencies\.pdfReaderSettings\.save\(bookId, pdfReaderSettings\)\)/);
  assert.match(screen, /pdfSettingsSaveError=\{isPdf && pdfSettingsSaveFailedBookId === bookId \?/);
  assert.match(panel, /const saveError = pdfSettings \? pdfSettingsSaveError : settings\.saveError;/);
  assert.match(panel, /panelMode === "appearance" && saveError \? <View accessibilityRole="alert"/);
  assert.match(fs.readFileSync('app/preferences.tsx', 'utf8'), /saveError \? <Text accessibilityRole="alert"/);
  console.log('PASS preference persistence: latest-write tracker; reader settings and app theme report failed saves, clear on success, keep values in memory, never overwrite stored values after a failed read; PDF settings save tracked and shown in the panel (static).');
})().catch(error => { console.error(error); process.exitCode = 1; });
