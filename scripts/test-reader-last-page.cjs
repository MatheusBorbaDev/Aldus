// BUG 20 (onda B2): a última página é a do último conteúdo real, não a de uma margem de seção. O comportamento é provado no
// Chromium (test:reader:reflow:web e test:reader:browser verificam texto visível na última página); aqui travamos o script gerado.
const assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript');
const out = ts.transpileModule(fs.readFileSync('src/presentation/components/EpubReaderDocument.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const m = {}; new Function('require', 'exports', out)(() => new Proxy({}, { get: (_t, k) => k === '__esModule' ? false : () => '' }), m);
const palette = { background: '#fff', text: '#000', secondaryText: '#555', accent: '#a00', panel: '#fff', separator: '#ddd', onAccent: '#fff' };
const html = m.createEpubReaderDocument([{ id: 'c', title: 't', html: '<p>texto</p>' }], { palette, fontSize: 16, fontFamily: 'Georgia', margin: 20, lineHeight: 1.6, paragraphSpacing: 1, maxWidth: 900 });
assert.match(html, /function lastContentPage\(left, width\)/, 'content-based last page is in the iframe script');
assert.match(html, /\(node\.nodeValue \|\| ""\)\.trim\(\)\.length > 0/, 'non-empty text check survives the template string');
assert.doesNotMatch(html, /\/S\/\.test\(node\.nodeValue/, 'no regex mangled into /S/ by template escaping');
assert.match(html, /var byContent = lastContentPage\(left, width\);\s*if \(byContent > 0\) return byContent;/, 'falls back to section fragments only without content');
// Generated script must still parse.
const scripts = [...html.matchAll(/<script nonce="[^"]+">([\s\S]*?)<\/script>/g)].map(x => x[1]); assert.ok(scripts.length);
for (const code of scripts) new Function(code);
console.log('PASS reader last page (BUG 20): content-based total in the generated iframe script, escape-safe text check, fragment fallback, script parses.');
