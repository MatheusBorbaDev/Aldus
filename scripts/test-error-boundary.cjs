// BUG 14: root render-error boundary. Renders ErrorScreen with stub RN host components (react-test-renderer) and checks
// the root layout wiring statically. Does not run expo-router's Try in a real app, Android or TalkBack.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('../.expo/auth-test-tools/node_modules/react');
const { act, create } = require('../.expo/auth-test-tools/node_modules/react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;

let scheme = 'light';
const host = name => { const C = ({ children, ...props }) => React.createElement(name, props, children); C.displayName = name; return C; };
const rn = {
  View: host('View'), Text: host('Text'), Pressable: host('Pressable'), ScrollView: host('ScrollView'),
  StyleSheet: { create: s => s, hairlineWidth: 1 }, Platform: { OS: 'android', select: o => o.android ?? o.default },
  useColorScheme: () => scheme,
};
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const resolve = name => {
    if (name === 'react') return React;
    if (name === 'react/jsx-runtime') return require('../.expo/auth-test-tools/node_modules/react/jsx-runtime');
    if (name === 'react-native') return rn;
    if (name.endsWith('/contexts/AppThemeContext')) throw Error('ErrorScreen must not depend on AppThemeProvider (it renders outside providers)');
    const base = name.startsWith('@/') ? name.slice(2) : name.startsWith('.') ? path.resolve(path.dirname(file), name) : null;
    if (base) return load(['.ts', '.tsx'].map(ext => path.resolve(base) + ext).find(c => fs.existsSync(c)));
    return require(name);
  };
  new Function('require', 'module', 'exports', code)(resolve, module, module.exports);
  return module.exports;
}
const { ErrorScreen } = load('src/ui/ErrorScreen.tsx');
const { appThemeTokens } = load('src/theme/tokens.ts');
const flat = s => Array.isArray(s) ? Object.assign({}, ...s.flat(Infinity).filter(Boolean)) : (s ?? {});
const text = node => typeof node === 'string' ? node : (node.children ?? []).map(text).join('');
const render = el => { let r; act(() => { r = create(el); }); return r; };

const calls = [];
let r = render(React.createElement(ErrorScreen, { onRetry: () => calls.push('retry'), onHome: () => calls.push('home') }));
const header = r.root.findAllByType('Text').find(t => t.props.accessibilityRole === 'header');
assert.equal(text(header), 'Algo deu errado nesta tela');
assert.equal(flat(header.props.style).color, appThemeTokens.light.text, 'light scheme uses app light tokens');
const buttons = r.root.findAllByType('Pressable');
assert.deepEqual(buttons.map(b => b.props.accessibilityLabel), ['Tentar de novo', 'Voltar à Biblioteca']);
for (const b of buttons) {
  assert.equal(b.props.accessibilityRole, 'button');
  assert.ok(flat(b.props.style).minHeight >= 44, 'touch target >= 44');
  assert.notEqual(typeof b.props.style, 'function', 'static Pressable style (BUG 18)');
}
buttons.forEach(b => b.props.onPress());
assert.deepEqual(calls, ['retry', 'home']);
assert.ok(!r.root.findAllByType('Text').some(t => t.props.selectable), 'no technical detail without `detail`');

scheme = 'dark';
r = render(React.createElement(ErrorScreen, { onRetry() {}, detail: 'boom' }));
assert.equal(flat(r.root.findAllByType('Text').find(t => t.props.accessibilityRole === 'header').props.style).color, appThemeTokens.dark.text, 'dark scheme');
assert.equal(r.root.findAllByType('Pressable').length, 1, 'home action is optional');
assert.equal(text(r.root.findAllByType('Text').find(t => t.props.selectable)), 'boom');

// Root wiring: expo-router renders the root layout's exported ErrorBoundary for any descendant render error.
const layout = fs.readFileSync('app/_layout.tsx', 'utf8');
assert.match(layout, /export function ErrorBoundary\(\{ error, retry \}: ErrorBoundaryProps\)/);
assert.match(layout, /<ErrorScreen[\s\S]*detail=\{__DEV__ \? error\.message : undefined\}/, 'technical detail only in development');
assert.match(layout, /onHome=\{\(\) => \{ router\.replace\("\/library"\); void retry\(\); \}\}/);
const boundary = layout.slice(layout.indexOf('export function ErrorBoundary'), layout.indexOf('export default function RootLayout'));
assert.doesNotMatch(boundary, /fetch\(|console\.|Diagnostic|supabase/i, 'boundary does not log or send the error');
console.log('PASS error boundary: recovery screen outside providers (light/dark tokens), retry/home actions, 44px static targets, dev-only detail, root layout wiring without logging. Stub renderer; expo-router Try/Android not exercised.');
