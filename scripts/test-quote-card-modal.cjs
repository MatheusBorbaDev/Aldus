// Quote card screen (phase C, 16/11/2026): real QuoteCardModal with the image generator and the share service replaced by
// controlled fakes. Proves choices reach the card spec, the 400-character rule, share results and accessible targets.
const assert = require('node:assert/strict');
const React = require('../.expo/auth-test-tools/node_modules/react');
const { act, create } = require('../.expo/auth-test-tools/node_modules/react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const specs = [], shares = []; let shareResult = 'shared';
function FakeCanvas({ spec, onImage }) {
  React.useEffect(() => { specs.push(spec); onImage(`data:image/jpeg;base64,${spec.width}x${spec.height}-${spec.background}-${spec.book ?? 'sem-livro'}-${spec.brand}`); }, [spec, onImage]);
  return null;
}
const load = require('./community-test-loader.cjs')({
  react: React, 'react/jsx-runtime': require('../.expo/auth-test-tools/node_modules/react/jsx-runtime'),
  'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView', Image: 'Image', Switch: 'Switch', Modal: ({ children }) => React.createElement('Modal', null, children), Platform: { OS: 'android' }, StyleSheet: { create: x => x } },
  '@/src/presentation/components/reader/QuoteCardCanvas': { QuoteCardCanvas: FakeCanvas },
  '@/src/presentation/services/shareQuoteCard': { shareQuoteCard: async (dataUrl, name) => { shares.push([dataUrl, name]); if (shareResult instanceof Error) throw shareResult; return shareResult; } },
});
const { QuoteCardModal } = load('src/presentation/components/reader/QuoteCardModal.tsx');
const { appPalettes } = load('src/theme/tokens.ts');
const palette = { background: '#F3E5C8', text: '#57463A', secondaryText: '#6E5A47', separator: '#D7C5A6', accent: '#8F4528', onAccent: '#FFFFFF', panel: '#F9EED9' };
const flat = style => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
(async () => {
  let closed = 0, tree;
  const render = quote => act(async () => { tree = create(React.createElement(QuoteCardModal, { quote, title: 'Memórias Póstumas', author: 'Machado de Assis', paletteName: 'petroleum', palette, onClose: () => closed++ })); });
  await render('Ao verme que primeiro roeu as frias carnes do meu cadáver.');
  const byLabel = label => tree.root.findAllByType('Pressable').find(p => p.props.accessibilityLabel === label);
  const text = () => tree.root.findAllByType('Text').map(t => t.children.filter(c => typeof c === 'string').join('')).join('\n');
  const image = () => tree.root.findByType('Image').props.source.uri;
  assert.equal(specs.at(-1).width, 1080); assert.equal(specs.at(-1).height, 1920, 'Stories 9:16 by default');
  assert.equal(specs.at(-1).grain, true, 'Papel by default'); assert.equal(specs.at(-1).book, 'Memórias Póstumas');
  assert.match(image(), /1080x1920/);
  assert.deepEqual(tree.root.findAllByType('Pressable').filter(p => p.props.accessibilityRole === 'radio').map(p => [p.props.accessibilityLabel, p.props.accessibilityState.checked]),
    [['Papel', true], ['Claro', false], ['Noite', false], ['Destaque', false], ['Stories 9:16', true], ['Post 4:5', false], ['Quadrado 1:1', false]]);
  await act(async () => byLabel('Noite').props.onPress());
  assert.equal(specs.at(-1).background, appPalettes.petroleum.dark.background, 'Noite follows the chosen palette'); assert.match(image(), new RegExp(appPalettes.petroleum.dark.background));
  await act(async () => byLabel('Quadrado 1:1').props.onPress());
  assert.equal(specs.at(-1).height, 1080); assert.equal(flat(tree.root.findAllByProps({ accessibilityLabel: 'Prévia do card: Ao verme que primeiro roeu as frias carnes do meu cadáver.' })[0].props.style).aspectRatio, 1);
  const switches = tree.root.findAllByType('Switch');
  await act(async () => switches.find(s => s.props.accessibilityLabel === 'Mostrar título e autor').props.onValueChange(false));
  assert.equal(specs.at(-1).book, null); assert.equal(specs.at(-1).author, null); assert.match(text(), /A imagem leva só este trecho\. O arquivo do livro nunca é enviado\./);
  await act(async () => switches.find(s => s.props.accessibilityLabel === 'Mostrar a marca Aldus').props.onValueChange(false));
  assert.equal(specs.at(-1).brand, false);
  await act(async () => byLabel('Compartilhar imagem').props.onPress());
  assert.deepEqual(shares.at(-1), [image(), 'aldus-trecho-square.jpg']);
  shareResult = 'downloaded'; await act(async () => byLabel('Compartilhar imagem').props.onPress()); assert.match(text(), /Imagem baixada/);
  shareResult = 'unavailable'; await act(async () => byLabel('Compartilhar imagem').props.onPress()); assert.match(text(), /não está disponível neste aparelho/);
  shareResult = Error('Sem espaço no aparelho.'); await act(async () => byLabel('Compartilhar imagem').props.onPress()); assert.match(text(), /Sem espaço no aparelho/);
  for (const p of tree.root.findAllByType('Pressable')) { assert.notEqual(typeof p.props.style, 'function', 'static Pressable style'); assert.ok(flat(p.props.style).minHeight >= 44, `${p.props.accessibilityLabel}: 44 px`); }
  await act(async () => byLabel('Fechar').props.onPress()); assert.equal(closed, 1);
  await act(async () => tree.unmount());
  // Over the owner's 400-character limit: explained, no image generated, nothing to share.
  const before = specs.length; await render('palavra '.repeat(60));
  assert.match(text(), /O card aceita até 400 caracteres \(este trecho tem 479\)/); assert.equal(byLabel('Compartilhar imagem'), undefined);
  assert.equal(tree.root.findAllByType(FakeCanvas).length, 0); assert.equal(specs.length, before, 'no card is drawn for an over-limit trecho');
  await act(async () => tree.unmount());
  console.log('PASS quote card screen: Papel + Stories by default, template/format/book/brand choices reach the spec, Noite follows the palette, share passes the image and file name, downloaded/unavailable/error messages, 400-character limit explained with nothing drawn, 44 px static targets. Image generator and share service are fakes; no Android share sheet proof.');
})().catch(error => { console.error(error); process.exitCode = 1; });
