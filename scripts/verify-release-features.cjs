#!/usr/bin/env node
'use strict';
// Checagem de entrega (pedido do dono em 16/11/2026: "garanta que o app estará exatamente do jeito que solicitei, não deixe faltar
// nada"). Cada item pedido ao longo do projeto tem marcadores que só existem no app quando o recurso está lá: um texto da tela, uma
// rota ou um trecho do documento do Reader. O APK ou o site exportado só pode ser entregue se TODOS aparecerem no pacote gerado.
//
//   node scripts/verify-release-features.cjs --source        confere a lista contra o código (roda na matriz crítica)
//   node scripts/verify-release-features.cjs --apk CAMINHO   confere o bundle Hermes, os livros e o manifesto de um APK
//   node scripts/verify-release-features.cjs --dist          confere os bundles do site em dist/ (depois de npm run export:web)
//
// Recurso novo pedido pelo dono entra nesta lista no mesmo commit que o implementa. Remover um item exige pedido do dono.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const cp = require('node:child_process');

const root = path.resolve(__dirname, '..');
const FEATURES = [
  // Reader
  { id: 'reader-panel', pedido: 'Redesenho 10/11: painel de ajustes reorganizado', markers: ['Ajustes de leitura', 'Mais ajustes: '] },
  { id: 'reader-theme-auto', pedido: 'Onda A3: tema automático', markers: ['Tema automático: seguir claro e escuro do app'] },
  { id: 'reader-justify', pedido: 'Onda B3: texto justificado', markers: ['Justificado'] },
  { id: 'reader-time-left', pedido: 'Onda B4: tempo restante no capítulo', markers: [' neste capítulo'] },
  { id: 'reader-read-aloud', pedido: 'Onda C1: ouvir em voz alta', markers: ['Ouvir a partir desta página'] },
  { id: 'reader-legible-font', pedido: 'FASE 1: fonte Alta legibilidade', markers: ['Alta legibilidade (Verdana)'] },
  { id: 'reader-focus', pedido: 'FASE 2: Ler em foco, resumo e Não perturbe', markers: ['Ler em foco por', 'Mostrar resumo ao terminar o foco', 'Abrir Não perturbe do Android'] },
  { id: 'reader-milestones', pedido: 'FASE 5b: marcos de leitura', markers: ['Marcos de leitura', 'Compartilhar cronograma'] },
  { id: 'reader-security', pedido: 'Segurança 15/11: CSP com nonce e pdf.js sem eval', markers: ["script-src 'nonce-"], androidMarkers: ['isEvalSupported'] },
  // Biblioteca e importação
  { id: 'library-continue', pedido: 'Onda A2: Continue lendo', markers: ['Continue lendo'] },
  { id: 'library-first-steps', pedido: 'Onda A5: primeiros passos', markers: ['Primeiros passos'] },
  { id: 'library-open-with', pedido: 'Onda C3: Abrir com Aldus', markers: ['Importando para a sua Biblioteca…'], routes: ['open-file'] },
  { id: 'import-duplicate', pedido: 'FASE 1: aviso de livro duplicado', markers: ['Este livro já está na biblioteca', 'Importar outra cópia'] },
  { id: 'import-reattach', pedido: 'Acervo etapa 2: reanexar o mesmo arquivo', markers: ['Livro restaurado'] },
  // Estudo
  { id: 'study-flashcard-from-highlight', pedido: 'Onda A1: flashcard a partir do grifo', markers: ['Criar flashcard deste grifo'] },
  { id: 'study-pinned', pedido: 'FASE 3 A1: fixar trechos', markers: ['Fixar trecho', 'Desafixar trecho', 'Fixado · '] },
  { id: 'study-all-annotations', pedido: 'FASE 3 A2: todas as anotações', markers: ['Todas as anotações', 'Buscar em trechos, notas e livros'], routes: ['annotations'] },
  { id: 'reading-diary', pedido: 'FASE 3 B1: diário de leitura', markers: ['Diário de leitura', 'Mostrar minutos de leitura'], routes: ['diary'] },
  { id: 'goodreads-csv', pedido: 'FASE 3 B2: CSV no padrão Goodreads', markers: ['Exportar CSV (Goodreads)', 'Exclusive Shelf'] },
  { id: 'study-history', pedido: 'Onda A4: histórico de revisão', markers: ['Seu histórico de revisão'] },
  { id: 'study-reminder', pedido: 'Onda C2: lembrete de revisão', markers: ['Lembrete diário'], androidMarkers: ['Lembrete de revisão'] },
  // Comunidade (rede social)
  { id: 'community-tab', pedido: '16/11: aba Comunidade na barra principal', markers: ['Comunidade'], routes: ['(tabs)/community'] },
  { id: 'community-people', pedido: 'Community Etapa 2: Pessoas e perfis', markers: ['Encontrar leitores', 'Publicar perfil como', 'Pedidos para seguir você', 'Retirar meu perfil da rede', 'Denunciar @'], routes: ['community/people', 'community/reader/[username]'] },
  { id: 'community-server', pedido: 'Community Etapa 2: grafo social no servidor', markers: ['community_find_reader', 'community_follow', 'community_report'] },
  // Termos
  { id: 'legal-antipiracy', pedido: 'FASE 1: texto antipirataria nos termos', markers: ['não vende nem empresta livros'] },
];

function fail(lines) { for (const line of lines) console.error(`FALTA ${line}`); process.exitCode = 1; }
// Hermes guarda texto acentuado em UTF-16; o JS minificado da Web escreve "á" como \xe1 ou á. Procura todas as formas.
const BACKSLASH = String.fromCharCode(92);
const jsEscaped = (text, short, upper) => [...text].map(ch => {
  const code = ch.codePointAt(0);
  if (code < 0x80 || code > 0xffff) return ch;
  const hex = short && code < 0x100 ? 'x' + code.toString(16).padStart(2, '0') : 'u' + code.toString(16).padStart(4, '0');
  return BACKSLASH + (upper ? hex[0] + hex.slice(1).toUpperCase() : hex);
}).join('');
const forms = text => [...new Set([text, jsEscaped(text, true, false), jsEscaped(text, false, false), jsEscaped(text, true, true), jsEscaped(text, false, true)])];
const has = (buffer, text) => buffer.includes(Buffer.from(text, 'utf16le')) || forms(text).some(form => buffer.includes(Buffer.from(form, 'utf8')));
const routeMarker = route => `./${route}.tsx`;

function sourceFiles() {
  const out = [];
  for (const dir of ['src', 'app']) {
    const pending = [path.join(root, dir)];
    while (pending.length) {
      const current = pending.pop();
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) pending.push(full);
        else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
      }
    }
  }
  return out;
}

function checkSource() {
  const corpus = Buffer.from(sourceFiles().map(file => fs.readFileSync(file, 'utf8')).join('\n'), 'utf8');
  const missing = [];
  const ids = new Set();
  for (const feature of FEATURES) {
    if (ids.has(feature.id)) missing.push(`${feature.id}: id repetido`); ids.add(feature.id);
    if (!feature.markers.length) missing.push(`${feature.id}: sem marcador`);
    for (const marker of [...feature.markers, ...(feature.androidMarkers ?? [])]) if (!has(corpus, marker)) missing.push(`${feature.id} (${feature.pedido}): texto "${marker}" não está no código`);
    for (const route of feature.routes ?? []) if (!fs.existsSync(path.join(root, 'app', `${route}.tsx`))) missing.push(`${feature.id}: rota app/${route}.tsx não existe`);
  }
  if (missing.length) return fail(missing);
  console.log(`PASS lista de entrega: ${FEATURES.length} recursos pedidos, todos com marcadores presentes no código e rotas existentes.`);
}

function checkBundle(buffer, label, android) {
  const missing = [];
  for (const feature of FEATURES) {
    for (const marker of [...feature.markers, ...(android ? feature.androidMarkers ?? [] : [])]) if (!has(buffer, marker)) missing.push(`${feature.id} (${feature.pedido}): "${marker}" não está no ${label}`);
    for (const route of feature.routes ?? []) if (!has(buffer, routeMarker(route))) missing.push(`${feature.id} (${feature.pedido}): rota ${route} não está no ${label}`);
  }
  return missing;
}

function sdkTool(name) {
  const props = path.join(root, 'android', 'local.properties');
  const sdk = fs.existsSync(props) ? (fs.readFileSync(props, 'utf8').match(/^sdk\.dir=(.*)$/m)?.[1] ?? '').trim().replace(/\\:/g, ':').replace(/\\\\/g, '/') : process.env.ANDROID_HOME;
  if (!sdk) return null;
  const tools = path.join(sdk, 'build-tools');
  if (!fs.existsSync(tools)) return null;
  for (const version of fs.readdirSync(tools).sort().reverse()) {
    const candidate = path.join(tools, version, process.platform === 'win32' ? `${name}.exe` : name);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function unzipEntries(apk, pattern, target) {
  try { cp.execFileSync('unzip', ['-q', '-o', apk, ...pattern, '-d', target], { stdio: 'ignore' }); return true; }
  catch { try { cp.execFileSync('tar', ['-xf', apk, '-C', target, ...pattern], { stdio: 'ignore' }); return true; } catch { return false; } }
}

function checkApk(apk) {
  if (!apk || !fs.existsSync(apk)) return fail([`APK não encontrado: ${apk}`]);
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'aldus-release-check-'));
  const missing = [];
  try {
    unzipEntries(apk, ['assets/index.android.bundle'], work);
    const bundlePath = path.join(work, 'assets', 'index.android.bundle');
    if (!fs.existsSync(bundlePath)) return fail(['assets/index.android.bundle não foi extraído do APK (o JS não está empacotado)']);
    missing.push(...checkBundle(fs.readFileSync(bundlePath), 'bundle do APK', true));
    // Livros: exatamente o acervo ativo em domínio público; nenhum título do acervo antigo.
    const listing = cp.execFileSync('unzip', ['-Z1', apk], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split(/\r?\n/).filter(name => /^res\/.*\.(pdf|epub)$/i.test(name));
    if (listing.length) unzipEntries(apk, listing, work);
    const active = JSON.parse(fs.readFileSync(path.join(root, 'src/data/library/bundledBookManifest.json'), 'utf8'));
    const legacy = JSON.parse(fs.readFileSync(path.join(root, 'src/data/library/legacyBundledAssets.json'), 'utf8'));
    const hashes = listing.map(name => crypto.createHash('sha256').update(fs.readFileSync(path.join(work, name))).digest('hex'));
    for (const [index, hash] of hashes.entries()) {
      if (legacy.some(item => item.hash === hash)) missing.push(`acervo: título protegido dentro do APK (${listing[index]})`);
      else if (!active.some(item => item.hash === hash)) missing.push(`acervo: livro não declarado dentro do APK (${listing[index]})`);
    }
    for (const item of active) if (!hashes.includes(item.hash)) missing.push(`acervo: livro em domínio público ausente do APK (${item.fileName})`);
    // Manifesto: permissões e backup decididos pelo dono.
    const aapt = sdkTool('aapt');
    if (!aapt) missing.push('aapt não encontrado (android/local.properties ou ANDROID_HOME): manifesto não conferido');
    else {
      const badging = cp.execFileSync(aapt, ['dump', 'badging', apk], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
      const tree = cp.execFileSync(aapt, ['dump', 'xmltree', apk, 'AndroidManifest.xml'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
      if (/SYSTEM_ALERT_WINDOW/.test(badging)) missing.push('manifesto: permissão SYSTEM_ALERT_WINDOW de volta no release');
      if (/application-debuggable/.test(badging)) missing.push('manifesto: APK depurável');
      if (!/android:allowBackup\([^)]*\)=\(type 0x12\)0x0/.test(tree)) missing.push('manifesto: allowBackup não está desligado');
      if (!/android:dataExtractionRules/.test(tree)) missing.push('manifesto: dataExtractionRules ausente (transferência entre aparelhos)');
    }
  } finally { fs.rmSync(work, { recursive: true, force: true }); }
  if (missing.length) return fail(missing);
  console.log(`PASS APK ${path.basename(apk)}: ${FEATURES.length} recursos pedidos presentes no bundle, só o acervo em domínio público, manifesto conforme.`);
}

function checkDist() {
  const dir = path.join(root, 'dist');
  if (!fs.existsSync(dir)) return fail(['dist/ não existe: rode npm run export:web antes']);
  const chunks = [];
  const pending = [dir];
  while (pending.length) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(full);
      else if (entry.name.endsWith('.js')) chunks.push(fs.readFileSync(full));
    }
  }
  const missing = checkBundle(Buffer.concat(chunks), 'site exportado', false);
  if (missing.length) return fail(missing);
  console.log(`PASS site exportado: ${FEATURES.length} recursos pedidos presentes nos bundles de dist/.`);
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--apk')) checkApk(args[args.indexOf('--apk') + 1]);
  else if (args.includes('--dist')) checkDist();
  else checkSource();
}
module.exports = { FEATURES, checkBundle, has };
