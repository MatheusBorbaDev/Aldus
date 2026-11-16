// Real settings sheet (redesign step 1) with controlled platform boundaries; not physical Android proof.
// Quick controls (size, theme samples, brightness) + sections Texto/Página/Conforto. Navigation never writes preferences
// and never recreates controls; spacing defaults (BUG 15), 44px targets, no fixed white (BUG 16), zoom labels.
const fs = require('fs'), ts = require('typescript'), assert = require('node:assert/strict');
const React = require('../.expo/auth-test-tools/node_modules/react');
const { act, create } = require('../.expo/auth-test-tools/node_modules/react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const palette = { background: '#fafafa', text: '#222', secondaryText: '#555', accent: '#174', onAccent: '#fefefe', separator: '#ddd', panel: '#eee' };
const changes = []; const settings = { palette, saveError: null, hideReadingCounts: false, theme: 'paper', font: 'serif', fontSize: 20, lineHeight: 1.5, paragraphSpacing: .8, marginSize: 24, maxWidth: 900, brightness: 80, useSystemBrightness: true };
for (const key of ['HideReadingCounts', 'Theme', 'Font', 'FontSize', 'LineHeight', 'ParagraphSpacing', 'Margin', 'MaxWidth', 'Brightness', 'UseSystemBrightness', 'PaperTexture', 'PageTurn']) settings['set' + key] = value => changes.push([key, value]);
const themesMap = Object.fromEntries(['light', 'paper', 'sepia', 'dark', 'black'].map(k => [k, palette]));
const output = {}; const source = fs.readFileSync('src/presentation/components/ReaderSettingsPanel.tsx', 'utf8');
new Function('require', 'exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText)(name => {
  if (name === 'react') return React; if (name === 'react/jsx-runtime') return require('../.expo/auth-test-tools/node_modules/react/jsx-runtime');
  if (name === 'react-native') return { Modal: 'Modal', View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView', Switch: 'Switch', TextInput: 'TextInput', Platform: { OS: 'android' }, StyleSheet: { create: x => x, absoluteFill: {}, hairlineWidth: 1 } };
  if (name.includes('vector-icons')) return { Ionicons: 'Icon' };
  if (name.includes('ReaderSettingsContext')) return { useReaderSettings: () => settings, DEFAULT_READER_LINE_HEIGHT: 1.65, DEFAULT_READER_PARAGRAPH_SPACING: 1 };
  if (name.includes('pdfReader')) return { defaultPdfReaderSettings: { font: 'serif', fontSize: 18, lineHeight: 1.6, paragraphSpacing: 1, margin: 24, maxWidth: 760, alignment: 'left' } };
  if (name.includes('safe-area')) return { useSafeAreaInsets: () => ({ top: 24, bottom: 24 }) };
  if (name.includes('ReaderSettingsSlider')) return { ReaderSettingsSlider: 'Slider' };
  if (name.includes('MotionCuesControl')) return { MotionCuesControl: 'Motion' };
  if (name.includes('readerUiDiagnostics')) return { readerUiDiagnostic() {} };
  if (name.includes('reader/readingSession')) return { FOCUS_GOAL_MINUTES: [10, 15, 25, 45] };
  if (name.includes('reader/pageTurn')) return { PAGE_TURNS: [{ value: 'none', label: 'Sem animação' }, { value: 'slide', label: 'Deslizar' }, { value: 'flip', label: 'Folhear' }] };
  if (name.includes('reader/paperTexture')) return { PAPER_TEXTURES: [{ value: 'none', label: 'Sem textura' }, { value: 'paper', label: 'Papel' }, { value: 'aged', label: 'Papel envelhecido' }] };
  if (name.includes('/tokens')) return { pdfReaderThemes: themesMap, readerThemes: themesMap, fontFamilies: { serif: 'Georgia', sans: 'System', dyslexic: 'Verdana' } };
  return {};
}, output);
(async () => {
  let tree, closed = 0, focused = 0; const props = () => ({ visible: true, panelMode: 'appearance', onClose: () => closed++, onReadInFocus: () => focused++ });
  await act(async () => { tree = create(React.createElement(output.ReaderSettingsPanel, props())); });
  const byLabel = label => tree.root.findAllByType('Pressable').find(x => x.props.accessibilityLabel === label);
  const flat = style => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
  const scroll = tree.root.findByType('ScrollView'), slider = tree.root.findAllByType('Slider').find(x => x.props.accessibilityLabel === 'Tamanho da fonte');
  assert(slider, 'size slider is in the quick area'); assert.equal(byLabel('Expandir ajustes').props.accessibilityState.expanded, false, 'starts as a low sheet');
  assert.equal(flat(scroll.parent.props.style).maxHeight, '62%', 'collapsed sheet keeps the page visible');
  for (const label of ['Texto', 'Página', 'Conforto', 'Texto']) {
    const tab = byLabel('Mais ajustes: ' + label); assert(tab, label); await act(async () => tab.props.onPress());
    assert.equal(byLabel('Mais ajustes: ' + label).props.accessibilityState.selected, true); assert.ok(flat(tab.props.style).minHeight >= 44);
    assert.strictEqual(tree.root.findByType('ScrollView'), scroll); assert.strictEqual(tree.root.findAllByType('Slider').find(x => x.props.accessibilityLabel === 'Tamanho da fonte'), slider, 'controls are never recreated');
  }
  assert.equal(flat(scroll.parent.props.style).maxHeight, '90%'); assert.deepEqual(changes, [], 'Section navigation and expanding never write reader preferences');
  // Paper texture (16/11/2026): in Página, "Sem textura" selected by default; choosing one writes only that preference.
  assert.equal(byLabel('Sem textura').props.accessibilityState.selected, true);
  await act(async () => byLabel('Papel').props.onPress()); assert.deepEqual(changes.at(-1), ['PaperTexture', 'paper']);
  await act(async () => byLabel('Papel envelhecido').props.onPress()); assert.deepEqual(changes.at(-1), ['PaperTexture', 'aged']);
  // Page turn (16/11/2026): Deslizar selected by default (the behaviour so far); choosing writes only that preference.
  assert.equal(byLabel('Deslizar').props.accessibilityState.selected, true);
  await act(async () => byLabel('Folhear').props.onPress()); assert.deepEqual(changes.at(-1), ['PageTurn', 'flip']);
  await act(async () => byLabel('Sem animação').props.onPress()); assert.deepEqual(changes.at(-1), ['PageTurn', 'none']);
  changes.length = 0;
  // Quick controls.
  await act(async () => slider.props.onValueChange(24)); assert.deepEqual(changes, [['FontSize', 24]]);
  await act(async () => byLabel('Aumentar letra').props.onPress()); assert.deepEqual(changes.at(-1), ['FontSize', 21]);
  await act(async () => byLabel('Diminuir letra').props.onPress()); assert.deepEqual(changes.at(-1), ['FontSize', 19]);
  const swatches = tree.root.findAllByType('Pressable').filter(x => /^Tema [A-ZÉ]/.test(String(x.props.accessibilityLabel)));
  assert.deepEqual(swatches.map(x => x.props.accessibilityLabel), ['Tema Claro', 'Tema Papel', 'Tema Sépia', 'Tema Escuro', 'Tema Preto']);
  assert.deepEqual(swatches.map(x => x.props.accessibilityState.selected), [false, true, false, false, false]);
  await act(async () => swatches[3].props.onPress()); assert.deepEqual(changes.at(-1), ['Theme', 'dark']);
  // Wave A3: 'Automático' follows the app light/dark; choosing a swatch is explicit and the context turns auto off.
  const autoTheme = byLabel('Tema automático: seguir claro e escuro do app'); assert.equal(autoTheme.props.accessibilityState.checked, false);
  settings.setFollowAppTheme = value => changes.push(['FollowAppTheme', value]); await act(async () => autoTheme.props.onPress()); assert.deepEqual(changes.at(-1), ['FollowAppTheme', true]);
  assert.ok(!source.includes('Modo e-reader'), 'the redundant e-reader switch is gone; Papel stays a theme, saved values untouched');
  // Brightness: moving the slider leaves automatic mode first; the chip toggles it.
  const brightness = tree.root.findAllByType('Slider').find(x => x.props.accessibilityLabel === 'Brilho do leitor'); const before = changes.length;
  await act(async () => brightness.props.onValueChange(60)); assert.deepEqual(changes.slice(before), [['UseSystemBrightness', false], ['Brightness', 60]]);
  const auto = byLabel('Usar brilho do aparelho'); assert.equal(auto.props.accessibilityState.checked, true); await act(async () => auto.props.onPress()); assert.deepEqual(changes.at(-1), ['UseSystemBrightness', false]);
  const hide = tree.root.findAllByType('Switch').find(x => x.props.accessibilityLabel === 'Ocultar porcentagem e contagem de páginas'); await act(async () => hide.props.onValueChange(true)); assert.deepEqual(changes.at(-1), ['HideReadingCounts', true]);
  await act(async () => byLabel('Ler em foco').props.onPress()); assert.equal(focused, 1);
  // Fase 2: "Ler em foco por X min", encerrar com minutos ocultáveis, resumo desligável e Não perturbe só quando oferecido (Android).
  { const goals = [], summary = [], dnd = []; let ended = 0, focusTree;
    const focusProps = extra => ({ visible: true, panelMode: 'appearance', onClose() {}, onReadInFocus: minutes => goals.push(minutes), onEndFocus: () => ended++, focusSummaryEnabled: true, onFocusSummaryChange: value => summary.push(value), ...extra });
    await act(async () => { focusTree = create(React.createElement(output.ReaderSettingsPanel, focusProps({ focusMinutesLeft: null }))); });
    const fLabel = label => focusTree.root.findAllByType('Pressable').find(x => x.props.accessibilityLabel === label);
    for (const minutes of [10, 15, 25, 45]) { await act(async () => fLabel(`${minutes} min`).props.onPress()); }
    assert.deepEqual(goals, [10, 15, 25, 45]); assert.equal(fLabel('Abrir Não perturbe do Android'), undefined, 'sem atalho quando não oferecido (Web/iOS)');
    await act(async () => focusTree.root.findAllByType('Switch').find(x => x.props.accessibilityLabel === 'Mostrar resumo ao terminar o foco').props.onValueChange(false)); assert.deepEqual(summary, [false]);
    await act(async () => focusTree.update(React.createElement(output.ReaderSettingsPanel, focusProps({ focusMinutesLeft: 7, onOpenDoNotDisturb: () => dnd.push(1) }))));
    assert.equal(fLabel('10 min'), undefined, 'com foco em andamento não oferece outra meta');
    assert.ok(focusTree.root.findAllByType('Text').some(t => t.children.join('') === 'Encerrar foco (faltam 7 min)'));
    await act(async () => fLabel('Encerrar foco').props.onPress()); assert.equal(ended, 1);
    await act(async () => fLabel('Abrir Não perturbe do Android').props.onPress()); assert.deepEqual(dnd, [1]);
    settings.hideReadingCounts = true; await act(async () => focusTree.update(React.createElement(output.ReaderSettingsPanel, focusProps({ focusMinutesLeft: 7 }))));
    assert.ok(!focusTree.root.findAllByType('Text').some(t => /faltam/.test(t.children.join(''))), 'minutos de foco somem com "Ocultar porcentagem e páginas"');
    settings.hideReadingCounts = false; await act(async () => focusTree.unmount()); }
  const close = byLabel('Fechar ajustes de leitura'); assert(!close.parent.findAllByType('ScrollView').length, 'Close remains outside scroll content');
  // BUG 15: the saved legacy 1.5/0.8 are not options, so nothing is marked and nothing is rewritten.
  const segmentsFor = label => { const heading = tree.root.findAllByType('Text').find(t => t.children.join('') === label); return heading.parent.findAllByType('Pressable'); };
  assert.deepEqual(segmentsFor('Espaço entre linhas').map(x => x.props.accessibilityState.selected), [false, false, false], 'legacy 1.5 marks no option');
  settings.lineHeight = 1.65; settings.paragraphSpacing = 1; await act(async () => tree.update(React.createElement(output.ReaderSettingsPanel, props())));
  for (const [label, key, expected] of [['Espaço entre linhas', 'LineHeight', [1.4, 1.65, 1.9]], ['Espaço entre parágrafos', 'ParagraphSpacing', [0.5, 1, 1.5]]]) {
    const segments = segmentsFor(label); assert.deepEqual(segments.map(x => x.props.accessibilityState.selected), [false, true, false], label + ' default marked as Padrão');
    for (const [i, segment] of segments.entries()) { assert.ok(flat(segment.props.style).minHeight >= 44, label + ' 44px target'); await act(async () => segment.props.onPress()); assert.deepEqual(changes.at(-1), [key, expected[i]]); }
  }
  // Restore asks first and never touches theme/brightness/position.
  const beforeRestore = changes.length; await act(async () => byLabel('Restaurar texto e página padrão').props.onPress()); assert.equal(changes.length, beforeRestore, 'restore needs confirmation');
  await act(async () => byLabel('Confirmar: voltar ao padrão').props.onPress());
  assert.deepEqual(changes.slice(beforeRestore), [['Font', 'serif'], ['FontSize', 16], ['LineHeight', 1.65], ['ParagraphSpacing', 1], ['Margin', 'medium'], ['MaxWidth', 900]]);
  // Original PDF: file typography is preserved (no Texto section), zoom in the quick area.
  const pdfChanges = []; const pdf = { theme: 'paper', font: 'serif', fontSize: 18, lineHeight: 1.6, paragraphSpacing: 1, margin: 24, maxWidth: 760, alignment: 'left', zoom: 1, fitMode: 'page', layout: 'single', rotation: 0 };
  await act(async () => tree.update(React.createElement(output.ReaderSettingsPanel, { ...props(), pdfMode: 'original', pdfSettings: pdf, onPdfModeChange: () => {}, onPdfSettingsChange: next => pdfChanges.push(next) })));
  assert.equal(byLabel('Mais ajustes: Texto'), undefined); assert.equal(byLabel('Mais ajustes: Página').props.accessibilityState.selected, true, 'falls back to Página');
  await act(async () => byLabel('Aumentar zoom').props.onPress()); assert.equal(pdfChanges.at(-1).zoom, 1.25); assert.equal(byLabel('Diminuir zoom').props.accessibilityState.disabled, false);
  assert.match(source, /label="Diminuir zoom"/); assert.match(source, /label="Aumentar zoom"/); assert.doesNotMatch(source, /["']#fff(fff)?["']/i, 'colors follow the book theme, never fixed white');
  assert.doesNotMatch(source, /style=\{\(\{\s*pressed/, 'static Pressable styles only');
  await act(async () => close.props.onPress()); assert.equal(closed, 1);
  await act(async () => tree.unmount());
  console.log('PASS real settings sheet: low sheet + Texto/Página/Conforto with stable controls, no writes on navigation, steppers/slider/theme samples, brightness auto, restore with confirmation, spacing defaults (BUG 15), 44px targets, no e-reader switch, Original PDF without Texto. Controlled platform, not device proof.');
})().catch(e => { console.error(e); process.exitCode = 1; });
