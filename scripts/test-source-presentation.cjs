// Source presentation helpers (quality wave 3): readable "last updated" label without Intl, in local time.
const assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript');
const out = {};
new Function('require', 'exports', ts.transpileModule(fs.readFileSync('src/presentation/components/sourcePresentation.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(name => {
  if (name === 'react') return { useSyncExternalStore: () => null };
  if (name === '@/src/data/library/LibraryAccountScope') return { libraryAccountScope: { subscribe: () => () => undefined, userId: null, generation: 0 } };
  throw Error('unexpected import ' + name);
}, out);
const { sourceUpdatedLabel } = out;
const now = new Date(2026, 10, 9, 15, 30).getTime();
assert.equal(sourceUpdatedLabel(new Date(2026, 10, 9, 9, 5).getTime(), now), 'Atualizada hoje às 09:05');
assert.equal(sourceUpdatedLabel(new Date(2026, 10, 8, 23, 59).getTime(), now), 'Atualizada ontem às 23:59');
assert.equal(sourceUpdatedLabel(new Date(2026, 10, 3, 12, 0).getTime(), now), 'Atualizada em 3 de nov.');
assert.equal(sourceUpdatedLabel(new Date(2025, 0, 31, 12, 0).getTime(), now), 'Atualizada em 31 de jan. de 2025');
assert.equal(sourceUpdatedLabel(new Date(2026, 10, 10, 8, 0).getTime(), now), 'Atualizada em 10 de nov.', 'a clock ahead of the device shows the date, never "hoje"');
for (const missing of [null, undefined, 0, -1, NaN, Infinity]) assert.equal(sourceUpdatedLabel(missing, now), null, `no invented date for ${missing}`);
const screen = fs.readFileSync('src/presentation/components/SourceLibraryScreen.tsx', 'utf8');
assert.ok(!screen.includes('new Date(') && !screen.includes('Última atualização:') && screen.includes('sourceUpdatedLabel('), 'source screen uses the readable label, not a raw timestamp');
assert.ok(!/style=\{\(\{\s*pressed/.test(screen), 'static Pressable styles only');
console.log('PASS source presentation: readable updated label (today/yesterday/same year/other year/future/missing), no raw timestamp on the source screen.');
