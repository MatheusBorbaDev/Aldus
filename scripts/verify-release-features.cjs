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
  { id: 'app-palettes', pedido: '16/11: tema Clássico e Moderno (Petróleo, Azul-tinta)', markers: ['Moderno · Petróleo', 'Moderno · Azul-tinta', '@aldus/app-palette.v1'] },
  { id: 'reader-paper-texture', pedido: '16/11: textura de papel nas páginas', markers: ['Textura do papel', 'Papel envelhecido', 'updateSurface'] },
  { id: 'reader-highlight-popup', pedido: '16/11: grifo por pressionar, pop-up e ajuste do trecho (compacto em 18/11)', markers: ['Palavra depois', 'Tirar a última', 'Tirar a primeira', 'Ajustar trecho', 'Frase inteira', 'studySelectAt', 'selectionchange'] },
  { id: 'reader-quote-card', pedido: '16/11: card de trecho para Stories e X (imagem, 400 caracteres); 18/11: capa e capítulo', markers: ['Compartilhar trecho', 'Compartilhar imagem', 'Stories 9:16', 'Mostrar título e autor', 'Mostrar capa', 'Mostrar capítulo', 'renderQuoteCard'], androidMarkers: ['public.jpeg'] },
  { id: 'reader-page-turn', pedido: '16/11: animação de virar página (Folhear) e Sem animação', markers: ['Virar página', 'Folhear', 'Sem animação', 'updateMotion', 'prefers-reduced-motion: reduce'] },
  { id: 'reader-epub-scroll', pedido: '16/11: rolagem contínua (EPUB e Leitura Livre)', markers: ['updateFlow', 'reader-scroll', 'longPress'] },
  { id: 'reader-pdf-scroll', pedido: '16/11: rolagem contínua (PDF Original, fatia 1)', markers: ['Passar página', 'Rolar para baixo', 'Virar páginas', 'createPdfScroller'] },
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
  { id: 'catalog-google-books', pedido: '19/11: catálogo com edições brasileiras (Google Books + Open Library), busca enquanto digita, sinopse e ano da edição', markers: ['Google Books e Open Library', 'Informações: ', 'Sinopse', 'Edição de ', 'gbs_api'] },
  { id: 'catalog-import-offer', pedido: '19/11: depois de importar um arquivo, buscar as informações no catálogo (só com o toque) e ficha com Ler livro e capa ao fundo', markers: ['Buscar informações no catálogo', 'coverBackdrop', 'Ler livro'] },
  { id: 'diary-calendar', pedido: '19/11: calendário de leitura com a capa no dia lido (privado, sem contadores)', markers: ['A capa aparece no dia em que você leu', 'Mostrar todos os dias', 'Mês anterior'] },
  { id: 'loading-quotes', pedido: '19/11: mais frases de domínio público, sorteadas a cada abertura do app', markers: ['Mar Português', 'Canção do Exílio', 'Língua Portuguesa'] },
  { id: 'catalog-portuguese-edition', pedido: '19/11: catálogo procura a edição brasileira (português primeiro, livros do mesmo autor em português)', markers: ['langRestrict', 'inauthor:'] },
  { id: 'reader-search-goto', pedido: '20/11: a busca no livro leva até o trecho (painel fecha) e repetir vai ao próximo', markers: ['Busque de novo para ir ao próximo'] },
  { id: 'drive-file-shortcuts', pedido: '20/11: livros do Drive que são atalhos (compartilhados) entram na fonte e baixam pelo destino', markers: ['shortcutId'] },
  { id: 'reader-paged-longpress-edges', pedido: '20/11: grifar ao pressionar e segurar na primeira e na última linha da página em Virar páginas', markers: ['isScrollFlow() && isAnimating'] },
  { id: 'reader-longpress-drag', pedido: '23/11: depois de pressionar e segurar, arrastar o dedo estende o grifo palavra a palavra (sem depender dos botoes)', markers: ['studyDragTo', 'studyDragBegin'] },
  { id: 'desktop-shell', pedido: '23/11: modulo PC na Web (janela larga e mouse): barra lateral propria com busca e estado do sincronismo; celular intacto', markers: ['Buscar livros no catálogo', 'Abrir sincronização na Conta'] },
  { id: 'desktop-library', pedido: '23/11: Biblioteca do PC: painel de detalhes, clique duplo abre, Ctrl/Shift selecionam, soltar EPUB/PDF importa', markers: ['Detalhes do livro', 'Solte para importar', 'Fechar painel'] },
  { id: 'desktop-reader-spread', pedido: '23/11: leitor do PC com duas paginas lado a lado (janela >= 1100, modo pagina) e atalhos Espaco/Page Up/Page Down', markers: ['reader-spread', 'PageDown'] },
  { id: 'desktop-reader-side-panels', pedido: '23/11: no PC, sumario a esquerda e ajustes, busca e marcacoes a direita em altura inteira, sem mudar a pagina', markers: ['desktopSheetStyles'] },
  { id: 'discover-catalog-tab', pedido: '19/11: aba Descobrir vira o catalogo (vitrine, Sortear um livro, Suas fontes); sem Gutendex/BibliON/MEC', markers: ['Sortear um livro', 'abrir seus arquivos por aqui', 'Calculado neste aparelho'] },
  { id: 'library-tab-scroll-top', pedido: '19/11: tocar na aba Biblioteca, já nela, volta ao início da lista', markers: ['library-book-list'] },
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
  { id: 'focus-card', pedido: 'FASE 3 C: cartão de foco', markers: ['Cartão de foco', 'Compartilhar cartão', 'Incluir estimativa de páginas'] },
  { id: 'study-history', pedido: 'Onda A4: histórico de revisão', markers: ['Seu histórico de revisão'] },
  { id: 'study-reminder', pedido: 'Onda C2: lembrete de revisão', markers: ['Lembrete diário'], androidMarkers: ['Lembrete de revisão'] },
  // Comunidade (rede social)
  { id: 'community-tab', pedido: '16/11: aba Comunidade na barra principal', markers: ['Comunidade'], routes: ['(tabs)/community'] },
  { id: 'community-people', pedido: 'Community Etapa 2: Pessoas e perfis', markers: ['Encontrar leitores', 'Publicar perfil como', 'Pedidos para seguir você', 'Retirar meu perfil da rede', 'Denunciar @'], routes: ['community/people', 'community/reader/[username]'] },
  { id: 'community-server', pedido: 'Community Etapa 2: grafo social no servidor', markers: ['community_find_reader', 'community_follow', 'community_report'] },
  { id: 'community-clubs', pedido: 'Community Etapa 3: clubes por convite e marcos', markers: ['Abrir clubes', 'Entrar no clube', 'Criar um clube', 'Até onde você leu', 'Publicar comentário', 'Gerar novo código', 'community_join_club'], routes: ['community/clubs', 'community/club/[id]'] },
  { id: 'community-forums', pedido: 'Community Etapa 3: fóruns com spoiler e moderação', markers: ['Abrir fóruns', 'Publicar tópico', 'Contém spoiler · mostrar', 'Enviar denúncia', 'community_report_content'], routes: ['community/forums', 'community/thread/[id]'] },
  // Termos
  { id: 'drive-renewal', pedido: '18/11: Drive sem reconectar a toda hora (renovação silenciosa, mesma conta Google)', markers: ['account-mismatch', 'Esta biblioteca foi conectada com outra conta Google'] },
  { id: 'drive-folder-picker', pedido: '18/11: escolher a pasta do Drive navegando, sem colar link', markers: ['Escolha uma pasta', 'Compartilhados comigo', 'Prefiro colar o link de uma pasta'] },
  { id: 'loading-continue', pedido: '18/11: frase de abertura espera o botao Continuar', markers: ['Continuar', "O livro caindo n'alma"] },
  { id: 'record-books-sync', pedido: '18/11: livro sem arquivo em todos os aparelhos (migration 20261118120000)', markers: ['quando a biblioteca sincronizar'] },
  { id: 'goodreads-import', pedido: '18/11: importar estante do Goodreads (CSV) com revisao', markers: ['Importar do Goodreads', 'Export Library', 'Desmarcar todos'], routes: ['import/goodreads'] },
  { id: 'manual-progress', pedido: '18/11: progresso manual de livro sem arquivo (pagina ou porcentagem)', markers: ['Total de p', 'Porcentagem', 'Quanto voc'] },
  { id: 'rating-review', pedido: '18/11: nota e resenha pessoais na ficha do livro', markers: ['de 5', 'Toque de novo para tirar a nota'] },
  { id: 'catalog-link', pedido: '18/11: ligar livro importado ao catalogo (juntar com o livro guardado sem arquivo)', markers: ['Manter separados', 'Ligar ao cat', 'catalog-link-dismissed'] },
  { id: 'catalog-shelves', pedido: '18/11: vitrine do catalogo com categorias e Para voce calculado no aparelho', markers: ['Calculado neste aparelho', 'Mais categorias', 'Voltar ', 'subject:fantasy'] },
  { id: 'native-file-hash', pedido: '18/11: assinatura do arquivo nativa no Android (lentidao relatada por usuarios externos)', markers: [], androidMarkers: ['AldusFileHash'] },
  { id: 'reflow-preview', pedido: '18/11: ler o início do PDF enquanto a Leitura Livre é preparada', markers: ['Começar a ler o início', 'Fim do trecho disponível'] },
  { id: 'reflow-highlight', pedido: '18/11: grifar na Leitura Livre do PDF (relato de usuarios externos)', markers: ['Abra a Leitura Livre para ir'] },
  { id: 'catalog-search', pedido: '18/11: buscar qualquer livro no catalogo e guardar sem arquivo (Quero ler)', markers: ['Buscar qualquer livro', 'Buscar no cat', 'x.aldus-record', 'Quero ler'], routes: ['catalog'] },
  { id: 'library-catalog-offer', pedido: '19/11: busca da Biblioteca sem resultado leva ao catalogo ("a biblioteca como catalogo nao ta funcionando")', markers: ['Procurar no cat', 'não está na sua biblioteca'] },
  { id: 'default-cover', pedido: '18/11: capa padrao Aldus para livro sem capa (aprovada)', markers: ['terracota', '#8A3B25', 'trelica'] },
  { id: 'drive-quiet-header', pedido: '18/11: Drive "feio, dificil de acessar": aviso numa faixa fina e ordenacao num menu', markers: ['Reconecte o Google Drive para atualizar.', 'Os livros já listados continuam aqui.'] },
  { id: 'build-revision', pedido: '18/11: "nao mudou nada": cada APK mostra o commit em Ajustes > Versao', markers: [], androidMarkers: ['[0-9a-f]{7,12}'] },
  { id: 'release-notes', pedido: '18/11: aviso de novidades com aviso de beta e link para as limitações', markers: ['Novidades do Aldus', 'O que esperar desta beta', 'release-notes-seen'], routes: ['beta'] },
  { id: 'loading-quote', pedido: '18/11: frase de livro na tela de carregamento', markers: ["O livro caindo n'alma", 'Castro Alves'] },
  { id: 'account-delete', pedido: '17/11: excluir conta no app (betas públicas)', markers: ['Excluir conta', 'EXCLUIR MINHA CONTA', 'Continuar para a exclusão', 'account-delete'], routes: ['account/delete'] },
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
    // Only-Android items (a native module) carry androidMarkers alone: checked in the APK, never required in the site.
    if (!feature.markers.length && !feature.androidMarkers?.length) missing.push(`${feature.id}: sem marcador`);
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
      // Ícone Aldus (pedido "pode ser" para a logo, 18/11): adaptativo, com monocromático, fundo azul-noite.
      const icon = [...badging.matchAll(/application-icon-\d+:'([^']+)'/g)].at(-1)?.[1];
      let iconTree = ''; // an image icon (not adaptive XML) makes aapt fail: that is the old, non-brand icon
      try { if (icon) iconTree = cp.execFileSync(aapt, ['dump', 'xmltree', apk, icon], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }); } catch { iconTree = ''; }
      const resources = cp.execFileSync(aapt, ['dump', 'resources', apk], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
      const background = resources.match(/resource (0x[0-9a-f]+) [\w.]+:color\/iconBackground: t=0x1d d=0xff1b1c30/)?.[1];
      if (!/adaptive-icon/.test(iconTree) || !/E: monochrome/.test(iconTree) || !background || !iconTree.includes(`=@${background}`))
        missing.push('brand-icon (18/11: ícone Aldus adaptativo, monocromático, fundo azul-noite): ícone do app não é o da marca');
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
