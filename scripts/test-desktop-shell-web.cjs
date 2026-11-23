// Módulo PC, fase 1 (23/11/2026): a barra lateral real do PC ao lado da Biblioteca real (livros sintéticos, sem conta nem
// servidor), em Chromium sem janela, 1024/1280/1440 px, claro e escuro. Capturas em .expo/desktop-shell-web/.
// Não prova o app exportado logado: a escolha PC × toque é coberta por test-desktop-layout (critical).
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process'),http=require('http'),assert=require('assert/strict');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 cp.execFileSync(process.execPath,['scripts/build-library-bulk-web-fixture.cjs'],{stdio:'inherit',env:{...process.env,DESKTOP:'1'}});
 const out=path.resolve('.expo/desktop-shell-web');
 const server=http.createServer((req,res)=>{if(req.url==='/matrix.js'){res.setHeader('Content-Type','text/javascript; charset=utf-8');fs.createReadStream(path.join(out,'matrix.js')).pipe(res)}else{res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{margin:0;width:100%;height:100%}*{box-sizing:border-box}#root{display:flex}</style><div id="root"></div><script src="/matrix.js"></script></html>')}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'aldus-desktop-shell-')),chrome=cp.spawn(require('./browser-path.cjs').browserPath(),['--headless=new','--remote-debugging-port=0','--user-data-dir='+profile,'--no-first-run','--no-default-browser-check','about:blank'],{windowsHide:true,stdio:'ignore'});let ws;
 try{
  let port;for(let i=0;i<120;i++){try{port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0];if(port)break}catch{}await wait(150)}assert(port);
  const tabs=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
  let id=0;const pending=new Map(),errors=[];ws.onmessage=event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text)};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});ws.send(JSON.stringify({id:key,method,params}))});
  const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value};
  const screenshot=async name=>{fs.writeFileSync(path.join(out,name+'.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'))};
  await send('Runtime.enable');await send('Page.enable');await send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port});await wait(1500);if(!(await evaluate('!!window.fixture')))throw Error('fixture did not start: '+errors.join(' | ')+' '+(await evaluate('document.body.innerText.slice(0,300)')));
  const results=[];
  for(const width of [1024,1280,1440])for(const dark of [false,true]){
   await send('Emulation.setDeviceMetricsOverride',{width,height:860,deviceScaleFactor:1,mobile:false});
   if(await evaluate('window.fixture.dark')!==dark){await evaluate(`(()=>{window.fixture.dark=${dark};window.dispatchEvent(new Event('fixture-theme'))})()`);}
   await wait(300);
   const state=await evaluate(`(()=>{const nav=document.querySelector('[role="navigation"]'),r=nav.getBoundingClientRect(),links=[...nav.querySelectorAll('[role="link"]')];
    const clipped=[...nav.querySelectorAll('div[dir="auto"]')].filter(e=>e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1).map(e=>e.textContent);
    const card=document.querySelector('[aria-label^="Mostrar Livro sintético"]');
    const wide=[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1&&![...e.children].some(c=>c.getBoundingClientRect().right>innerWidth+1)).slice(0,6).map(e=>(e.getAttribute('aria-label')||e.textContent.slice(0,40))+':'+Math.round(e.getBoundingClientRect().right));return {wide,overflow:document.documentElement.scrollWidth>innerWidth,sidebar:Math.round(r.width),height:Math.round(r.height),links:links.map(l=>l.getAttribute('aria-label')),selected:links.filter(l=>l.getAttribute('aria-current')==='page').map(l=>l.getAttribute('aria-label')),linkHeights:links.map(l=>Math.round(l.getBoundingClientRect().height)),clipped,
     search:!!nav.querySelector('[aria-label="Buscar livros no catálogo"]'),sync:nav.textContent.includes('Ainda não sincronizada'),cardLeft:card&&Math.round(card.getBoundingClientRect().left),cards:document.querySelectorAll('[aria-label^="Mostrar Livro sintético"]').length};})()`);
   assert.equal(state.overflow,false,'no horizontal scroll at '+width+': '+JSON.stringify(state.wide));
   assert.equal(state.sidebar,248);assert.equal(state.height,860,'the sidebar fills the window height');
   assert.deepEqual(state.links,['Biblioteca','Descobrir','Estudo','Comunidade','Conta']);assert.deepEqual(state.selected,['Biblioteca']);
   assert.ok(state.linkHeights.every(h=>h>=44),'44 px targets: '+state.linkHeights);assert.deepEqual(state.clipped,[],'no clipped label');
   assert.equal(state.search,true);assert.equal(state.sync,true);assert.ok(state.cards>0&&state.cardLeft>=248,'the library sits to the right of the sidebar');
   results.push({width,dark,cards:state.cards});await screenshot('desktop-'+width+'-'+(dark?'dark':'light'));
  }
  // Fase 2, Biblioteca do PC: clique mostra o painel, clique duplo abre, Esc fecha; Ctrl e Shift selecionam com o mouse de verdade;
  // soltar arquivos importa um EPUB/PDF e recusa outro tipo.
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:860,deviceScaleFactor:1,mobile:false});await evaluate("(()=>{window.fixture.dark=false;window.dispatchEvent(new Event('fixture-theme'))})()");await wait(300);
  const cards=sel=>evaluate(`[...document.querySelectorAll('${sel}')].slice(0,8).map(e=>{const r=e.getBoundingClientRect();return {label:e.getAttribute('aria-label'),x:r.left+r.width/2,y:r.top+Math.min(r.height/2,120)}})`);
  const mouse=async(p,modifiers=0)=>{for(const type of ['mouseMoved','mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,x:p.x,y:p.y,button:type==='mouseMoved'?'none':'left',clickCount:1,modifiers});};
  const key=async(k,code,vk)=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key:k,code,windowsVirtualKeyCode:vk});await send('Input.dispatchKeyEvent',{type:'keyUp',key:k,code,windowsVirtualKeyCode:vk});};
  let shown=await cards('[aria-label^="Mostrar Livro sintético"]');assert.ok(shown.length>=6,'PC cards show the book instead of opening it: '+JSON.stringify(shown.slice(0,2)));
  await mouse(shown[0]);await wait(500);
  const panel=await evaluate(`(()=>{const p=document.querySelector('[role="complementary"]');if(!p)return null;const r=p.getBoundingClientRect(),card=document.querySelector('[aria-current="true"]');
   return {label:p.getAttribute('aria-label'),width:Math.round(r.width),text:p.innerText,current:card&&card.getAttribute('aria-label'),overflow:document.documentElement.scrollWidth>innerWidth,lastCardRight:Math.max(...[...document.querySelectorAll('[aria-label^="Mostrar Livro sintético"]')].map(e=>e.getBoundingClientRect().right)),panelLeft:Math.round(r.left)}})()`);
  assert.ok(panel,'one click shows the details panel');assert.equal(panel.width,340);assert.equal(panel.label,'Detalhes de '+shown[0].label.replace(/^Mostrar /,'').replace(/, de .*$/,''));
  assert.ok(panel.text.includes('Formato')&&panel.text.includes('EPUB'),'panel text: '+panel.text);assert.match(panel.text,/Situação/);assert.ok(!panel.text.includes('1969'),'no made-up date');assert.ok(panel.text.includes('Continuar lendo')||panel.text.split('\n').includes('Ler'),'read button: '+panel.text);
  assert.equal(panel.current,shown[0].label,'the shown book is outlined');assert.equal(panel.overflow,false);assert.ok(panel.lastCardRight<=panel.panelLeft+1,'the grid shrinks beside the panel');
  assert.equal(await evaluate('window.fixture.route'),null,'one click does not open the book');
  await screenshot('desktop-panel-1440-light');
  shown=await cards('[aria-label^="Mostrar Livro sintético"]');await mouse(shown[0]);await mouse(shown[0]);await wait(200);
  assert.equal((await evaluate('window.fixture.route')).pathname,'/reader/[bookId]','double click opens the book');
  await key('Escape','Escape',27);await wait(200);assert.equal(await evaluate(`!!document.querySelector('[role="complementary"]')`),false,'Esc closes the panel');
  await mouse(shown[1],2);await wait(300);let boxes=await cards('[role="checkbox"]');
  await mouse(boxes[3],2);await wait(300);boxes=await cards('[role="checkbox"]');await mouse(boxes[5],8);await wait(300);
  const checked=await evaluate(`[...document.querySelectorAll('[role="checkbox"][aria-checked="true"]')].map(e=>e.getAttribute('aria-label'))`);
  assert.deepEqual(checked,[1,3,4,5].map(i=>'Selecionar '+shown[i].label.replace(/^Mostrar /,'').replace(/, de .*$/,'')),'Ctrl marks 2 and 4, Shift adds 4 to 6');
  assert.equal(await evaluate('String(getSelection())'),'','Shift+click does not select the card text');
  await screenshot('desktop-select-1440-light');
  await key('Escape','Escape',27);await wait(200);assert.equal(await evaluate(`document.querySelectorAll('[role="checkbox"]').length`),0,'Esc leaves the selection');
  const drop=async(name,type)=>evaluate(`(async()=>{const target=document.querySelector('[aria-label^="Mostrar Livro sintético"]'),data=new DataTransfer();data.items.add(new File(['x'],${JSON.stringify(name)},{type:${JSON.stringify(type)}}));
   target.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:data}));await new Promise(r=>setTimeout(r,250));const overlay=document.body.innerText.includes('Solte para importar');
   target.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:data}));await new Promise(r=>setTimeout(r,250));return {overlay,after:document.body.innerText.includes('Solte para importar'),dropped:window.fixture.dropped||[],text:document.body.innerText}})()`);
  const epub=await drop('Dom Casmurro.epub','application/epub+zip');assert.equal(epub.overlay,true,'dragging a file shows where to drop');assert.equal(epub.after,false);assert.deepEqual(epub.dropped,['Dom Casmurro.epub']);
  const txt=await drop('notas.txt','text/plain');assert.deepEqual(txt.dropped,['Dom Casmurro.epub'],'other file types are not imported');assert.match(txt.text,/Solte um arquivo EPUB ou PDF para importar/);
  // Ctrl+K focuses the search; Enter with two or more letters opens the catalog search.
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'k',code:'KeyK',modifiers:2,windowsVirtualKeyCode:75});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'k',code:'KeyK',modifiers:2,windowsVirtualKeyCode:75});
  assert.equal(await evaluate(`document.activeElement.getAttribute('aria-label')`),'Buscar livros no catálogo','Ctrl+K focuses the search');
  await send('Input.insertText',{text:'Dom Casmurro'});await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await wait(150);
  assert.deepEqual(await evaluate('window.fixture.route'),{pathname:'/catalog',params:{q:'Dom Casmurro'}});
  await evaluate(`[...document.querySelectorAll('[role="link"]')].find(e=>e.getAttribute('aria-label')==='Comunidade').click()`);assert.equal(await evaluate('window.fixture.route'),'community');
  assert.deepEqual(errors,[]);
  console.log('PASS desktop shell + PC library (Chromium, fixture): click shows a 340 px details panel and the grid shrinks, double click opens, Esc closes; real Ctrl/Shift mouse selection; dropping an EPUB imports it and a .txt is refused; 248 px sidebar beside the real Library at 1024/1280/1440, light and dark; five labelled 44 px sections, no clipped text, no horizontal scroll; Ctrl+K search to the catalog; honest sync status. Captures in .expo/desktop-shell-web.',JSON.stringify(results));
 }finally{ws?.close();chrome.kill();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
