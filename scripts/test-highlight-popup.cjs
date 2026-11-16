// Phase B (16/11/2026): highlight pop-up, highlight record creation and press-and-hold coordinates. Real components with
// react-test-renderer and a stub React Native; the document side is covered by test:reader:browser. Not an Android touch test.
const assert = require('node:assert/strict');
const React = require('../.expo/auth-test-tools/node_modules/react');
const { act, create } = require('../.expo/auth-test-tools/node_modules/react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const names = { yellow: 'Amarelo', green: 'Verde', blue: 'Azul', pink: 'Rosa', purple: 'Roxo' };
const load = require('./community-test-loader.cjs')({
  react: React, 'react/jsx-runtime': require('../.expo/auth-test-tools/node_modules/react/jsx-runtime'),
  'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', Platform: { OS: 'android' }, StyleSheet: { create: x => x } },
  '@/src/presentation/components/StudyPanelControls': { studyColorNames: names, studyColorSwatches: { yellow: '#F2D66F', green: '#A6D8AF', blue: '#A5CEEF', pink: '#F0B7CE', purple: '#C7B6E6' } },
  '@/src/utils/epubOpenMetrics': { epubDiagnosticConsole: { log() {} } },
});
const palette = { background: '#F3E5C8', text: '#57463A', secondaryText: '#6E5A47', separator: '#D7C5A6', accent: '#8F4528', onAccent: '#FFFFFF', panel: '#F9EED9' };
const flat = style => Object.assign({}, ...[typeof style === 'function' ? style({ pressed: false }) : style].flat(Infinity).filter(Boolean));
const anchor = { version: 1, kind: 'epub-text', chapterId: 'c1', start: 10, end: 22, quote: 'frias carnes', prefix: 'roeu as ', suffix: ' do meu', path: [0, 1] };

(async () => {
  // 1. Record creation shared by the pop-up.
  const { createStudyHighlight, readHighlightLocation } = load('src/domain/usecases/StudyHighlights.ts');
  const record = createStudyHighlight({ bookId: 'b1', anchor, chapterTitle: 'Capítulo I', color: 'blue', note: '  lembrar  ', now: 1700, id: 'h1' });
  assert.deepEqual({ ...record, startCfi: undefined, endCfi: undefined }, { id: 'h1', bookId: 'b1', chapterId: 'c1', startCfi: undefined, endCfi: undefined, highlightedText: 'frias carnes', colorLabel: 'blue', createdAt: 1700, pinned: false });
  assert.equal(record.startCfi, record.endCfi);
  const location = readHighlightLocation(record);
  assert.deepEqual(location.anchor, anchor, 'the stored anchor reads back exactly'); assert.equal(location.note, 'lembrar'); assert.equal(location.chapterTitle, 'Capítulo I');
  assert.throws(() => createStudyHighlight({ bookId: 'b1', anchor, chapterTitle: '', color: 'blue', note: 'x'.repeat(100001) }), /100 mil/);
  assert.match(createStudyHighlight({ bookId: 'b1', anchor, chapterTitle: '', color: 'yellow', now: 5 }).id, /^highlight-5-/);

  // 2. Pop-up.
  const { HighlightSelectionPopup } = load('src/presentation/components/reader/HighlightSelectionPopup.tsx');
  const calls = [];
  const props = extra => ({ quote: anchor.quote, error: null, busy: false, palette, bottom: 24, onColor: c => calls.push(['color', c]), onAdjust: o => calls.push(['adjust', o]), onNote: () => calls.push(['note']), onCancel: () => calls.push(['cancel']), ...extra });
  let tree; await act(async () => { tree = create(React.createElement(HighlightSelectionPopup, props())); });
  const buttons = () => tree.root.findAllByType('Pressable');
  const byLabel = label => buttons().find(b => b.props.accessibilityLabel === label);
  const text = () => tree.root.findAllByType('Text').map(t => t.children.filter(c => typeof c === 'string').join('')).join('\n');
  assert.match(text(), /“frias carnes”/);
  assert.deepEqual(buttons().map(b => b.props.accessibilityLabel), ['Grifar em amarelo', 'Grifar em verde', 'Grifar em azul', 'Grifar em rosa', 'Grifar em roxo', 'Palavra antes', 'Palavra depois', 'Tirar a última', 'Frase inteira', 'Adicionar nota', 'Cancelar']);
  for (const b of buttons()) { const s = flat(b.props.style); assert.ok((s.minHeight ?? s.height) >= 44, `${b.props.accessibilityLabel}: 44 px target`); assert.equal(b.props.accessibilityRole, 'button'); }
  await act(async () => byLabel('Grifar em verde').props.onPress()); await act(async () => byLabel('Frase inteira').props.onPress());
  await act(async () => byLabel('Adicionar nota').props.onPress()); await act(async () => byLabel('Cancelar').props.onPress());
  assert.deepEqual(calls, [['color', 'green'], ['adjust', 'sentence'], ['note'], ['cancel']]);
  await act(async () => tree.update(React.createElement(HighlightSelectionPopup, props({ onShare: () => calls.push(['share']) }))));
  assert.deepEqual(buttons().slice(-3).map(b => b.props.accessibilityLabel), ['Adicionar nota', 'Compartilhar', 'Cancelar'], 'quote card entry (phase C)');
  await act(async () => byLabel('Compartilhar').props.onPress()); assert.deepEqual(calls.at(-1), ['share']);
  await act(async () => tree.update(React.createElement(HighlightSelectionPopup, props({ busy: true }))));
  assert.ok(buttons().filter(b => b.props.accessibilityLabel !== 'Cancelar').every(b => b.props.disabled), 'busy disables saving and adjusting');
  assert.equal(byLabel('Cancelar').props.disabled, false, 'cancel always works');
  await act(async () => tree.update(React.createElement(HighlightSelectionPopup, props({ quote: null, busy: true }))));
  assert.match(text(), /Selecionando…/); assert.deepEqual(buttons().map(b => b.props.accessibilityLabel), ['Fechar']);
  await act(async () => tree.update(React.createElement(HighlightSelectionPopup, props({ quote: null, error: 'Pressione sobre uma palavra do texto.' }))));
  assert.equal(tree.root.findAllByType('Text').find(t => t.props.accessibilityRole === 'alert').children.join(''), 'Pressione sobre uma palavra do texto.');
  await act(async () => tree.update(React.createElement(HighlightSelectionPopup, props({ error: 'Disco cheio.' }))));
  assert.match(text(), /frias carnes/); assert.match(text(), /Disco cheio/, 'a save error keeps the trecho visible');
  await act(async () => tree.unmount());

  // 3. Press-and-hold maps zone coordinates to the book page (same container as the WebView).
  const { ReadingTouchZones } = load('src/presentation/components/reader/ReadingTouchZones.tsx');
  const points = [];
  await act(async () => { tree = create(React.createElement(ReadingTouchZones, { onPreviousPage() {}, onNextPage() {}, onToggleControls() {}, onLongPressText: (x, y) => points.push([x, y]) })); });
  const overlay = tree.root.findAllByType('View')[0];
  await act(async () => overlay.props.onLayout({ nativeEvent: { layout: { x: 0, y: 160, width: 400, height: 480 } } }));
  const zones = tree.root.findAllByType('Pressable');
  await act(async () => zones[0].props.onLongPress({ nativeEvent: { locationX: 20, locationY: 30 } }));
  await act(async () => zones[1].props.onLongPress({ nativeEvent: { locationX: 50, locationY: 100 } }));
  await act(async () => zones[2].props.onLongPress({ nativeEvent: { locationX: 10, locationY: 5 } }));
  assert.deepEqual(points, [[20, 190], [170, 260], [290, 165]]);
  await act(async () => tree.update(React.createElement(ReadingTouchZones, { onPreviousPage() {}, onNextPage() {}, onToggleControls() {} })));
  assert.ok(tree.root.findAllByType('Pressable').every(z => z.props.onLongPress === undefined), 'no long press when the reader does not support highlights');
  await act(async () => tree.unmount());
  console.log('PASS highlight pop-up: record creation (anchor round trip, note limit), 5 colors + 4 adjustments + note/cancel with 44 px targets, busy/selecting/error states keep the trecho, press-and-hold coordinates per zone, no long press without support. Controlled components; no Android touch proof.');
})().catch(error => { console.error(error); process.exitCode = 1; });
