// FASE 5b: marcos de leitura locais, "marco 2 de 3" e cronograma em texto. Domínio, armazenamento por conta e o modal real
// (react-test-renderer). Sem servidor, comentários, feed, chat ou ranking; o cronograma não leva progresso nem arquivo.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('../.expo/auth-test-tools/node_modules/react');
const { act, create } = require('../.expo/auth-test-tools/node_modules/react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;

function loader(mocks = {}) {
  const cache = new Map();
  return function load(file) {
    if (cache.has(file)) return cache.get(file);
    const exports = {}; cache.set(file, exports);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    new Function('require', 'exports', code)(name => {
      if (name in mocks) return mocks[name];
      if (name === 'react') return React;
      if (name === 'react/jsx-runtime') return require('../.expo/auth-test-tools/node_modules/react/jsx-runtime');
      const base = name.startsWith('@/') ? name.slice(2) : path.posix.join(path.posix.dirname(file), name);
      const target = ['.ts', '.tsx', ''].map(extension => base + extension).find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
      return target ? load(target) : require(name);
    }, exports);
    return exports;
  };
}

(async () => {
  const load = loader({
    'react-native': { Modal: 'Modal', View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView', StyleSheet: { create: x => x, hairlineWidth: 1 } },
    '@react-native-async-storage/async-storage': { __esModule: true, default: {} },
    '@/src/theme/tokens': {},
  });
  const d = load('src/domain/reader/readingMilestones.ts');

  // Domínio.
  const today = new Date(2026, 10, 11);
  const plan = d.createMilestonePlan(3, 30, today);
  assert.deepEqual(plan, { version: 1, count: 3, startDate: '2026-11-11', endDate: '2026-12-11' });
  assert.ok(d.isMilestonePlan(plan)); assert.ok(!d.isMilestonePlan({ ...plan, count: 7 })); assert.ok(!d.isMilestonePlan({ ...plan, endDate: '2026-11-01' }));
  assert.throws(() => d.createMilestonePlan(1, null, today), /2 a 6/);
  assert.deepEqual(d.milestoneDates(plan), ['2026-11-21', '2026-12-01', '2026-12-11']);
  assert.deepEqual(d.milestoneDates(d.createMilestonePlan(2, null, today)), [null, null]);
  assert.deepEqual(d.milestoneStatus(plan, 0), { reached: 0, next: 1, count: 3 });
  assert.equal(d.milestoneLabel(plan, 0.40), 'marco 2 de 3');
  assert.equal(d.milestoneLabel(plan, 2 / 3), 'marco 3 de 3', 'limite exato conta como alcançado');
  assert.equal(d.milestoneLabel(plan, 1), 'marcos concluídos');
  assert.equal(d.milestoneLabel(plan, Number.NaN), 'marco 1 de 3');
  const text = d.milestoneScheduleText(plan, 'Memórias Póstumas');
  assert.equal(text, 'Cronograma de leitura — «Memórias Póstumas»\nMarco 1 de 3: até 33% do livro · até 21/11\nMarco 2 de 3: até 67% do livro · até 01/12\nMarco 3 de 3: até 100% do livro · até 11/12\n' + d.MILESTONE_DRM_NOTICE);
  assert.doesNotMatch(text, /https?:|\.epub|\.pdf|ranking|lido por/i, 'só texto: sem link, arquivo ou comparação');
  assert.match(d.MILESTONE_DRM_NOTICE, /própria cópia.*DRM/);

  // Armazenamento por conta, remoção e histórico ilegível preservado.
  const { ReadingMilestoneStore, readingMilestonesKey } = load('src/data/local/ReadingMilestoneStore.ts');
  const kv = new Map(); const store = new ReadingMilestoneStore({ getItem: async k => kv.get(k) ?? null, setItem: async (k, v) => { kv.set(k, v); } });
  await store.set('A', 'book-1', plan);
  assert.deepEqual(await store.get('A', 'book-1'), plan); assert.equal(await store.get('B', 'book-1'), null, 'conta B não vê os marcos de A');
  await store.set('A', 'book-1', null); assert.equal(await store.get('A', 'book-1'), null);
  await assert.rejects(store.set('A', 'book-1', { ...plan, count: 9 }), /inválidos/);
  kv.set(readingMilestonesKey('C'), '{x'); await assert.rejects(store.set('C', 'b', plan), /ilegíveis/); assert.equal(kv.get(readingMilestonesKey('C')), '{x');

  // Modal real.
  const { ReadingMilestonesModal } = load('src/presentation/components/reader/ReadingMilestonesModal.tsx');
  const palette = { text: '#222', secondaryText: '#555', accent: '#a64e32', separator: '#ddd', panel: '#fff' };
  const saved = [], shared = [];
  const props = extra => ({ visible: true, title: 'Livro', plan: null, progress: 0.4, hideCounts: false, palette, onSave: p => saved.push(p), onShare: p => shared.push(p), onClose() {}, ...extra });
  let tree; await act(async () => { tree = create(React.createElement(ReadingMilestonesModal, props())); });
  const press = async label => { const b = tree.root.findAllByType('Pressable').find(x => x.props.accessibilityLabel === label); assert.ok(b, label); await act(async () => b.props.onPress()); };
  const texts = () => tree.root.findAllByType('Text').map(t => [t.props.children].flat().join(''));
  assert.ok(!texts().some(t => /Compartilhar|Remover/.test(t)), 'sem plano: só criar');
  await press('4 marcos'); await press('Sem prazo'); await press('Salvar marcos');
  assert.equal(saved.at(-1).count, 4); assert.equal(saved.at(-1).endDate, null);
  await act(async () => tree.update(React.createElement(ReadingMilestonesModal, props({ plan }))));
  assert.ok(texts().includes('Agora: marco 2 de 3.'));
  assert.ok(texts().some(t => t.startsWith('Marco 1: até 33% do livro · até 21/11')), 'prazo salvo é mantido');
  await press('Compartilhar cronograma'); assert.deepEqual(shared, [plan]);
  await press('6 marcos'); await press('Salvar marcos'); assert.deepEqual({ ...saved.at(-1) }, { ...plan, count: 6 }, 'mudar a quantidade mantém início e prazo');
  await press('Remover marcos'); assert.equal(saved.at(-1), null);
  await act(async () => tree.update(React.createElement(ReadingMilestonesModal, props({ plan, hideCounts: true }))));
  assert.ok(!texts().some(t => /^Agora: marco/.test(t)), '"Ocultar porcentagem e páginas" esconde o marco atual');
  for (const b of tree.root.findAllByType('Pressable')) assert.ok(b.props.style.flat(Infinity).filter(Boolean).reduce((a, s) => Object.assign(a, s), {}).minHeight >= 44, 'alvos de 44 px');

  // Reader: rótulo no rodapé com as contagens; botão na aba Conforto; compartilhamento só em texto.
  const screen = fs.readFileSync('src/presentation/screens/ReaderScreen.tsx', 'utf8');
  assert.match(screen, /timeLeftLabel: \[timeLeftLabel, focusLabel, milestoneText\]/);
  assert.match(screen, /Share\.share\(\{ message: milestoneScheduleText\(plan, bookTitle\) \}\)/);
  assert.match(fs.readFileSync('src/presentation/components/ReaderSettingsPanel.tsx', 'utf8'), /label="Marcos de leitura"/);
  console.log('PASS reading milestones: 2–6 marcos, prazo opcional, "marco N de M" pelo progresso, cronograma só em texto com aviso de DRM, por conta, ocultável, alvos de 44 px. Sem aparelho.');
})().catch(error => { console.error(error); process.exit(1); });
