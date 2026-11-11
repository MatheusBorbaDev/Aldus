// Onda D1: pdf.js fora do bundle principal da Web. Nenhum import de valor estático de "pdfjs-dist" (só `import type`); o carregamento
// passa por pdfjsRuntime.web (import dinâmico, sem cache de falha). Medição em .expo/perf/d1-{before,after}.log (scripts/measure-web-bundle.cjs).
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const files = []; const walk = dir => { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, entry.name); if (entry.isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(entry.name)) files.push(p); } };
walk('src'); walk('app');
const offenders = files.filter(file => /^\s*import\s+(?!type\b)[^;]*from\s+["']pdfjs-dist["']/m.test(fs.readFileSync(file, 'utf8')));
assert.deepEqual(offenders, [], 'no static value import of pdfjs-dist');
const runtime = fs.readFileSync('src/presentation/components/pdfjsRuntime.web.ts', 'utf8');
assert.match(runtime, /import\("pdfjs-dist"\)/); assert.match(runtime, /\.catch\(error => \{ loading = null; throw error; \}\)/, 'a failed load is retried next time');
for (const file of ['src/presentation/components/PdfPageViewer.web.tsx', 'src/presentation/components/PdfReflowProcessor.web.tsx', 'src/presentation/services/PdfThumbnailGenerator.web.ts']) assert.match(fs.readFileSync(file, 'utf8'), /loadPdfJs/, file + ' loads on demand');
console.log('PASS pdf.js lazy: no static pdfjs-dist value imports, single on-demand loader with retry, used by viewer/reflow/thumbnails.');
