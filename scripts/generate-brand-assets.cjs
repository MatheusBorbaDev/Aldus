// Generates the Aldus brand assets from the vector profile (owner approved on 18/11/2026: "Retrato e nome" + "Medalha" + "Ícone",
// led by azul-noite and creme, terracota as secondary). Writes the SVG sources in assets/brand/ and rasterizes the Android launcher
// icons (legacy, round, adaptive foreground and monochrome), the splash logo and the Web favicon with headless Chrome.
// Usage: node scripts/generate-brand-assets.cjs
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), cp = require('node:child_process');
const { browserPath } = require('./browser-path.cjs');
const root = path.resolve(__dirname, '..');
const d = fs.readFileSync(path.join(root, 'assets/brand/aldus-perfil-path.txt'), 'utf8').trim();
const C = { noite: '#1B1C30', creme: '#EFE6D6', papel: '#F7F4EE', terracota: '#A64E32', terracotaClara: '#E59A76' };
const profile = fill => `<path d="${d}" fill-rule="evenodd" fill="${fill}"/>`;
// Head and beret crop of the 1024x1536 reference: the bust is cut by the bottom edge (or by the launcher mask).
const head = (fill, x, y, w, h) => `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="225 352 520 565" preserveAspectRatio="xMidYMax meet">${profile(fill)}</svg>`;

const svgs = {
  'aldus-icone.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="${C.noite}"/>${head(C.creme, 48, 60, 416, 452)}</svg>`,
  'aldus-icone-redondo.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><clipPath id="c"><circle cx="256" cy="256" r="256"/></clipPath></defs><g clip-path="url(#c)"><rect width="512" height="512" fill="${C.noite}"/>${head(C.creme, 48, 60, 416, 452)}</g></svg>`,
  // Adaptive foreground: 108 units, the mask shows the central 72 and the safe zone is the central 66.
  'aldus-icone-frente.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">${head(C.creme, 25, 30, 58, 63)}</svg>`,
  'aldus-medalha.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="90 332 760 760"><defs><clipPath id="m"><circle cx="470" cy="712" r="360"/></clipPath></defs><circle cx="470" cy="712" r="372" fill="${C.terracota}"/><circle cx="470" cy="712" r="360" fill="${C.creme}"/><g clip-path="url(#m)">${profile(C.noite)}</g></svg>`,
  'aldus-assinatura.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1500 560"><g transform="translate(20 -330) scale(0.82)">${profile(C.noite)}</g><line x1="640" y1="110" x2="640" y2="470" stroke="${C.terracota}" stroke-width="3"/><text x="700" y="330" font-family="'EB Garamond', Georgia, serif" font-size="230" fill="${C.noite}" letter-spacing="4">Aldus</text><text x="708" y="420" font-family="'EB Garamond', Georgia, serif" font-size="58" font-style="italic" fill="${C.terracota}" letter-spacing="10">Reader</text></svg>`,
  'aldus-abertura.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 288 288"><svg x="84" y="40" width="120" height="120" viewBox="90 332 760 760"><defs><clipPath id="s"><circle cx="470" cy="712" r="360"/></clipPath></defs><circle cx="470" cy="712" r="372" fill="${C.terracotaClara}"/><circle cx="470" cy="712" r="360" fill="${C.creme}"/><g clip-path="url(#s)">${profile(C.noite)}</g></svg><text x="144" y="208" text-anchor="middle" font-family="'EB Garamond', Georgia, serif" font-size="44" fill="${C.creme}" letter-spacing="1">Aldus</text><text x="144" y="234" text-anchor="middle" font-family="'EB Garamond', Georgia, serif" font-size="13" font-style="italic" fill="${C.terracotaClara}" letter-spacing="4">Reader</text></svg>`,
};

const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const targets = [];
for (const [density, scale] of Object.entries(densities)) {
  const res = `android/app/src/main/res`;
  targets.push({ svg: 'aldus-icone.svg', out: `${res}/mipmap-${density}/ic_launcher.png`, size: 48 * scale });
  targets.push({ svg: 'aldus-icone-redondo.svg', out: `${res}/mipmap-${density}/ic_launcher_round.png`, size: 48 * scale });
  targets.push({ svg: 'aldus-icone-frente.svg', out: `${res}/mipmap-${density}/ic_launcher_foreground.png`, size: 108 * scale });
  targets.push({ svg: 'aldus-abertura.svg', out: `${res}/drawable-${density}/splashscreen_logo.png`, size: 288 * scale });
}
targets.push({ svg: 'aldus-icone.svg', out: 'assets/brand/icon-512.png', size: 512 });
targets.push({ svg: 'aldus-icone-redondo.svg', out: 'assets/brand/favicon.png', size: 196 });

fs.mkdirSync(path.join(root, 'assets/brand'), { recursive: true });
for (const [name, svg] of Object.entries(svgs)) fs.writeFileSync(path.join(root, 'assets/brand', name), svg + '\n');

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'aldus-brand-'));
const chrome = browserPath();
for (const target of targets) {
  const size = Math.round(target.size);
  const html = path.join(work, 'shot.html');
  fs.writeFileSync(html, `<!doctype html><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital@0;1&display=block" rel="stylesheet"><style>html,body{margin:0;background:transparent}img,svg{display:block}</style><div style="width:${size}px;height:${size}px">${svgs[target.svg].replace('<svg ', `<svg width="${size}" height="${size}" `)}</div>`);
  const out = path.join(root, target.out);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  cp.execFileSync(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${path.join(work, 'profile')}`, '--hide-scrollbars', '--force-device-scale-factor=1',
    '--default-background-color=00000000', `--window-size=${size},${size}`, '--virtual-time-budget=4000', `--screenshot=${out}`, 'file:///' + html.split(path.sep).join('/')], { stdio: 'ignore' });
  if (!fs.existsSync(out) || fs.statSync(out).size === 0) throw new Error('Falhou: ' + target.out);
}
fs.rmSync(work, { recursive: true, force: true });
console.log(`OK ${targets.length} imagens e ${Object.keys(svgs).length} fontes SVG da marca Aldus.`);
