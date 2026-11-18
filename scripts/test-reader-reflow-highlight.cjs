// Highlights in the Leitura Livre (owner's report, 18/11/2026: "não consigo grifar"). A long PDF goes through the real Reflow builder
// (buildPdfReflowDocument → toStoredReflowChapters) into the real reader document in Chromium. On sampled pages, press-and-hold
// captures the word with a Reflow chapter id; the highlight is saved with mode "pdf-reflow" and drawn back; after reopening the
// document (as a new preparation would), "Ir ao grifo" finds it. Not a device test: Android touch and handles need the phone.
const assert = require('node:assert/strict'), cp = require('node:child_process'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const ts = require('typescript');
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file); const exports = {}; cache.set(file, exports);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'exports', code)(name => {
    if (name.startsWith('@/') || name.startsWith('.')) { const base = name.startsWith('@/') ? name.slice(2) : path.posix.join(path.posix.dirname(file), name); for (const ext of ['.ts', '.tsx']) if (fs.existsSync(base + ext)) return load(base + ext); }
    return require(name);
  }, exports); return exports;
}
const { createEpubReaderDocument } = load('src/presentation/components/EpubReaderDocument.ts');
const { buildPdfReflowDocument, toStoredReflowChapters } = load('src/data/local/PdfReflowDocumentBuilder.ts');
const { createStudyHighlight, readHighlightLocation, highlightsForReaderMode } = load('src/domain/usecases/StudyHighlights.ts');
const words = 'nao hesito em afirmar que os leitores tem em maos a grande biografia de conjunto fascinante trajetoria intelectual relevancia reflexao critica'.split(' ');
let seed = 11; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const line = () => Array.from({ length: 9 + Math.floor(rnd() * 4) }, () => words[Math.floor(rnd() * words.length)]).join(' ');
const pages = Array.from({ length: 60 }, (_, p) => ({ pageNumber: p + 1, pageWidth: 500, pageHeight: 760, images: [],
  textItems: Array.from({ length: 34 }, (_, i) => ({ text: (i === 0 && p % 15 === 0 ? `Capítulo ${p / 15 + 1}` : line() + (i % 6 === 5 ? '.' : '')), x: 40, y: 720 - i * 20, width: 420, height: i === 0 && p % 15 === 0 ? 18 : 11 })) }));
const document = buildPdfReflowDocument(pages, pages.length);
const bookId = 'marx-like';
const chapters = toStoredReflowChapters(bookId, document);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  assert.ok(chapters.length >= 1 && chapters.every(c => c.id.startsWith(bookId + '-reflow-')), 'Reflow chapter ids');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'aldus-reflow-highlight-'));
  const chrome = cp.spawn(require('./browser-path.cjs').browserPath(), ['--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', '--allow-file-access-from-files', '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore' });
  let ws;
  try {
    let port; for (let i = 0; i < 150 && !port; i++) { try { port = fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch {} await wait(100); }
    assert(port, 'Chrome unavailable');
    const target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page');
    ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    let id = 0; const jobs = new Map(); ws.onmessage = ({ data }) => { const m = JSON.parse(data), j = jobs.get(m.id); if (j) { jobs.delete(m.id); j(m); } };
    const send = (method, params = {}) => new Promise(r => { const n = ++id; jobs.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
    const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); assert(!r.result.exceptionDetails, JSON.stringify(r.result.exceptionDetails)); return r.result.result.value; };
    await send('Page.enable'); await send('Emulation.setDeviceMetricsOverride', { width: 392, height: 780, deviceScaleFactor: 2.75, mobile: true });
    const open = async name => {
      const html = createEpubReaderDocument(chapters, { fontSize: 18, fontFamily: 'Georgia', marginSize: 24, lineHeight: 1.65, paragraphSpacing: 1, textColor: '#222222', backgroundColor: '#f5ebd9', allowTextSelection: true })
        .replace(/<script nonce="([^"]+)">/, '<script nonce="$1">window.messages=[];window.ReactNativeWebView={postMessage:function(x){messages.push(JSON.parse(x))}};');
      const file = path.join(profile, name); fs.writeFileSync(file, html);
      await send('Page.navigate', { url: 'file:///' + file.split(path.sep).join('/') });
      for (let i = 0; i < 100 && !(await evaluate('typeof window.readerStudy==="function" && (window.messages||[]).some(m=>m.type==="page"&&m.layoutReady)')); i++) await wait(100);
      return evaluate('messages.filter(m=>m.type==="page").at(-1).totalPages');
    };
    const total = await open('first.html');
    assert.ok(total >= 40, 'long Leitura Livre: ' + total);
    const helpers = `const study=id=>messages.filter(m=>m.type==='study'&&m.id===id).at(-1);
      const W=document.getElementById('reader-viewport').getBoundingClientRect().width;
      const visibleWord=()=>{const walker=document.createTreeWalker(document.getElementById('reader-content'),NodeFilter.SHOW_TEXT);let n;while(n=walker.nextNode()){const re=/[A-Za-z]{6,}/g;let m;while(m=re.exec(n.textContent)){const r=document.createRange();r.setStart(n,m.index);r.setEnd(n,m.index+m[0].length);const b=r.getBoundingClientRect();if(b.width>0&&b.left>8&&b.right<W-8&&b.top>60&&b.bottom<700)return {word:m[0],x:b.left+b.width/2,y:b.top+b.height/2};}}return null;};`;
    const saved = [], failures = [];
    for (let page = 2; page <= total; page += Math.max(1, Math.floor(total / 8))) {
      const r = await evaluate(`(async()=>{${helpers}window.goToPage(${page});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
        const w=visibleWord();if(!w)return {page:${page},skip:true};
        window.readerStudy({type:'studySelectAt',id:${page},x:w.x,y:w.y});const a=study(${page});window.readerStudy({type:'studySelection',id:${page}+5000,enabled:false});
        return {page:${page},word:w.word,status:a&&a.status,anchor:a&&a.anchor};})()`);
      if (r.skip) continue;
      if (r.status !== 'captured' || r.anchor.quote !== r.word || !r.anchor.chapterId.startsWith(bookId + '-reflow-')) { failures.push(r); continue; }
      saved.push(createStudyHighlight({ bookId, anchor: r.anchor, chapterTitle: 'Leitura Livre', color: 'pink', mode: 'pdf-reflow', id: 'h' + page, now: page }));
    }
    assert.deepEqual(failures, [], 'press-and-hold captures the word in a Reflow chapter on every sampled page');
    assert.ok(saved.length >= 5, 'sampled pages: ' + saved.length);
    assert.ok(saved.every(h => readHighlightLocation(h).mode === 'pdf-reflow'));
    const shown = highlightsForReaderMode(saved, 'pdf-reflow');
    const drawn = await evaluate(`(()=>{window.readerStudy({type:'studyRenderHighlights',id:-1,highlights:${JSON.stringify(shown)}});const d=messages.filter(m=>m.type==='study'&&m.id===-1).at(-1);return {status:d&&d.status,missing:d&&d.missing,ambiguous:d&&d.ambiguous};})()`);
    assert.deepEqual(drawn, { status: 'rendered', missing: 0, ambiguous: 0 }, 'every Leitura Livre highlight is drawn');
    // A new preparation of the same PDF builds the same chapters: reopen and go to the last highlight.
    await open('second.html');
    const last = readHighlightLocation(saved.at(-1)).anchor;
    const nav = await evaluate(`(async()=>{window.dispatchEvent(new MessageEvent('message',{data:{type:'completeInitialRestore'}}));window.readerStudy({type:'studyNavigate',id:777,anchor:${JSON.stringify(last)}});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const m=messages.filter(x=>x.type==='study'&&x.id===777).at(-1);return {status:m&&m.status,page:m&&m.pageNumber};})()`);
    assert.equal(nav.status, 'exact', '"Ir ao grifo" finds it after reopening'); assert.ok(nav.page > 1);
    console.log(`PASS Leitura Livre highlights: ${saved.length} pages of a ${total}-page Reflow document (real builder) captured by press-and-hold with Reflow chapter ids, saved as pdf-reflow, all drawn, found again after reopening. Chromium document; not a device test.`);
  } finally { ws?.close(); chrome.kill(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
