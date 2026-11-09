// Library re-render measurement (quality wave 2, P1). Real Library screen + BookCard in the isolated Chromium fixture of
// test-library-bulk-web (synthetic books, no account data). Counts BookCard renders per interaction through a React
// DevTools-style commit hook. A BookCard rendered in a commit when its committed fiber object differs from the previous
// commit (React alternates current/alternate on render; a bailed-out subtree keeps the same objects; stale PerformedWork
// flags make the flag unreliable for that) and the wall time until two frames after the interaction.
// Not a test gate and not an Android/Hermes measurement. Usage: node scripts/measure-library-renders.cjs [label] [count]
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process'), http = require('http'), assert = require('assert/strict');
const wait = ms => new Promise(r => setTimeout(r, ms));
const label = process.argv[2] || 'run', count = Number(process.argv[3] || 1000);
(async () => {
  cp.execFileSync(process.execPath, ['scripts/build-library-bulk-web-fixture.cjs'], { stdio: 'inherit' });
  const out = path.resolve('.expo/cycle2-library-web');
  const server = http.createServer((req, res) => { if (req.url === '/matrix.js') { res.setHeader('Content-Type', 'text/javascript'); fs.createReadStream(path.join(out, 'matrix.js')).pipe(res); } else { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{margin:0;width:100%;height:100%}*{box-sizing:border-box}#root{display:flex}</style><div id="root"></div><script src="/matrix.js"></script></html>'); } });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'aldus-library-renders-'));
  const chrome = cp.spawn(require('./browser-path.cjs').browserPath(), ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + profile, '--no-first-run', '--no-default-browser-check', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let ws;
  try {
    let port; for (let i = 0; i < 120; i++) { try { port = fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]; if (port) break; } catch {} await wait(150); } assert(port);
    const tabs = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json(); ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
    let id = 0; const pending = new Map();
    ws.onmessage = event => { const m = JSON.parse(event.data); if (m.id) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(Error(m.error.message)) : p.resolve(m.result); } };
    const send = (method, params = {}) => new Promise((resolve, reject) => { const key = ++id; pending.set(key, { resolve, reject }); ws.send(JSON.stringify({ id: key, method, params })); });
    const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
    // Commit hook: count BookCard fibers that performed work (rendered) in each committed tree.
    await send('Page.enable');
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__renders={bookCard:0,commits:0};window.__REACT_DEVTOOLS_GLOBAL_HOOK__={supportsFiber:true,renderers:new Map(),inject(){return 1},checkDCE(){},onScheduleFiberRoot(){},onCommitFiberUnmount(){},onPostCommitFiberRoot(){},onCommitFiberRoot(_id,root){const now=new Set(),prev=window.__cards||new Set();const stack=[root.current];while(stack.length){const f=stack.pop();const t=f.type;const name=t&&(t.displayName||t.name||(t.type&&(t.type.displayName||t.type.name)));if(name==='BookCard'){now.add(f);if(!prev.has(f))window.__renders.bookCard++;}if(f.child)stack.push(f.child);if(f.sibling)stack.push(f.sibling);}window.__cards=now;window.__renders.commits++;}};` });
    await send('Runtime.enable'); await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: 'http://127.0.0.1:' + server.address().port + '/' });
    for (let i = 0; i < 100 && !(await evaluate('Boolean(window.fixture&&window.fixture.records)')); i++) await wait(100);
    await evaluate(`window.fixture.resize(${count})`); await wait(800);
    const frames = 'new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())))';
    const measure = async (name, action, settle = 400) => {
      await wait(300);
      const result = await evaluate(`(async()=>{window.__renders.bookCard=0;window.__renders.commits=0;const t=performance.now();${action};await ${frames};const ms=performance.now()-t;await new Promise(r=>setTimeout(r,${settle}));return {ms:Math.round(ms*10)/10,bookCardRenders:window.__renders.bookCard,commits:window.__renders.commits,visibleCards:document.querySelectorAll('[aria-label^="Abrir Livro sintético"],[aria-label^="Selecionar Livro sintético"]').length};})()`);
      return { name, ...result };
    };
    const typeQuery = value => `(()=>{const e=document.querySelector('[aria-label="Buscar livros por metadados"]');if(!e)throw Error('Missing search');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`;
    const click = target => `(()=>{const e=[...document.querySelectorAll('[role="button"],[role="checkbox"]')].find(e=>(e.getAttribute('aria-label')===${JSON.stringify(target)}||e.textContent===${JSON.stringify(target)})&&e.getBoundingClientRect().height>0);if(!e)throw Error('Missing '+${JSON.stringify(target)});e.click();})()`;
    const firstCheckbox = `(()=>{const e=document.querySelector('[role="checkbox"][aria-label^="Selecionar Livro sintético"]');if(!e)throw Error('Missing checkbox');e.click();})()`;
    const rows = [];
    rows.push(await measure('busca que mantém todos os livros ("Livro")', typeQuery('Livro')));
    rows.push(await measure('busca que filtra ("0001")', typeQuery('0001')));
    rows.push(await measure('limpar busca', typeQuery('')));
    rows.push(await measure('abrir menu "⋯"', click('Mais opções da biblioteca')));
    rows.push(await measure('entrar em seleção', click('Selecionar livros')));
    rows.push(await measure('marcar 1 livro', firstCheckbox));
    rows.push(await measure('desmarcar o mesmo livro', firstCheckbox));
    const report = { label, count, at: new Date().toISOString(), viewport: '1440x900', rows };
    fs.mkdirSync('.expo/perf', { recursive: true }); fs.writeFileSync(path.join('.expo/perf', `library-renders-${label}.json`), JSON.stringify(report, null, 2));
    console.table(rows); console.log(`Saved .expo/perf/library-renders-${label}.json (synthetic Chromium fixture; not Android).`);
  } finally { try { ws?.close(); } catch {} chrome.kill(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
