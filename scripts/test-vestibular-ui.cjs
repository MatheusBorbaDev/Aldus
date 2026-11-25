// Tela "Leituras de vestibular" (25/11/2026): componente real com React Native e serviço simulados.
const assert = require('node:assert/strict');
const React = require('../.expo/auth-test-tools/node_modules/react');
const { act, create } = require('../.expo/auth-test-tools/node_modules/react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const routes = [], opened = []; let readResult, choice = 'unicamp', saved = [], suggestions = [], suggestError = null;
const El = name => ({ children, ...props }) => React.createElement(name, props, children);
const palette = { text: '#111', border: '#ddd', surface: '#fff', input: '#fff' };
const ui = {
  AppText: El('Text'), Button: ({ label, onPress, disabled }) => React.createElement('Button', { label, onPress, disabled }),
  Chip: ({ label, selected, onPress }) => React.createElement('Chip', { label, selected, onPress }), ChipRow: El('ChipRow'),
  EmptyState: ({ title, description }) => React.createElement('Text', null, title + ' ' + description), Screen: ({ header, children }) => React.createElement('Screen', null, header, children),
  ScreenHeader: ({ title }) => React.createElement('Text', null, title), Section: ({ title, children }) => React.createElement('Section', { title }, React.createElement('Text', null, title), children),
};
const { VestibularSuggestionError } = require('./community-test-loader.cjs')({})('src/data/study/VestibularReadingsService.ts');
const load = require('./community-test-loader.cjs')({
  react: React, 'react/jsx-runtime': require('../.expo/auth-test-tools/node_modules/react/jsx-runtime'),
  'react-native': { View: 'View', Pressable: 'Pressable', TextInput: 'TextInput', StyleSheet: { create: x => x }, Linking: { openURL: async u => opened.push(u) } },
  'expo-router': { router: { push: target => routes.push(target) } },
  '@/src/presentation/components/AuthGuard': { AuthGuard: ({ children }) => children },
  '@/src/presentation/contexts/AppThemeContext': { useAppTheme: () => ({ palette }) },
  '@/src/ui': ui,
  '@/src/data/study/vestibularDependencies': { vestibularReadings: {
    read: async () => readResult, readChoice: async () => choice, saveChoice: async id => saved.push(id),
    suggest: async input => { if (suggestError) throw new VestibularSuggestionError(suggestError); suggestions.push(input); },
  } },
  '@/src/data/study/VestibularReadingsService': { VestibularSuggestionError },
});
const Screen = load('app/vestibular.tsx').default;
const raw = node => typeof node === 'string' ? node : (node.children ?? []).map(raw).join(' '); const text = node => raw(node).replace(/\s+/g, ' ');
const flush = () => act(async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); });
const year = new Date().getFullYear();
const list = (id, y, titles) => ({ vestibularId: id, examYear: y, sourceUrl: `https://oficial.example/${id}-${y}`, books: titles.map((t, i) => ({ position: i + 1, title: t, author: 'Autor ' + i, note: null })) });
const snapshot = { savedAt: '2026-11-20T10:00:00.000Z', vestibulares: [
  { id: 'fuvest', name: 'Fuvest', institution: 'USP', officialUrl: null }, { id: 'unicamp', name: 'Unicamp', institution: 'Unicamp', officialUrl: null }],
  lists: [list('unicamp', year + 1, ['Iracema', 'Dom Casmurro']), list('unicamp', year - 1, ['O cortiço']), list('unicamp', year - 2, ['Quincas Borba']), list('fuvest', year - 1, ['Memórias póstumas'])] };
(async () => {
  readResult = { source: 'server', snapshot };
  let tree; await act(async () => { tree = create(React.createElement(Screen)); }); await flush();
  let shown = text(tree.toJSON());
  // The saved choice opens first; upcoming list in full; past lists collapsed, newest first.
  assert.ok(tree.root.findAllByType('Chip').find(c => c.props.label === 'Unicamp').props.selected, 'saved choice');
  assert.ok(shown.includes(`Unicamp ${year + 1}`) && shown.includes('Iracema') && shown.includes('Dom Casmurro'));
  assert.ok(!shown.includes('ainda não foi publicada'), 'target year published');
  assert.ok(shown.indexOf(`Unicamp ${year - 1}`) < shown.indexOf(`Unicamp ${year - 2}`), 'past newest first');
  assert.ok(!shown.includes('O cortiço'), 'past lists start collapsed');
  // Each book searches Descobrir; the source opens the official edital.
  const book = tree.root.findAllByType('Pressable').find(p => p.props.accessibilityLabel?.startsWith('Iracema'));
  await act(async () => book.props.onPress()); assert.deepEqual(routes.at(-1), { pathname: '/catalog', params: { q: 'Iracema Autor 0' } });
  const source = tree.root.findAllByType('Pressable').find(p => p.props.accessibilityRole === 'link');
  await act(async () => source.props.onPress()); assert.equal(opened.at(-1), `https://oficial.example/unicamp-${year + 1}`);
  // Opening a past list shows it.
  const past = tree.root.findAllByType('Pressable').find(p => p.props.accessibilityState && text(p).includes(`Unicamp ${year - 1}`));
  await act(async () => past.props.onPress()); assert.ok(text(tree.toJSON()).includes('O cortiço'));
  // Switching vestibular saves the choice; Fuvest has no list for the target year: said, not invented.
  await act(async () => tree.root.findAllByType('Chip').find(c => c.props.label === 'Fuvest').props.onPress()); await flush();
  shown = text(tree.toJSON()); assert.deepEqual(saved, ['fuvest']);
  assert.ok(shown.includes(`A lista do Fuvest ${year + 1} ainda não foi publicada`)); assert.ok(!shown.includes('Iracema'));
  // Suggestion: sent with the chosen vestibular; readable error otherwise.
  await act(async () => tree.root.findAllByType('Button').find(b => b.props.label === 'Sugerir').props.onPress());
  await act(async () => tree.root.findByType('TextInput').props.onChangeText('Faltou a UERJ'));
  await act(async () => tree.root.findAllByType('Button').find(b => b.props.label === 'Enviar sugestão').props.onPress()); await flush();
  assert.deepEqual(suggestions, [{ vestibularId: 'fuvest', message: 'Faltou a UERJ' }]); assert.ok(text(tree.toJSON()).includes('Obrigado!'));
  suggestError = 'Você já enviou 5 sugestões hoje. Tente de novo amanhã.';
  await act(async () => tree.root.findByType('TextInput').props.onChangeText('Outra sugestão'));
  await act(async () => tree.root.findAllByType('Button').find(b => b.props.label === 'Enviar sugestão').props.onPress()); await flush();
  assert.ok(text(tree.toJSON()).includes('5 sugestões hoje'));
  await act(async () => tree.unmount());
  // Offline copy says so with its date; nothing at all offers a retry.
  readResult = { source: 'copy', snapshot }; await act(async () => { tree = create(React.createElement(Screen)); }); await flush();
  assert.ok(text(tree.toJSON()).includes('Sem conexão: mostrando a cópia salva em 20/11/2026')); await act(async () => tree.unmount());
  readResult = { source: 'unavailable', snapshot: null }; await act(async () => { tree = create(React.createElement(Screen)); }); await flush();
  assert.ok(text(tree.toJSON()).includes('Listas indisponíveis')); assert.ok(tree.root.findAllByType('Button').some(b => b.props.label === 'Tentar de novo'));
  await act(async () => tree.unmount());
  // The Estudo tab is visible to every account; without flashcards it still offers the readings.
  const fs = require('node:fs');
  assert.doesNotMatch(fs.readFileSync('app/(tabs)/_layout.tsx', 'utf8'), /name="study" options=\{\{[^}]*href: flashcards/);
  assert.match(fs.readFileSync('app/(tabs)/study.tsx', 'utf8'), /allowed \? <StudyContent \/> : <StudyWithoutFlashcards \/>/);
  console.log('PASS vestibular UI: saved choice, upcoming list first, past lists collapsed newest first, book opens Descobrir, source opens the edital, pending year said, suggestions sent and errors shown, offline copy dated, retry when unavailable; Estudo visible to all.');
})().catch(error => { console.error(error); process.exitCode = 1; });
