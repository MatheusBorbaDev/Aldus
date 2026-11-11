// Onda A1: grifo → flashcard. Painel real (StudyHighlightsPanel) com repositórios em memória: depois de salvar um grifo aparece o
// atalho "Criar flashcard deste grifo"; o deck usa o título legível do livro; repetir avisa em vez de falhar em silêncio.
const assert = require('node:assert/strict');
const React = require('../.expo/auth-test-tools/node_modules/react');
const { act, create } = require('../.expo/auth-test-tools/node_modules/react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const palette = { text: '#111', secondaryText: '#555', accent: '#a54', panel: '#fff', separator: '#ddd', surface: '#fff', border: '#ddd', background: '#fafafa' };
const highlights = [], decks = [], cards = [];
let id = 0;
const repository = { load: async () => ({ decks: [...decks], cards: [...cards], sessions: [] }), createDeck: async deck => { decks.push(deck); }, createCards: async list => { cards.push(...list); } };
const load = require('./community-test-loader.cjs')({
  react: React, 'react/jsx-runtime': require('../.expo/auth-test-tools/node_modules/react/jsx-runtime'),
  'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', TextInput: 'TextInput', Platform: { OS: 'android' }, Share: { share: async () => {} }, StyleSheet: { create: x => x } },
  '@expo/vector-icons': { Ionicons: Object.assign(() => null, { glyphMap: {} }) },
  '@/src/presentation/contexts/AppThemeContext': { useAppTheme: () => ({ palette }) },
  '@/src/presentation/contexts/AuthContext': { useAuth: () => ({ user: { id: 'u' }, canUse: () => true }) },
  '@/src/presentation/services/dependencies': { appDependencies: { highlightRepository: { save: async h => { const i = highlights.findIndex(x => x.id === h.id); if (i >= 0) highlights[i] = h; else highlights.push(h); }, remove: async () => {}, listByBookId: async () => highlights } } },
  '@/src/data/local/FlashcardRepository': { createFlashcardDeckId: () => 'deck-' + (++id), createFlashcardId: () => 'card-' + (++id), flashcardsForUser: () => repository },
});
const { StudyHighlightsPanel } = load('src/presentation/components/StudyHighlightsPanel.tsx');
const text = node => typeof node === 'string' ? node : (node.children ?? []).map(text).join('');
(async () => {
  const book = { id: 'b1', title: 'sobre-a-vida-feliz', fileName: 'sobre-a-vida-feliz.pdf', author: 'Sêneca' };
  const capture = { version: 1, kind: 'epub-text', chapterId: 'c1', start: 0, end: 25, quote: 'A vida feliz é a virtude.', prefix: '', suffix: '', path: [0] };
  let tree; const props = extra => ({ book, capture, chapterTitle: 'Capítulo I', highlights: [...highlights], onSaved: async () => {}, onSelect: () => {}, onNavigate: () => {}, ...extra });
  await act(async () => { tree = create(React.createElement(StudyHighlightsPanel, props())); });
  const press = async label => { const b = tree.root.findAllByType('Pressable').find(n => n.props.accessibilityLabel === label); assert.ok(b, 'missing ' + label); await act(async () => { await b.props.onPress(); }); };
  assert.equal(tree.root.findAllByType('Pressable').some(n => n.props.accessibilityLabel === 'Criar flashcard deste grifo'), false, 'no shortcut before saving');
  await press('Salvar grifo');
  assert.equal(highlights.length, 1); assert.ok(text(tree.root).includes('Grifo salvo.'));
  await press('Criar flashcard deste grifo');
  assert.equal(decks.length, 1); assert.equal(decks[0].title, 'Grifos: Sobre a Vida Feliz', 'deck uses the readable catalog title, not the file name');
  assert.equal(cards.length, 1); assert.equal(cards[0].source.kind, 'highlight'); assert.equal(cards[0].source.quote, capture.quote);
  assert.ok(text(tree.root).includes('Flashcard criado no deck “Grifos: Sobre a Vida Feliz”'), 'creation is confirmed');
  assert.equal(tree.root.findAllByType('Pressable').some(n => n.props.accessibilityLabel === 'Criar flashcard deste grifo'), false, 'shortcut disappears after use');
  // Same highlight again through its menu: no duplicate, and the reader is told why.
  await act(async () => tree.update(React.createElement(StudyHighlightsPanel, props({ capture: null }))));
  await press('Opções do grifo 1'); await press('Criar flashcard');
  assert.equal(cards.length, 1, 'no duplicate flashcard'); assert.ok(text(tree.root).includes('Este grifo já tem um flashcard'), 'duplicate is explained');
  await act(async () => tree.unmount());
  console.log('PASS highlight → flashcard: shortcut after saving, readable deck title, creation confirmed, duplicate explained (no silent return). Controlled components; not Android.');
})().catch(e => { console.error(e); process.exitCode = 1; });
