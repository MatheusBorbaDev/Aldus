// Account deletion in the app (17/11/2026): the real screen and the real service with a controlled Supabase client and router.
// Two steps (what leaves and what stays, then the typed phrase); the button stays disabled until the phrase matches; the server
// error code becomes the matching message and nothing signs out; success signs out and opens the login with the notice.
const assert = require('node:assert/strict');
const React = require('../.expo/auth-test-tools/node_modules/react');
const { act, create } = require('../.expo/auth-test-tools/node_modules/react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const palette = { text: '#111', secondaryText: '#555', accent: '#a54', surface: '#fff' };
const calls = [], navigation = []; let reply = { data: { deleted: true }, error: null }, signOuts = 0, signOutFails = false;
const client = { functions: { invoke: async (name, options) => { calls.push([name, options]); if (reply instanceof Error) throw reply; return reply; } } };
const h = React.createElement;
const overrides = {
  react: React, 'react/jsx-runtime': require('../.expo/auth-test-tools/node_modules/react/jsx-runtime'),
  'react-native': { View: 'View', Text: 'Text', StyleSheet: { create: x => x } },
  'expo-router': { router: { back: () => navigation.push('back'), replace: target => navigation.push(target), push: target => navigation.push(target) } },
  '@/src/presentation/components/AuthForm': {
    AuthForm: ({ title, children }) => h('View', null, h('Text', null, title), children),
    AuthButton: ({ title, onPress, disabled }) => h('Pressable', { accessibilityLabel: title, onPress, disabled: !!disabled }),
    AuthInput: ({ label, value, onChangeText }) => h('TextInput', { accessibilityLabel: label, value, onChangeText }),
    AuthError: ({ message }) => message ? h('Text', { accessibilityRole: 'alert' }, message) : null,
  },
  '@/src/presentation/components/AuthGuard': { AuthGuard: ({ children }) => children },
  '@/src/presentation/contexts/AuthContext': { useAuth: () => ({ user: { email: 'leitor@example.invalid' }, signOut: async () => { signOuts++; if (signOutFails) throw Error('x'); } }) },
  '@/src/presentation/contexts/AppThemeContext': { useAppTheme: () => ({ palette }) },
  '@/src/data/remote/supabase': { requireSupabase: () => client },
  '@supabase/supabase-js': {},
};
const load = require('./community-test-loader.cjs')(overrides);
const { default: DeleteAccount } = load('app/account/delete.tsx');
const domain = load('src/domain/account/accountDeletion.ts');
const text = node => typeof node === 'string' ? node : (node.children ?? []).map(text).join('');
const flush = () => act(async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); });
const httpError = code => ({ data: null, error: { name: 'FunctionsHttpError', context: { json: async () => ({ error: code }) } } });

(async () => {
  assert.equal(domain.confirmationMatches('  excluir minha conta '), true); assert.equal(domain.confirmationMatches('excluir'), false);
  let tree;
  const mount = async () => { if (tree) await act(async () => tree.unmount()); await act(async () => { tree = create(h(DeleteAccount)); }); await flush(); };
  const button = label => tree.root.findAllByType('Pressable').find(n => n.props.accessibilityLabel === label);
  const press = async label => { const b = button(label); assert.ok(b, 'missing ' + label); assert.equal(b.props.disabled, false, label + ' enabled'); await act(async () => b.props.onPress()); await flush(); };
  const type = async value => { const input = tree.root.findByType('TextInput'); await act(async () => input.props.onChangeText(value)); };

  // Step 1 explains what leaves and what stays; nothing is sent.
  await mount();
  const first = text(tree.root);
  for (const line of [...domain.ACCOUNT_DELETE_REMOVES, ...domain.ACCOUNT_DELETE_KEEPS]) assert.ok(first.includes(line), 'step 1 lists: ' + line.slice(0, 40));
  assert.equal(tree.root.findAllByType('TextInput').length, 0, 'no phrase field on the first step');
  await press('Manter minha conta'); assert.deepEqual(navigation.splice(0), ['back']);
  await press('Continuar para a exclusão');

  // Step 2: disabled until the phrase matches.
  assert.equal(button('Confirmar: excluir minha conta').props.disabled, true, 'disabled before typing');
  await type('excluir'); assert.equal(button('Confirmar: excluir minha conta').props.disabled, true, 'disabled with a partial phrase');
  await type('excluir minha conta'); assert.equal(calls.length, 0, 'typing sends nothing');

  // Server refusals keep the account signed in and show the matching message.
  for (const [code, fragment] of [['files', 'Nada foi excluído'], ['admin', 'administração'], ['session', 'sessão expirou'], ['delete', 'ainda não foi excluída']]) {
    reply = httpError(code); await press('Confirmar: excluir minha conta');
    assert.ok(text(tree.root).includes(fragment), code + ' message'); assert.equal(signOuts, 0, code + ': still signed in'); assert.deepEqual(navigation, []);
  }
  reply = new Error('offline'); await press('Confirmar: excluir minha conta'); assert.ok(text(tree.root).includes('Sem conexão'), 'network message');
  reply = { data: null, error: { name: 'FunctionsFetchError' } }; await press('Confirmar: excluir minha conta'); assert.ok(text(tree.root).includes('Sem conexão'), 'fetch error message');
  reply = { data: { deleted: false }, error: null }; await press('Confirmar: excluir minha conta'); assert.ok(text(tree.root).includes('indisponível'), 'unexpected reply is not success');
  assert.equal(signOuts, 0);
  assert.deepEqual(calls.at(-1), ['account-delete', { body: { confirmation: 'EXCLUIR MINHA CONTA' } }], 'only the phrase is sent; the session goes in the client header');

  // Success: sign out, then the login with the notice.
  reply = { data: { deleted: true }, error: null }; await press('Confirmar: excluir minha conta');
  assert.equal(signOuts, 1); assert.deepEqual(navigation.splice(0), [{ pathname: '/auth/login', params: { notice: 'account-deleted' } }]);

  // Deleted but the local sign-out failed: say so instead of opening the login with a live session.
  await mount(); await press('Continuar para a exclusão'); await type('EXCLUIR MINHA CONTA'); signOutFails = true;
  await press('Confirmar: excluir minha conta');
  assert.ok(text(tree.root).includes('Sua conta foi excluída, mas a sessão continua aberta'), 'sign-out failure explained'); assert.deepEqual(navigation, []);
  await act(async () => tree.unmount());
  console.log('PASS account deletion screen: two steps, phrase required, server refusals keep the session and show their message, success signs out and opens the login with the notice. Remote function not exercised.');
})().catch(e => { console.error(e); process.exitCode = 1; });
