// Web bundle composition (quality wave 2, P3: measure only, no splitting). Exports the Web app with source maps into an
// ignored directory (.expo/perf/bundle-export) and attributes each JS chunk's bytes to packages/app folders through the
// source map mappings. Sizes are of the minified output (not gzip per module). Usage: node scripts/measure-web-bundle.cjs
const fs = require('fs'), path = require('path'), cp = require('child_process');
const outDir = path.resolve('.expo/perf/bundle-export');
if (!process.argv.includes('--reuse')) {
  fs.rmSync(outDir, { recursive: true, force: true });
  const r = cp.spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['expo', 'export', '--platform', 'web', '--source-maps', '--output-dir', outDir], { stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const decode = (str, i) => { let result = 0, shift = 0, digit; do { digit = B64.indexOf(str[i.i++]); result += (digit & 31) << shift; shift += 5; } while (digit & 32); return result & 1 ? -(result >> 1) : result >> 1; };
const group = source => {
  const s = source.replace(/\\/g, '/');
  const nm = s.lastIndexOf('node_modules/');
  if (nm >= 0) { const rest = s.slice(nm + 13).split('/'); return 'npm:' + (rest[0].startsWith('@') ? rest[0] + '/' + rest[1] : rest[0]); }
  const m = s.match(/(?:^|\/)(app|src)\/([^/]+)/); if (m) return m[1] + '/' + m[2];
  return 'other:' + s.split('/').slice(-2).join('/');
};
const jsDir = path.join(outDir, '_expo/static/js/web');
const report = {};
for (const file of fs.readdirSync(jsDir).filter(f => f.endsWith('.js'))) {
  const code = fs.readFileSync(path.join(jsDir, file), 'utf8'), mapFile = path.join(jsDir, file + '.map');
  if (!fs.existsSync(mapFile)) continue;
  const map = JSON.parse(fs.readFileSync(mapFile, 'utf8')), lines = code.split('\n'), totals = new Map();
  let src = 0;
  map.mappings.split(';').forEach((line, row) => {
    const segs = []; let col = 0; const i = { i: 0 };
    for (const seg of line.split(',')) { if (!seg) continue; i.i = 0; const s = seg; col += decode(s, i); let source = null; if (i.i < s.length) { src += decode(s, i); decode(s, i); decode(s, i); if (i.i < s.length) decode(s, i); source = src; } segs.push([col, source]); }
    const len = (lines[row] || '').length;
    segs.forEach(([start, source], k) => { const end = k + 1 < segs.length ? segs[k + 1][0] : len; if (source === null) return; const key = group(map.sources[source] || '?'); totals.set(key, (totals.get(key) || 0) + Math.max(0, end - start)); });
  });
  const bytes = Buffer.byteLength(code);
  report[file] = { bytes, top: [...totals].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => ({ group: k, bytes: v, pct: +(100 * v / bytes).toFixed(1) })) };
}
fs.writeFileSync(path.resolve('.expo/perf/web-bundle-composition.json'), JSON.stringify(report, null, 2));
for (const [file, r] of Object.entries(report)) { console.log(`\n${file}: ${(r.bytes / 1024).toFixed(0)} KiB`); console.table(r.top.slice(0, 15).map(x => ({ group: x.group, KiB: Math.round(x.bytes / 1024), pct: x.pct }))); }
console.log('Saved .expo/perf/web-bundle-composition.json (minified bytes by source map; approximate).');
