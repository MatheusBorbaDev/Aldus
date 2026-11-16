// Onda A3: tema do livro "Automático" (segue o claro/escuro do app). Regra pura + ReaderSettingsProvider real com AsyncStorage
// controlado: preferência salva, tema escolhido preservado, troca do app reflete no livro, escolher tema desliga o automático.
const assert = require('node:assert/strict');
const React = require('../.expo/auth-test-tools/node_modules/react');
const { act, create } = require('../.expo/auth-test-tools/node_modules/react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
let appTheme = 'light', appPalette = null; const writes = []; let stored = null;
const storage = { getItem: async () => stored, setItem: async (_key, value) => { writes.push(JSON.parse(value)); } };
const load = require('./community-test-loader.cjs')({
  react: React, 'react/jsx-runtime': require('../.expo/auth-test-tools/node_modules/react/jsx-runtime'),
  '@react-native-async-storage/async-storage': { default: storage, ...storage },
  '@/src/presentation/contexts/AppThemeContext': { useResolvedAppTheme: () => appTheme, useAppPaletteName: () => appPalette },
});
const { resolveReaderTheme } = load('src/domain/reader/readerThemeAuto.ts');
// Rule.
assert.equal(resolveReaderTheme('sepia', false, 'dark'), 'sepia', 'off: chosen theme');
assert.equal(resolveReaderTheme('sepia', true, null), 'sepia', 'unknown app theme: chosen theme');
assert.equal(resolveReaderTheme('sepia', true, 'dark'), 'dark'); assert.equal(resolveReaderTheme('black', true, 'dark'), 'black', 'keeps a dark choice');
assert.equal(resolveReaderTheme('sepia', true, 'light'), 'sepia', 'keeps a light choice'); assert.equal(resolveReaderTheme('dark', true, 'light'), 'paper');
// Provider.
const { ReaderSettingsProvider, useReaderSettings } = load('src/presentation/contexts/ReaderSettingsContext.tsx');
let value; const Probe = () => { value = useReaderSettings(); return null; };
const flush = () => act(async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); });
(async () => {
  stored = JSON.stringify({ theme: 'sepia' });
  let tree; await act(async () => { tree = create(React.createElement(ReaderSettingsProvider, null, React.createElement(Probe))); }); await flush();
  assert.equal(value.followAppTheme, false, 'off by default: nobody’s reading changes'); assert.equal(value.theme, 'sepia');
  await act(async () => value.setFollowAppTheme(true)); await flush();
  assert.equal(value.theme, 'sepia', 'light app keeps the light choice'); assert.equal(writes.at(-1).followAppTheme, true); assert.equal(writes.at(-1).theme, 'sepia', 'chosen theme is what is saved');
  appTheme = 'dark'; await act(async () => tree.update(React.createElement(ReaderSettingsProvider, null, React.createElement(Probe)))); await flush();
  assert.equal(value.theme, 'dark'); assert.equal(value.selectedTheme, 'sepia'); assert.equal(value.palette.background, load('src/theme/tokens.ts').readerThemes.dark.background);
  assert.equal(value.resolveTheme('paper'), 'dark', 'the same rule is available for PDF settings');
  await act(async () => value.setTheme('paper')); await flush();
  assert.equal(value.followAppTheme, false, 'choosing a theme is explicit and turns automatic off'); assert.equal(value.theme, 'paper');
  stored = JSON.stringify({ theme: 'light', followAppTheme: true }); appTheme = 'dark';
  await act(async () => tree.unmount()); await act(async () => { tree = create(React.createElement(ReaderSettingsProvider, null, React.createElement(Probe))); }); await flush();
  assert.equal(value.followAppTheme, true, 'saved preference is restored'); assert.equal(value.theme, 'dark');
  // App palette (16/11/2026): Reader controls take the palette accent; the book page keeps its own colors.
  const tokens = load('src/theme/tokens.ts'), before = value.palette; appPalette = 'petroleum';
  await act(async () => tree.update(React.createElement(ReaderSettingsProvider, null, React.createElement(Probe)))); await flush();
  assert.equal(value.palette.accent, tokens.appPalettes.petroleum.dark.accent, 'dark book theme takes the dark palette accent');
  for (const key of ['background', 'text', 'secondaryText', 'panel']) assert.equal(value.palette[key], before[key], `book ${key} unchanged`);
  assert.equal(value.theme, 'dark', 'the palette does not change the book theme');
  // Paper texture (16/11/2026): saved with the reading settings; unknown stored values fall back to no texture.
  assert.equal(value.paperTexture, 'none', 'no texture by default');
  await act(async () => value.setPaperTexture('aged')); await flush();
  assert.equal(value.paperTexture, 'aged'); assert.equal(writes.at(-1).paperTexture, 'aged', 'choice is saved');
  await act(async () => value.setPaperTexture('linen')); await flush();
  assert.equal(value.paperTexture, 'aged', 'unknown texture names are ignored');
  stored = JSON.stringify({ theme: 'sepia', paperTexture: 'linen' });
  await act(async () => tree.unmount()); await act(async () => { tree = create(React.createElement(ReaderSettingsProvider, null, React.createElement(Probe))); }); await flush();
  assert.equal(value.paperTexture, 'none', 'an unreadable stored texture falls back to none');
  // Page turn (16/11/2026): Deslizar by default, saved with the reading settings, unknown values ignored.
  assert.equal(value.pageTurn, 'slide');
  await act(async () => value.setPageTurn('flip')); await flush(); assert.equal(writes.at(-1).pageTurn, 'flip');
  await act(async () => value.setPageTurn('curl')); await flush(); assert.equal(value.pageTurn, 'flip', 'unknown page turn ignored');
  // Reading flow (16/11/2026): pages by default, saved with the reading settings, unknown values ignored.
  assert.equal(value.readingFlow, 'paged');
  await act(async () => value.setReadingFlow('scroll')); await flush(); assert.equal(writes.at(-1).readingFlow, 'scroll');
  await act(async () => value.setReadingFlow('sideways')); await flush(); assert.equal(value.readingFlow, 'scroll', 'unknown flow ignored');
  await act(async () => tree.unmount());
  console.log('PASS reader theme auto: rule (off/unknown/dark/light), off by default, chosen theme saved and restored, app dark → book dark, explicit choice turns it off, rule shared with PDF; app palette changes only the controls accent; paper texture saved and validated.');
})().catch(e => { console.error(e); process.exitCode = 1; });
