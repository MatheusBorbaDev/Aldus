// Highlight on every part of a long book (owner's report, 17/11/2026: "não funcionou da página 106 pra frente"). Real reader
// document in Chromium, a generated ~350-page book with headings, inline markup and many chapters. Every 7th page: press-and-hold
// selects exactly the word (never glued to a heading), still works with the engine's caret APIs unavailable and with the initial
// restore left pending; a dragged selection with element boundaries or spilling into the next chapter is captured; the saved
// highlight is drawn back without missing/ambiguous. Not a device test: Android handles and touch are confirmed on the Redmi.
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
const words = 'ao verme que primeiro roeu as frias carnes do meu cadáver dedico como saudosa lembrança estas memórias póstumas'.split(' ');
let seed = 3; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const sentence = () => Array.from({ length: 12 + Math.floor(rnd() * 14) }, () => words[Math.floor(rnd() * words.length)]).join(' ') + '.';
const para = i => `<p>${i % 5 === 0 ? `<em>${sentence()}</em> ` : ''}${Array.from({ length: 3 + Math.floor(rnd() * 3) }, sentence).join(' ')}${i % 7 === 0 ? ` <a href="#n${i}">nota</a>` : ''}</p>`;
const chapters = Array.from({ length: 14 }, (_, c) => ({ id: 'c' + c, title: 'Capítulo ' + (c + 1), html: `<h2>Capítulo ${c + 1}</h2>` + Array.from({ length: 40 }, (_, i) => para(i)).join('') }));
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'aldus-highlight-pages-'));
  const chrome = cp.spawn(require('./browser-path.cjs').browserPath(), ['--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', '--allow-file-access-from-files', '--user-data-dir=' + profile, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
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
    const html = createEpubReaderDocument(chapters, { fontSize: 18, fontFamily: 'Georgia', marginSize: 24, lineHeight: 1.65, paragraphSpacing: 1, textColor: '#222222', backgroundColor: '#f5ebd9' })
      .replace(/<script nonce="([^"]+)">/, '<script nonce="$1">window.messages=[];window.ReactNativeWebView={postMessage:function(x){messages.push(JSON.parse(x))}};');
    const file = path.join(profile, 'book.html'); fs.writeFileSync(file, html);
    await send('Page.navigate', { url: 'file:///' + file.split(path.sep).join('/') });
    for (let i = 0; i < 100 && !(await evaluate('typeof window.readerStudy==="function" && (window.messages||[]).some(m=>m.type==="page"&&m.layoutReady)')); i++) await wait(100);
    const total = await evaluate('messages.filter(m=>m.type==="page").at(-1).totalPages');
    assert.ok(total >= 300, 'long book: ' + total);
    const helpers = `const study=id=>messages.filter(m=>m.type==='study'&&m.id===id).at(-1);
      const W=document.getElementById('reader-viewport').getBoundingClientRect().width;
      const visibleWord=()=>{const walker=document.createTreeWalker(document.getElementById('reader-content'),NodeFilter.SHOW_TEXT);let n;while(n=walker.nextNode()){const re=/[A-Za-zÀ-ÿ]{5,}/g;let m;while(m=re.exec(n.textContent)){const r=document.createRange();r.setStart(n,m.index);r.setEnd(n,m.index+m[0].length);const b=r.getBoundingClientRect();if(b.width>0&&b.left>8&&b.right<W-8&&b.top>60&&b.bottom<700)return {word:m[0],x:b.left+b.width/2,y:b.top+b.height/2};}}return null;};`;
    const failures = [], pages = [];
    for (let page = 1; page <= total; page += 7) pages.push(page);
    if (!pages.includes(106)) pages.push(106);
    for (const page of pages) {
      const r = await evaluate(`(async()=>{${helpers}window.goToPage(${page});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
        const w=visibleWord();if(!w)return {page:${page},skip:true};const out={page:${page},word:w.word};
        const release=n=>window.readerStudy({type:'studySelection',id:n,enabled:false});
        window.readerStudy({type:'studySelectAt',id:${page}*10+1,x:w.x,y:w.y});const a=study(${page}*10+1);out.press=a&&a.status==='captured'&&a.anchor.quote===w.word;release(1);
        const caret=document.caretRangeFromPoint,position=document.caretPositionFromPoint;document.caretRangeFromPoint=()=>null;document.caretPositionFromPoint=()=>null;
        window.readerStudy({type:'studySelectAt',id:${page}*10+2,x:w.x,y:w.y});const b=study(${page}*10+2);out.fallback=b&&b.status==='captured'&&b.anchor.quote===w.word;release(2);
        document.caretRangeFromPoint=caret;document.caretPositionFromPoint=position;
        window.dispatchEvent(new MessageEvent('message',{data:{type:'beginInitialRestore'}}));
        window.readerStudy({type:'studySelectAt',id:${page}*10+3,x:w.x,y:w.y});const c=study(${page}*10+3);out.duringRestore=c&&c.status==='captured';release(3);
        window.dispatchEvent(new MessageEvent('message',{data:{type:'completeInitialRestore'}}));
        if(a&&a.anchor){window.readerStudy({type:'studyRenderHighlights',id:-1,highlights:[{id:'h',chapterId:a.anchor.chapterId,startCfi:JSON.stringify({format:'kindle-study-highlight',version:1,anchor:a.anchor,chapterTitle:'',note:''}),endCfi:'',highlightedText:a.anchor.quote,colorLabel:'yellow',createdAt:1}]});
          const d=messages.filter(m=>m.type==='study'&&m.id===-1).at(-1);out.drawn=d&&d.status==='rendered'&&!d.missing&&!d.ambiguous;}
        return out;})()`);
      if (r.skip) continue;
      if (!(r.press && r.fallback && r.duringRestore && r.drawn)) failures.push(r);
    }
    assert.deepEqual(failures, [], 'press-and-hold, engine fallback, pending restore and drawn highlight on every sampled page');
    // Dragged selections: element boundaries (Android handles at paragraph edges) and spilling into the next chapter.
    const drag = await evaluate(`(async()=>{${helpers}const sleep=ms=>new Promise(r=>setTimeout(r,ms)),out={};
      const sections=document.querySelectorAll('#reader-content .epub-chapter');
      window.readerStudy({type:'studySelection',id:9001,enabled:true});
      const p=sections[7].querySelectorAll('p')[10],q=sections[7].querySelectorAll('p')[11];
      let r=document.createRange();r.setStart(p,0);r.setEnd(q,0);getSelection().removeAllRanges();getSelection().addRange(r);await sleep(900);
      let m=study(9001);out.elements={status:m&&m.status,ok:!!m&&m.anchor&&m.anchor.quote===p.textContent.trim()};
      window.readerStudy({type:'studySelection',id:9002,enabled:true});
      const lastP=sections[8].querySelectorAll('p')[39],nextHead=sections[9].querySelector('h2');
      r=document.createRange();r.setStart(lastP.firstChild,0);r.setEnd(nextHead.firstChild,4);getSelection().removeAllRanges();getSelection().addRange(r);await sleep(900);
      m=study(9002);out.crossChapter={status:m&&m.status,chapter:m&&m.anchor&&m.anchor.chapterId,endsWith:m&&m.anchor&&lastP.textContent.trim().endsWith(m.anchor.quote.slice(-20))};
      window.readerStudy({type:'studySelection',id:9003,enabled:false});return out;})()`);
    assert.deepEqual(drag.elements, { status: 'captured', ok: true }, 'selection whose edges are paragraph elements is captured whole');
    assert.equal(drag.crossChapter.status, 'captured', 'selection spilling into the next chapter is captured'); assert.equal(drag.crossChapter.chapter, 'c8'); assert.equal(drag.crossChapter.endsWith, true, 'clamped to the end of its chapter');
    console.log(`PASS highlight on every part of a ${total}-page book (${pages.length} pages sampled, page 106 included): press-and-hold word without heading glue, engine caret fallback, pending restore, drawn highlight; dragged selection with element edges and across chapters. Chromium document; not a device test.`);
  } finally { ws?.close(); chrome.kill(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
