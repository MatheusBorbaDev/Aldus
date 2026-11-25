// Pós-export Web para a Cloudflare (Workers com arquivos estáticos; pedido do dono em 25/11/2026). Gera dentro de dist/:
// - _headers: os mesmos cabeçalhos do vercel.json (fonte única, para as duas hospedagens não divergirem);
// - _redirects: cada rota do app (pastas e arquivos de app/) é servida pelo app.html em /app com status 200, como a reescrita
//   "/(.*)" → "/app" da Vercel. A landing continua em / (index.html pré-renderizado). Não há Worker: tudo é arquivo estático.
// - .assetsignore: o vercel.json copiado para dist/ não sobe para a Cloudflare.
// A Vercel ignora estes arquivos (são servidos como arquivos comuns, sem efeito).
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');

function appRouteSegments(appDir = path.join(root, 'app')) {
  const segments = new Set();
  const collect = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && /^\(.+\)$/.test(entry.name)) { collect(path.join(directory, entry.name)); continue; } // grupo: (tabs)
      const name = entry.isDirectory() ? entry.name : entry.name.replace(/\.(web\.|native\.)?tsx?$/, '');
      if (/^[_+]/.test(name) || name === 'index' || /^\[/.test(name)) continue; // layouts, +native-intent, a landing e rotas dinâmicas na raiz
      if (!/^[a-z0-9-]+$/.test(name)) throw Error(`Rota inesperada em app/: ${entry.name}`);
      segments.add(name);
    }
  };
  collect(appDir);
  return [...segments].sort();
}

function cloudflareFiles({ vercelConfig, segments, distEntries = [] }) {
  const clash = segments.filter(segment => distEntries.includes(segment) || distEntries.includes(`${segment}.html`) && segment !== 'app');
  if (clash.length) throw Error(`Rota do app com o mesmo nome de um arquivo do export: ${clash.join(', ')}`);
  const headers = vercelConfig.headers.map(rule => {
    const source = rule.source === '/(.*)' ? '/*' : rule.source;
    if (/[()]/.test(source)) throw Error(`Padrão de cabeçalho sem tradução para _headers: ${rule.source}`);
    return [source, ...rule.headers.map(h => `  ${h.key}: ${h.value}`)].join('\n');
  }).join('\n\n') + '\n';
  // Regras estáticas (/rota) antes das dinâmicas (/rota/*), como pede a documentação. Destino /app = app.html (URL limpa).
  const redirects = [
    '# Gerado por scripts/write-cloudflare-assets.cjs a partir de app/. Rotas do app usam o app.html; a landing fica em /.',
    ...segments.map(segment => `/${segment} /app 200`),
    ...segments.map(segment => `/${segment}/* /app 200`),
  ].join('\n') + '\n';
  return { headers, redirects, assetsignore: 'vercel.json\n' };
}

function write() {
  const dist = path.join(root, 'dist');
  if (!fs.existsSync(path.join(dist, 'index.html')) || !fs.existsSync(path.join(dist, 'app.html'))) throw Error('Export Web ausente: rode o export antes.');
  const vercelConfig = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  const segments = appRouteSegments();
  const files = cloudflareFiles({ vercelConfig, segments, distEntries: fs.readdirSync(dist) });
  fs.writeFileSync(path.join(dist, '_headers'), files.headers);
  fs.writeFileSync(path.join(dist, '_redirects'), files.redirects);
  fs.writeFileSync(path.join(dist, '.assetsignore'), files.assetsignore);
  console.log(`PASS Cloudflare: _headers (${vercelConfig.headers.length} regras do vercel.json) e _redirects (${segments.length} rotas do app → /app).`);
}

module.exports = { appRouteSegments, cloudflareFiles };
if (require.main === module) write();
