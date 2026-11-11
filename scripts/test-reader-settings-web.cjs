// Actual ReaderSettingsPanel and slider in Chromium; controlled settings, document, sensor and safe-area boundaries.
// Redesign step 1: low sheet (quick size/theme/brightness) + "Texto · Página · Conforto". No real account, network or Android proof.
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process'), http = require('http'), assert = require('assert/strict');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  cp.execFileSync(process.execPath, ['scripts/build-reader-settings-web-fixture.cjs'], { stdio: 'inherit' });
  const out = path.resolve('.expo/research-cycle1-increment2'), bundle = path.join(out, 'matrix.js'); assert(fs.existsSync(bundle), 'Build isolated reader fixture before running this matrix');
  const server = http.createServer((req, res) => { const script = req.url === '/matrix.js'; res.setHeader('Content-Type', script ? 'text/javascript' : 'text/html'); if (script) fs.createReadStream(bundle).pipe(res); else res.end('<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{margin:0;height:100%;width:100%}*{box-sizing:border-box}</style><div id="root"></div><script src="/matrix.js"></script></html>'); });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'aldus-reader-categories-')), chrome = cp.spawn(require('./browser-path.cjs').browserPath(), ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + profile, '--no-first-run', '--no-default-browser-check', 'about:blank'], { windowsHide: true, stdio: 'ignore' }); let ws;
  try {
    const portFile = path.join(profile, 'DevToolsActivePort'); let port;
    for (let i = 0; i < 150; i++) { try { const value = fs.readFileSync(portFile, 'utf8').split('\n')[0]; if (/^\d+$/.test(value)) { port = value; break; } } catch (e) { if (!['ENOENT', 'EBUSY', 'EACCES'].includes(e.code)) throw e; } await wait(200); }
    assert(port, 'Chromium port ready'); const tabs = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json(); ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    let id = 0; const jobs = new Map(), errors = [];
    ws.onmessage = ({ data }) => { const m = JSON.parse(data); if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); const job = jobs.get(m.id); if (job) { clearTimeout(job.timer); jobs.delete(m.id); m.error ? job.reject(Error(m.error.message)) : job.resolve(m.result); } };
    const send = (method, params = {}) => new Promise((resolve, reject) => { const n = ++id, timer = setTimeout(() => { jobs.delete(n); reject(Error('CDP timeout ' + method)); }, 25000); jobs.set(n, { resolve, reject, timer }); ws.send(JSON.stringify({ id: n, method, params })); });
    const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); assert(!r.exceptionDetails, r.exceptionDetails?.exception?.description); return r.result.value; };
    await send('Page.enable'); await send('Runtime.enable'); const results = [];
    const load = async () => { await send('Page.navigate', { url: 'http://127.0.0.1:' + server.address().port }); for (let i = 0; i < 100; i++) { if (await evaluate('!!window.fixture')) break; await wait(50); } assert(await evaluate('!!window.fixture')); };
    const press = async label => { await evaluate(`(()=>{const b=[...document.querySelectorAll('[aria-label=${JSON.stringify(label).replace(/'/g, "\\'")}]')].find(b=>b.getBoundingClientRect().height>0);if(!b)throw Error('Missing visible '+${JSON.stringify(label)});b.click()})()`); await wait(80); };
    const shot = async name => { const s = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(s.data, 'base64')); };
    const sections = [null, 'Texto', 'Página', 'Conforto'];
    const quick = process.env.READER_SETTINGS_INTERACTIONS_ONLY === '1';
    for (const [width, height] of quick ? [[390, 844]] : [[320, 568], [390, 844], [430, 932], [768, 1024], [1440, 900]]) for (const dark of quick ? [false] : [false, true]) for (const scale of quick ? [1] : [1, 1.3, 1.6]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }); await load();
      await evaluate(`window.fixture.configure('epub',${dark})`); await wait(450); // slide-in animation must finish before measuring
      for (const [index, label] of sections.entries()) {
        if (label) await press('Mais ajustes: ' + label);
        await evaluate(`(()=>{const all=[...document.querySelectorAll('div,span,button,input')].filter(e=>[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()));const sizes=all.map(e=>[e,e.dataset.baseFont||getComputedStyle(e).fontSize]);for(const[e,size]of sizes){e.dataset.baseFont=size;e.style.fontSize=(parseFloat(size)*${scale})+'px'}})()`);
        const state = await evaluate(`(()=>{const box=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}};const close=document.querySelector('[aria-label="Fechar ajustes de leitura"]');const tabs=[...document.querySelectorAll('[aria-label^="Mais ajustes: "]')];const swatches=[...document.querySelectorAll('[aria-label^="Tema "]:not([aria-label^="Tema automático"])')];const header=[...document.querySelectorAll('[role=heading]')].find(e=>e.textContent==='Ajustes de leitura');return{close:box(close),panelTop:header.getBoundingClientRect().top,selected:tabs.find(b=>b.getAttribute('aria-pressed')==='true')?.textContent??null,tabs:tabs.map(box),swatches:swatches.map(box),themeSelected:swatches.filter(b=>b.getAttribute('aria-pressed')==='true').length,expanded:document.querySelector('[aria-label="Recolher ajustes"],[aria-label="Expandir ajustes"]').getAttribute('aria-expanded'),overflow:document.documentElement.scrollWidth>innerWidth,anchor:document.querySelector('#fixture-document').dataset.anchor,page:document.querySelector('#fixture-document').dataset.page}})()`);
        const inside = b => b.x >= -1 && b.x + b.w <= width + 1;
        assert.equal(state.selected, label, 'selected section'); assert.equal(state.expanded, label ? 'true' : 'false'); assert.equal(state.overflow, false);
        assert(state.close.x >= 0 && state.close.y >= 0 && state.close.x + state.close.w <= width + 1 && state.close.y + state.close.h <= height + 1, 'close in viewport');
        assert.equal(state.page, '51'); assert.equal(state.anchor, 'chapter-3-paragraph-8');
        assert.equal(state.tabs.length, 3); assert(state.tabs.every(inside), 'section tabs stay inside the sheet'); assert(state.tabs.every(b => b.h >= 44), 'section tabs are 44px targets');
        assert.equal(state.swatches.length, 5); assert(state.swatches.every(inside), 'all five theme samples fit without horizontal scroll'); assert.equal(state.themeSelected, 1);
        // Collapsed: the sheet never takes more than ~62% of the height, so the page stays visible behind it.
        if (!label) assert(state.panelTop >= height * 0.36, `collapsed sheet leaves the text visible (top ${Math.round(state.panelTop)} of ${height})`);
        const scrolled = await evaluate(`(()=>{const e=[...document.querySelectorAll('div')].find(e=>getComputedStyle(e).overflowY==='auto'&&e.scrollHeight>e.clientHeight+2);if(!e)return null;const close=document.querySelector('[aria-label="Fechar ajustes de leitura"]'),before=close.getBoundingClientRect().top;e.scrollTop=e.scrollHeight;const moved=e.scrollTop,after=close.getBoundingClientRect().top;e.scrollTop=0;return{moved,before,after}})()`);
        if (scrolled) { assert(scrolled.moved > 0); assert.equal(scrolled.before, scrolled.after, 'Close stays fixed while content scrolls'); }
        await shot(`categories-${width}-${dark ? 'dark' : 'light'}-${scale}-${index}`); results.push({ width, height, dark, scale, section: label ?? 'recolhido', scroll: scrolled, ...state });
      }
      await press('Recolher ajustes'); assert.equal(await evaluate(`document.querySelector('[aria-label="Expandir ajustes"]').getAttribute('aria-expanded')`), 'false', 'sheet collapses again');
      await send('Page.bringToFront'); await evaluate(`document.querySelector('[aria-label="Fechar ajustes de leitura"]').focus()`);
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', text: '\r', unmodifiedText: '\r', windowsVirtualKeyCode: 13 }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', text: '\r', unmodifiedText: '\r', windowsVirtualKeyCode: 13 });
      for (let i = 0; i < 30; i++) { if (!await evaluate(`Boolean(document.querySelector('[aria-label="Fechar ajustes de leitura"]'))`)) break; await wait(50); }
      assert.equal(await evaluate(`Boolean(document.querySelector('[aria-label="Fechar ajustes de leitura"]'))`), false, 'Keyboard closes actual modal');
    }
    // Interactions (390x844, light).
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false }); await load();
    await evaluate(`window.fixture.configure('epub',false)`); await wait(100);
    await press('Aumentar letra'); assert.equal(await evaluate('window.fixture.settings.fontSize'), 21, 'A+ steps the EPUB size'); await press('Diminuir letra'); assert.equal(await evaluate('window.fixture.settings.fontSize'), 20);
    await press('Tema Escuro'); assert.equal(await evaluate('window.fixture.settings.theme'), 'dark'); await press('Tema Papel'); assert.equal(await evaluate('window.fixture.settings.theme'), 'paper');
    assert.equal(await evaluate(`document.body.innerText.includes('Modo e-reader')`), false, 'the redundant e-reader switch is gone (Papel is a theme)');
    await press('Mais ajustes: Texto'); await press('Sem serifa'); assert.equal(await evaluate('window.fixture.settings.font'), 'sans');
    await press('Padrão'); assert.equal(await evaluate('window.fixture.settings.lineHeight'), 1.65, 'default spacing option writes the default');
    await press('Restaurar texto e página padrão'); assert.equal(await evaluate('window.fixture.settings.font'), 'sans', 'restore asks before changing'); await press('Confirmar: voltar ao padrão');
    assert.deepEqual(await evaluate('[window.fixture.settings.font,window.fixture.settings.fontSize,window.fixture.settings.theme]'), ['serif', 16, 'paper'], 'restore resets text/page only, never the theme');
    assert.equal(await evaluate(`document.querySelector('#fixture-document').dataset.page`), '51', 'document untouched by every adjustment');
    await evaluate(`window.fixture.configure('pdf',false)`); await wait(100);
    for (const mode of ['PDF Original', 'Leitura Livre']) {
      await press(mode);
      if (mode === 'PDF Original') {
        await press('Aumentar zoom'); assert.equal(await evaluate('window.fixture.pdf.zoom'), 1.25); await press('Diminuir zoom'); assert.equal(await evaluate('window.fixture.pdf.zoom'), 1);
        assert.equal(await evaluate(`document.querySelectorAll('[aria-label="Mais ajustes: Texto"]').length`), 0, 'Original PDF keeps the file typography: no Texto section');
        await press('Mais ajustes: Página'); await press('À largura'); assert.equal(await evaluate('window.fixture.pdf.fitMode'), 'width');
      }
      for (const [index, label] of (mode === 'PDF Original' ? ['Página', 'Conforto'] : ['Texto', 'Página', 'Conforto']).entries()) { await press('Mais ajustes: ' + label); await shot(`categories-pdf-${mode === 'PDF Original' ? 'original' : 'reflow'}-${index}`); results.push({ width: 390, height: 844, mode, section: label }); }
      if (mode === 'Leitura Livre') {
        await evaluate(`document.querySelector('[aria-label="Tamanho da fonte"]').focus()`); await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 }); await wait(80);
        assert.equal(await evaluate('window.fixture.pdf.fontSize'), 21, 'Real keyboard slider updates PDF'); assert.equal(await evaluate('window.fixture.settings.fontSize'), 16, 'PDF typography stays independent from EPUB');
        const point = await evaluate(`(()=>{const el=document.querySelector('[aria-label="Tamanho da fonte"]');el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();const min=+el.getAttribute('aria-valuemin'),max=+el.getAttribute('aria-valuemax');return{x:r.x+12+(r.width-24)*(17-min)/(max-min),y:r.y+r.height/2}})()`); await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 }); await wait(80);
        assert.equal(await evaluate('window.fixture.pdf.fontSize'), 17, 'A real pointer tap adjusts the slider');
        await press('Mais ajustes: Texto'); await press('Justificado'); assert.equal(await evaluate('window.fixture.pdf.alignment'), 'justify');
      }
    }
    await press('Mais ajustes: Conforto'); await evaluate(`document.querySelector('[aria-label="Ocultar porcentagem e contagem de páginas"]').click()`); await wait(80); assert.equal(await evaluate('window.fixture.settings.hideReadingCounts'), true);
    await press('Mais ajustes: Página'); await press('Mais ajustes: Conforto'); assert.equal(await evaluate('window.fixture.settings.hideReadingCounts'), true, 'Section changes preserve current settings');
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'categories-web-results.json'), JSON.stringify({ scope: 'Actual panel and slider; controlled settings/document/sensor/safe-area. Web text scale stress, not physical Android.', cases: results, keyboardSlider: true, pdfIndependent: true, switchPreserved: true }, null, 2));
    console.log('PASS ' + results.length + ' actual settings sheet layouts (collapsed + Texto/Página/Conforto), steppers, theme samples, restore with confirmation, keyboard slider, PDF independence, switch, fixed close and stable synthetic document. No Android claim.');
  } finally { ws?.close(); chrome.kill(); server.closeAllConnections(); await new Promise(r => server.close(r)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
