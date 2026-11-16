// FASE 3, C: cartão de foco. Domínio (minutos medidos, estimativa só com ritmo medido e rotulada, título opcional) e o modal
// real (interruptores, prévia, texto compartilhado). Ligação com o hook e o Reader. Sem aparelho.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const React = require('../.expo/auth-test-tools/node_modules/react');
const { act, create } = require('../.expo/auth-test-tools/node_modules/react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;

const domainLoad = require('./community-test-loader.cjs')({ 'react-native': { Platform: { OS: 'android' } } });
const card = domainLoad('src/domain/reader/focusCard.ts');
const record = (seconds, reached = true) => ({ id: 's', bookId: 'b', format: 'epub', startedAt: 0, endedAt: seconds * 1000 + 1000, activeSeconds: seconds, focusGoalMinutes: 25, focusGoalReached: reached });

assert.equal(card.estimatedPages(1500, null), null, 'sem ritmo medido não há número');
assert.equal(card.estimatedPages(1500, 0), null);
assert.equal(card.estimatedPages(1500, 60), 25);
assert.equal(card.estimatedPages(20, 60), null, 'menos de 1 página não vira número');
let content = card.focusCardContent(record(1500), { title: 'Dom Casmurro', includeTitle: false, includeEstimate: true, secondsPerPage: 60 });
assert.deepEqual({ ...content }, { headline: '25 min de leitura com foco · meta cumprida', title: null, estimate: '≈ 25 páginas (estimativa pelo meu ritmo de leitura)', footer: 'Medido pelo Aldus: só tempo de leitura ativa.' });
content = card.focusCardContent(record(30, false), { title: 'Dom Casmurro', includeTitle: true, includeEstimate: false, secondsPerPage: 60 });
assert.equal(content.headline, 'Menos de 1 min de leitura com foco'); assert.equal(content.title, '«Dom Casmurro»'); assert.equal(content.estimate, null);
assert.equal(card.focusCardText(content), 'Menos de 1 min de leitura com foco\n«Dom Casmurro»\nMedido pelo Aldus: só tempo de leitura ativa.');
assert.equal(card.focusCardContent(record(120), { title: 'X', includeTitle: false, includeEstimate: true, secondsPerPage: 120 }).estimate, '≈ 1 página (estimativa pelo meu ritmo de leitura)');
assert.doesNotMatch(fs.readFileSync('src/domain/reader/focusCard.ts', 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''), /ranking|mais que|média dos leitores|outros leitores/i);

(async () => {
  let paceRaw = JSON.stringify([50, 60, 70, 60, 65]); const shared = [];
  const load = require('./community-test-loader.cjs')({
    react: React, 'react/jsx-runtime': require('../.expo/auth-test-tools/node_modules/react/jsx-runtime'),
    'react-native': { Modal: 'Modal', View: 'View', Text: 'Text', Pressable: 'Pressable', Switch: 'Switch', StyleSheet: { create: x => x, hairlineWidth: 1 } },
    '@react-native-async-storage/async-storage': { __esModule: true, default: { getItem: async () => paceRaw } },
    '@/src/presentation/hooks/useChapterTimeLeft': { READING_PACE_KEY: '@kindle/reading-pace.v1' },
    '@/src/theme/tokens': {},
  });
  const { FocusCardModal } = load('src/presentation/components/reader/FocusCardModal.tsx');
  const palette = { text: '#222', secondaryText: '#555', accent: '#a64e32', onAccent: '#fff', separator: '#ddd', panel: '#fff' };
  let tree; const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  const render = async props => { if (tree) await act(async () => tree.unmount()); await act(async () => { tree = create(React.createElement(FocusCardModal, { record: record(1500), title: 'Dom Casmurro', palette, onShare: text => shared.push(text), onClose() {}, ...props })); }); await flush(); };
  const text = () => tree.root.findAllByType('Text').map(n => [n.props.children].flat().join('')).join('\n');
  const toggle = label => tree.root.findAllByType('Switch').find(s => s.props.accessibilityLabel === label);
  await render({ hideCounts: false });
  assert.match(text(), /25 min de leitura com foco/); assert.match(text(), /≈ 25 páginas \(estimativa/); assert.ok(!text().includes('«Dom Casmurro»'), 'título começa desligado');
  await act(async () => toggle('Incluir o título do livro').props.onValueChange(true)); assert.match(text(), /«Dom Casmurro»/);
  await act(async () => toggle('Incluir estimativa de páginas').props.onValueChange(false)); assert.ok(!text().includes('≈'), 'estimativa oculta');
  await act(async () => tree.root.findAllByType('Pressable').find(p => p.props.accessibilityLabel === 'Compartilhar cartão').props.onPress());
  assert.equal(shared.at(-1), '25 min de leitura com foco · meta cumprida\n«Dom Casmurro»\nMedido pelo Aldus: só tempo de leitura ativa.');
  assert.doesNotMatch(shared.at(-1), /\.(epub|pdf)|https?:/, 'só texto, sem arquivo nem link');
  await render({ hideCounts: true }); assert.ok(!text().includes('≈'), 'números ocultos: estimativa começa desligada');
  paceRaw = JSON.stringify([60, 60]); await render({ hideCounts: false });
  assert.ok(!text().includes('≈'), 'ritmo com menos de 5 amostras: sem estimativa'); assert.equal(toggle('Incluir estimativa de páginas').props.disabled, true);
  assert.match(text(), /depois que o Aldus medir seu ritmo/);
  await act(async () => tree.unmount());

  const hook = fs.readFileSync('src/presentation/hooks/useReadingSession.ts', 'utf8');
  assert.match(hook, /if \(value && summaryEnabledRef\.current\) \{ setSummary\(focusSummaryText\(value\)\); setLastFocus\(value\); \}/, 'cartão só quando o resumo está ligado');
  const screen = fs.readFileSync('src/presentation/screens/ReaderScreen.tsx', 'utf8');
  assert.match(screen, /actionLabel=\{readingSession\.lastFocus \? "Ver cartão" : "Fechar"\}/);
  assert.match(screen, /\{focusCardVisible && readingSession\.lastFocus \? <FocusCardModal/, 'modal montado só quando aberto');
  console.log('PASS focus card: minutos medidos, estimativa de páginas só com ritmo medido (≥5 viradas) e rotulada, título opcional desligado, números ocultos respeitados, compartilha só texto; aberto pelo aviso de foco. Sem aparelho.');
})().catch(error => { console.error(error); process.exit(1); });
