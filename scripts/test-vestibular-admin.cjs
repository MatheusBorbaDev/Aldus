// Admin · Leituras de vestibular (25/11/2026): componente real com Admin e React Native simulados.
const assert = require('node:assert/strict');
const React = require('../.expo/auth-test-tools/node_modules/react');
const { act, create } = require('../.expo/auth-test-tools/node_modules/react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const calls = []; let fail = false; const opened = [];
const El = name => ({ children, ...props }) => React.createElement(name, props, children);
const load = require('./community-test-loader.cjs')({
  react: React, 'react/jsx-runtime': require('../.expo/auth-test-tools/node_modules/react/jsx-runtime'),
  'react-native': { View: 'View', Linking: { openURL: async u => opened.push(u) } },
  '../data/AdminRepository': { adminRepository: { vestibularChange: async (...args) => { if (fail) throw Error('O servidor não confirmou a alteração.'); calls.push(args.slice(0, 5)); } } },
  './components': {
    Button: ({ title, onPress, disabled, selected }) => React.createElement('Button', { title, onPress, disabled, selected }),
    Card: ({ title, children }) => React.createElement('Card', { title }, children), Label: El('Label'), Muted: El('Muted'),
    Field: ({ label, value, onChange }) => React.createElement('Field', { label, value, onChange }),
    dateLabel: v => v, rowStyle: {},
  },
});
const { AdminVestibular } = load('src/admin/presentation/AdminVestibular.tsx');
const data = {
  vestibulares: [{ id: 'fuvest', name: 'Fuvest', institution: 'USP', official_url: null, watch_url: 'https://www.fuvest.br/leituras', active: true }, { id: 'unicamp', name: 'Unicamp', institution: 'Unicamp', official_url: null, watch_url: null, active: true }],
  lists: [{ vestibular_id: 'fuvest', exam_year: 2027, source_url: 'https://www.fuvest.br/e2027', books: [{ title: 'Iracema', author: 'José de Alencar' }], updated_at: 'x' }],
  suggestions: [{ id: 7, vestibular_id: null, message: 'Incluir a UERJ', created_at: 'y' }],
  alerts: [{ vestibular_id: 'fuvest', changed_at: 'z', checked_at: 'z', status: 200 }],
};
const raw = n => typeof n === 'string' ? n : Array.isArray(n) ? n.map(raw).join(' ') : (n?.children ?? []).map(raw).join(' '); const text = n => raw(n).replace(/\s+/g, ' ');
const btn = (tree, title) => tree.root.findAllByType('Button').find(b => b.props.title === title);
const field = (tree, label) => tree.root.findAllByType('Field').find(f => f.props.label === label);
(async () => {
  let changed = 0, tree;
  await act(async () => { tree = create(React.createElement(AdminVestibular, { data, enabled: true, onChanged: () => changed++ })); });
  // Without a reason nothing can change.
  assert.equal(btn(tree, 'Conferido').props.disabled, true); assert.equal(btn(tree, 'Resolvida').props.disabled, true); assert.equal(btn(tree, 'Remover').props.disabled, true);
  await act(async () => field(tree, 'Motivo').props.onChange('Conferido no edital oficial'));
  assert.equal(btn(tree, 'Conferido').props.disabled, false);
  // Publish needs year, https source and valid lines; parsed books go to the server in order.
  await act(async () => btn(tree, 'Unicamp').props.onPress());
  assert.equal(btn(tree, `Publicar Unicamp ${new Date().getFullYear() + 1}`).props.disabled, true, 'empty form');
  await act(async () => field(tree, 'Ano da edição (ex.: 2027)').props.onChange('2028'));
  await act(async () => field(tree, 'Link oficial (https)').props.onChange('http://comvest.unicamp.br/x'));
  await act(async () => field(tree, 'Obras').props.onChange('1. O cortiço — Aluísio Azevedo\nSem autor'));
  let shown = text(tree.toJSON()); assert.ok(shown.includes('Informe o link https')); assert.ok(shown.includes('Linha 2'));
  assert.equal(btn(tree, 'Publicar Unicamp 2028').props.disabled, true);
  await act(async () => field(tree, 'Link oficial (https)').props.onChange('https://www.comvest.unicamp.br/obras-2028'));
  await act(async () => field(tree, 'Obras').props.onChange('1. O cortiço — Aluísio Azevedo\n2. Dom Casmurro — Machado de Assis'));
  assert.ok(text(tree.toJSON()).includes('2 obras reconhecidas'));
  await act(async () => btn(tree, 'Publicar Unicamp 2028').props.onPress());
  assert.deepEqual(calls.at(-1), ['publish', 'unicamp', 2028, { source_url: 'https://www.comvest.unicamp.br/obras-2028', books: [{ position: 1, title: 'O cortiço', author: 'Aluísio Azevedo' }, { position: 2, title: 'Dom Casmurro', author: 'Machado de Assis' }] }, 'Conferido no edital oficial']);
  assert.equal(changed, 1); assert.ok(text(tree.toJSON()).includes('Lista publicada.'));
  // Editing fills the form from the published list; alert, suggestion and removal calls.
  await act(async () => btn(tree, 'Editar').props.onPress());
  assert.equal(field(tree, 'Obras').props.value, 'Iracema — José de Alencar'); assert.equal(field(tree, 'Ano da edição (ex.: 2027)').props.value, '2027');
  await act(async () => btn(tree, 'Conferido').props.onPress()); assert.deepEqual(calls.at(-1).slice(0, 3), ['alert_seen', 'fuvest', null]);
  await act(async () => btn(tree, 'Resolvida').props.onPress()); assert.deepEqual(calls.at(-1).slice(0, 4), ['suggestion_done', null, null, { id: 7 }]);
  await act(async () => btn(tree, 'Remover').props.onPress()); assert.deepEqual(calls.at(-1).slice(0, 3), ['remove', 'fuvest', 2027]);
  await act(async () => btn(tree, 'Abrir página').props.onPress()); assert.equal(opened.at(-1), 'https://www.fuvest.br/leituras');
  // A refused change is said, not reported as success.
  fail = true; await act(async () => btn(tree, 'Remover').props.onPress());
  assert.ok(text(tree.toJSON()).includes('O servidor não confirmou'));
  await act(async () => tree.unmount());
  // Without recent MFA every change is disabled.
  await act(async () => { tree = create(React.createElement(AdminVestibular, { data, enabled: false, onChanged: () => undefined })); });
  await act(async () => field(tree, 'Motivo').props.onChange('Conferido no edital oficial'));
  assert.ok(tree.root.findAllByType('Button').filter(b => /Conferido|Resolvida|Remover|Publicar/.test(b.props.title)).every(b => b.props.disabled));
  await act(async () => tree.unmount());
  console.log('PASS vestibular admin: reason and MFA gate every change; publish validates year, https source and lines and sends the parsed works in order; edit fills from a published list; alert seen, suggestion done, remove; server refusal shown.');
})().catch(error => { console.error(error); process.exitCode = 1; });
