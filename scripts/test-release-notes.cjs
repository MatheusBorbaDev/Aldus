// Release notes pop-up, beta page and loading quote (owner's request, 18/11/2026). Real components with a stub React Native,
// controlled storage and router.
const assert = require('node:assert/strict');
const React = require('../.expo/auth-test-tools/node_modules/react');
const { act, create } = require('../.expo/auth-test-tools/node_modules/react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const store = new Map(); let failRead = false, failWrite = false; const routes = [];
const storage = { getItem: async key => { if (failRead) throw Error('read'); return store.get(key) ?? null; }, setItem: async (key, value) => { if (failWrite) throw Error('write'); store.set(key, value); } };
const palette = { panel: '#fff', surface: '#fff', surfaceSecondary: '#eee', border: '#ddd', text: '#111', secondaryText: '#555', accent: '#a54', accentSoft: '#fde', onAccent: '#fff' };
const load = require('./community-test-loader.cjs')({
  react: React, 'react/jsx-runtime': require('../.expo/auth-test-tools/node_modules/react/jsx-runtime'),
  'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView', Image: 'Image', ActivityIndicator: 'Spinner', Modal: ({ children }) => React.createElement('Modal', null, children), StyleSheet: { create: x => x } },
  '@expo/vector-icons': { Ionicons: 'Icon' }, 'expo-router': { router: { push: target => routes.push(target) } },
  '@react-native-async-storage/async-storage': { default: storage, ...storage },
  '@/src/presentation/contexts/AppThemeContext': { useAppTheme: () => ({ palette }) },
});
const { ReleaseNotesModal } = load('src/presentation/components/ReleaseNotesModal.tsx');
const { RELEASE_NOTES, RELEASE_NOTES_SEEN_KEY, shouldShowReleaseNotes } = load('src/domain/brand/releaseNotes.ts');
const { betaLimitationsDocument } = load('src/legal/betaLimitations.ts');
const { AppLoadingScreen, LOADING_QUOTE } = load('src/presentation/components/AppLoadingScreen.tsx');
const text = node => typeof node === 'string' ? node : (node.children ?? []).map(text).join('');
const flush = () => act(async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); });

(async () => {
  assert.equal(shouldShowReleaseNotes(null, false), true); assert.equal(shouldShowReleaseNotes(RELEASE_NOTES.id, false), false); assert.equal(shouldShowReleaseNotes(null, true), false);
  let tree; const mount = async () => { if (tree) await act(async () => tree.unmount()); await act(async () => { tree = create(React.createElement(ReleaseNotesModal)); }); await flush(); };
  const press = async label => { const b = tree.root.findAllByType('Pressable').find(n => n.props.accessibilityLabel === label); assert.ok(b, 'missing ' + label); await act(async () => b.props.onPress()); await flush(); };
  // First open: shown with every item, the beta notice and the link.
  await mount();
  const shown = text(tree.root);
  assert.ok(shown.includes('Novidades do Aldus') && shown.includes(RELEASE_NOTES.date));
  for (const item of RELEASE_NOTES.items) assert.ok(shown.includes(item), 'item shown: ' + item.slice(0, 30));
  assert.ok(shown.includes('Esta é uma versão beta'));
  await press('Entendi'); assert.equal(text(tree.root), '', 'closed'); assert.equal(store.get(RELEASE_NOTES_SEEN_KEY), RELEASE_NOTES.id);
  await mount(); assert.equal(text(tree.root), '', 'not shown twice');
  // The link opens the beta page and also marks as seen.
  store.clear(); await mount(); await press('O que esperar desta beta');
  assert.deepEqual(routes, ['/beta']); assert.equal(store.get(RELEASE_NOTES_SEEN_KEY), RELEASE_NOTES.id); assert.equal(text(tree.root), '');
  // Read failure: do not nag. Write failure: still closes.
  store.clear(); failRead = true; await mount(); assert.equal(text(tree.root), ''); failRead = false;
  failWrite = true; await mount(); await press('Entendi'); assert.equal(text(tree.root), '', 'a failed write does not trap the person'); failWrite = false;
  await act(async () => tree.unmount());
  // Beta page: approved text, no placeholders left, report channel filled from the approved support contact.
  const doc = JSON.stringify(betaLimitationsDocument);
  assert.ok(!/A DEFINIR|CONFERIR/.test(doc), 'no placeholders in the app');
  assert.equal(betaLimitationsDocument.title, 'O que esperar desta beta');
  const help = betaLimitationsDocument.sections.find(s => s.heading === 'Como nos ajudar');
  assert.match(help.bullets.at(-1), /^Canal para relatos: \S+@\S+\.\S+$/);
  assert.ok(betaLimitationsDocument.sections.some(s => s.heading === 'O que o Aldus não faz, de propósito'));
  // The catalog is in the app (18/11): listed under "Seus livros", on every device; "Em construção" is gone (everything listed was delivered).
  const section = heading => betaLimitationsDocument.sections.find(s => s.heading === heading).bullets.join('\n');
  assert.match(section('Seus livros'), /Buscar qualquer livro[\s\S]*em todos os seus aparelhos/);
  assert.doesNotMatch(JSON.stringify(betaLimitationsDocument), /ficam só no aparelho/);
  assert.ok(!betaLimitationsDocument.sections.some(s => s.heading === 'Em construção'), 'nothing listed as planned that is already delivered');
  assert.ok(RELEASE_NOTES.items.some(item => item.startsWith('Buscar qualquer livro') && /todos os seus aparelhos/.test(item)));
  assert.ok(RELEASE_NOTES.items.some(item => item.startsWith('Nota e resenha pessoais')));
  assert.ok(RELEASE_NOTES.items.every(item => !/só neste aparelho/.test(item)), 'no outdated local-only claim');
  assert.ok(RELEASE_NOTES.items.some(item => item.startsWith('Grifos na Leitura Livre')), 'owner-approved item (18/11)');
  // Loading screen quote (public domain, credited).
  await act(async () => { tree = create(React.createElement(AppLoadingScreen)); });
  const loading = text(tree.root);
  for (const line of LOADING_QUOTE.lines) assert.ok(loading.includes(line));
  assert.ok(loading.includes('Castro Alves · O livro e a América'));
  await act(async () => tree.unmount());
  console.log('PASS release notes: shown once per version with every item, the beta notice and the link to the beta page; Entendi and the link mark as seen; read failure does not nag, write failure does not trap; beta page has no placeholders and a filled report channel; loading screen shows the Castro Alves quote with credit.');
})().catch(error => { console.error(error); process.exitCode = 1; });
