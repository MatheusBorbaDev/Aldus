// Exported application in Chromium. Every Supabase request is intercepted with
// synthetic Auth/catalog responses; no production accounts, writes or telemetry.
const fs=require('fs'),path=require('path'),os=require('os'),http=require('http'),cp=require('child_process'),assert=require('assert/strict');
const {initialCatalogReference:plans}=require('./community-test-loader.cjs')()('src/marketing/catalogReference.generated.ts');
const angle=process.env.CINEMATIC_CHROME_ANGLE||'swiftshader';assert(['swiftshader','d3d11'].includes(angle));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function cdp(url){
 const ws=new WebSocket(url);
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('CDP connection timeout')),30000);ws.addEventListener('open',()=>{clearTimeout(timer);resolve()},{once:true});ws.addEventListener('error',error=>{clearTimeout(timer);reject(error)},{once:true});});
 let id=0;const jobs=new Map(),errors=[];
 ws.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text);const job=jobs.get(message.id);if(job){jobs.delete(message.id);clearTimeout(job.timer);message.error?job.reject(Error(message.error.message)):job.resolve(message.result);}});
 ws.addEventListener('close',()=>{for(const job of jobs.values()){clearTimeout(job.timer);job.reject(Error('Chromium disconnected during '+job.method));}jobs.clear();});
 const command=(method,params={})=>new Promise((resolve,reject)=>{const request=++id,timer=setTimeout(()=>{jobs.delete(request);reject(Error('CDP timeout: '+method));},45000);jobs.set(request,{resolve,reject,timer,method});ws.send(JSON.stringify({id:request,method,params}));});
 return{command,errors,close:()=>ws.close(),evaluate:async expression=>{const result=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;}};
}
(async()=>{
 const dist=path.resolve('dist'),shots=path.resolve('.expo/landing-validation');fs.mkdirSync(shots,{recursive:true});
 const bundle=fs.readFileSync(path.join(dist,'_expo/static/js/web',fs.readdirSync(path.join(dist,'_expo/static/js/web')).find(n=>n.startsWith('entry-'))),'utf8');
 const project=bundle.match(/https:\/\/([a-z0-9-]+)\.supabase\.co/)?.[1];assert.ok(project);
 const server=http.createServer((req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);let file=path.resolve(dist,'.'+pathname);if(file!==dist&&!file.startsWith(dist+path.sep)){res.writeHead(403);res.end();return;}if(!fs.existsSync(file)||fs.statSync(file).isDirectory())file=path.join(dist,pathname==='/'?'index.html':'app.html');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.png':'image/png','.svg':'image/svg+xml','.ttf':'font/ttf','.json':'application/json','.txt':'text/plain'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);}catch{res.writeHead(500);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'aldus-marketing-browser-'));
 const chrome=cp.spawn(process.env.SOURCE_LIBRARY_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--use-gl=angle','--use-angle='+angle,'--enable-unsafe-swiftshader','--no-first-run','--no-default-browser-check','--disable-background-networking','--remote-debugging-port=0','--window-size=1440,1000',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'});let client;
 try{
  let port;for(let i=0;i<300;i++){const file=path.join(profile,'DevToolsActivePort');try{if(fs.existsSync(file)){const candidate=fs.readFileSync(file,'utf8').split('\n')[0];if(/^\d+$/.test(candidate)){port=candidate;break;}}}catch(error){if(!['EBUSY','EACCES','ENOENT'].includes(error.code))throw error;}await wait(100);}assert.ok(port,'Chromium CDP unavailable');
  const tabs=await(await fetch(`http://127.0.0.1:${port}/json`)).json();client=await cdp(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
  await client.command('Page.enable');await client.command('Runtime.enable');
  // Baseline independent of the OS "animation effects" setting (Windows can report prefers-reduced-motion: reduce); the
  // reduced-motion path is still exercised explicitly below.
  const motionBaseline={features:[{name:'prefers-reduced-motion',value:'no-preference'}]};await client.command('Emulation.setEmulatedMedia',motionBaseline);
  await client.command('Page.addScriptToEvaluateOnNewDocument',{source:`if(window.top===window){window.__ALDUS_CINEMATIC_QA__=true;
   window.fixtureRemotePaths=[];const key='sb-${project}-auth-token',signedIn=localStorage.getItem('fixture-marketing-user')==='yes';
   const user={id:'99999999-9999-4999-8999-999999999999',aud:'authenticated',role:'authenticated',email:'synthetic@example.invalid',email_confirmed_at:new Date().toISOString(),created_at:new Date().toISOString(),app_metadata:{provider:'email'},user_metadata:{role:'OWNER',plan:'pro'}};
   const session={access_token:[btoa('{"alg":"HS256"}'),btoa(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+86400})),'fixture-signature'].join('.'),refresh_token:'fixture-only',token_type:'bearer',expires_in:86400,expires_at:Math.floor(Date.now()/1000)+86400,user};
   if(signedIn)localStorage.setItem(key,JSON.stringify(session));else localStorage.removeItem(key);
   const plans=${JSON.stringify(plans)};
   const original=window.fetch.bind(window);window.fetch=(input,options)=>{const url=typeof input==='string'?input:input.url;if(!url.includes('.supabase.co/'))return original(input,options);const p=new URL(url).pathname;window.fixtureRemotePaths.push(p);const respond=(data,status=200)=>Promise.resolve(new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}}));
    if(p==='/auth/v1/user')return respond(user);if(p==='/auth/v1/token')return respond(session);
    if(p.includes('/profiles'))return respond({id:user.id,username:'synthetic',display_name:'Conta sintética',role:'user',account_status:'active'});
    if(p.includes('/user_feature_overrides'))return respond([]);
    if(p==='/rest/v1/saas_plans')return respond(plans.map(p=>({id:p.id,name:p.name,available:true,price_brl_centavos:p.priceBrlCentavos,annual_brl_centavos:null,synced_books:Number(localStorage.getItem('fixture-catalog-books')||p.limits.syncedBooks),storage_bytes:p.limits.storageBytes})));
    if(p==='/rest/v1/saas_plan_features')return respond(plans.flatMap(p=>Object.entries(p.features).map(([feature,enabled])=>({plan_id:p.id,feature,enabled}))));
    return respond({message:'Synthetic unavailable or forbidden'},p.includes('aldus_admin')?403:503);
   };
  }`});
  const text=()=>client.evaluate('document.body.innerText');
  const until=async(predicate,label)=>{for(let i=0;i<250;i++){try{if(await client.evaluate(`!!document.body && (${predicate})`))return;}catch(error){if(!/Execution context was destroyed|Cannot find context|Inspected target navigated/.test(error.message))throw error;}await wait(100);}throw Error('Missing '+label+': '+(await text()).slice(0,700));};
  const landing=()=>until('!!document.querySelector("[data-landing-interactive]")','interactive landing');
  const navigate=async route=>{await client.command('Page.navigate',{url:origin+route});};
  const shot=async name=>{await wait(250);const r=await client.command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(shots,name+'.png'),Buffer.from(r.data,'base64'));};

  const state=()=>client.evaluate(`(()=>{const hero=document.querySelector('[data-press-hero]'),landing=document.querySelector('[data-aldus-landing]'),root=document.querySelector('[data-landing-scroll]');
   return{wait:document.documentElement.classList.contains('al-intro-wait'),playing:!!hero?.hasAttribute('data-playing'),intro:!!landing?.hasAttribute('data-intro'),brandIn:!!landing?.hasAttribute('data-brand-in'),
    seen:sessionStorage.getItem('@kindle/landing-intro.v1'),dark:getComputedStyle(document.querySelector('.al-press-dark')).display,seal:getComputedStyle(document.querySelector('.al-seal')).display,
    h1:getComputedStyle(document.querySelector('.al-press h1')).color,font:document.fonts.check('400 1em "Aldus Garamond"'),scrollTop:root?.scrollTop,windowY:window.scrollY};})()`);
  const settled=()=>until('!document.querySelector("[data-press-hero]").hasAttribute("data-playing")&&!document.querySelector("[data-aldus-landing]").hasAttribute("data-intro")&&!document.documentElement.classList.contains("al-intro-wait")','press opening settled');
  const viewport=async(width,height)=>{await client.command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<=850});await wait(200);};

  console.log('Checking the no-JavaScript printed page');
  await viewport(1440,1000);await client.command('Emulation.setScriptExecutionDisabled',{value:true});await navigate('/');await until('!!document.querySelector("[data-press-hero] h1")','prerendered press hero');
  const nojs=await client.evaluate('({wait:document.documentElement.classList.contains("al-intro-wait"),dark:getComputedStyle(document.querySelector(".al-press-dark")).display,h1:document.querySelector(".al-press h1").getAttribute("aria-label"),visible:getComputedStyle(document.querySelector(".al-press h1")).visibility,medals:document.querySelectorAll(".al-medal").length,defs:document.querySelectorAll("#al-medal").length,canvas:document.querySelectorAll("canvas").length})');
  assert.deepEqual({wait:nojs.wait,dark:nojs.dark,visible:nojs.visible,canvas:nojs.canvas,defs:nojs.defs},{wait:false,dark:'none',visible:'visible',canvas:0,defs:1},'Without JavaScript the page is already printed and readable');
  assert.equal(nojs.h1,'Muito mais que uma biblioteca.');assert(nojs.medals>=4,'Medal in header, book cover, final call and footer');
  assert.doesNotMatch(await text(),/You need to enable JavaScript/);await shot('nojs');
  await client.command('Emulation.setScriptExecutionDisabled',{value:false});

  console.log('Checking the press opening on the first load');
  await client.evaluate('sessionStorage.clear()');await navigate('/');
  await until('document.documentElement.classList.contains("al-intro-wait")||!!document.querySelector("[data-press-hero][data-playing]")','dark screen held before hydration');
  await until('!!document.querySelector("[data-press-hero][data-playing]")','opening starts once the app is interactive');
  const timeline=[];const started=Date.now();
  for(const [at,name] of [[500,'press-1-seal'],[2600,'press-2-composing'],[4900,'press-3-printing'],[6400,'press-4-book']]){await wait(Math.max(0,at-(Date.now()-started)));timeline.push({at:Date.now()-started,...await state()});await shot(name);}
  assert.equal(timeline[0].playing,true);assert.equal(timeline[0].dark,'block');assert.equal(timeline[0].seal,'block','Medal is struck first');assert.equal(timeline[0].seen,'1','Opening is remembered for this browser session');
  assert(timeline.some(s=>s.brandIn),'Medal reaches the header');
  await settled();const rest=await state();
  assert.equal(rest.dark,'none');assert.equal(rest.seal,'none');assert.equal(rest.h1,'rgb(37, 61, 53)','Title ends printed in ink');assert.equal(rest.font,true,'Self-hosted display face loaded');
  assert.equal(rest.windowY,0,'Opening never scrolls the window');await shot('press-5-rest');
  assert.ok(!(await client.evaluate('performance.getEntriesByType("resource").map(r=>r.name)')).some(n=>/fonts\.(googleapis|gstatic)\.com/.test(n)),'No third-party font request');

  console.log('Checking session memory, skip and replay');
  await navigate('/');await landing();await wait(600);const again=await state();assert.equal(again.wait,false);assert.equal(again.playing,false,'Second visit in the same session opens printed');
  await client.evaluate('document.querySelector(".al-press-replay").click()');await until('!!document.querySelector("[data-press-hero][data-playing]")','replay');
  await wait(900);await client.evaluate('document.querySelector(".al-press-skip").click()');await settled();
  assert.equal(await client.evaluate('getComputedStyle(document.querySelector(".al-press h1")).visibility'),'visible','Skip leaves the printed page');
  await client.evaluate('document.querySelector(".al-press-replay").click()');await until('!!document.querySelector("[data-press-hero][data-playing]")','replay again');
  await client.command('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await settled();

  console.log('Checking reading that lights up and stacked resource cards');
  const read=async()=>client.evaluate('({on:document.querySelectorAll("[data-read-text] .al-read-word[data-on]").length,all:document.querySelectorAll("[data-read-text] .al-read-word").length,mark:document.querySelector("[data-read-mark]").hasAttribute("data-on")})');
  await client.evaluate('(()=>{const root=document.querySelector("[data-landing-scroll]"),t=document.querySelector("[data-read-text]");root.scrollTop+=t.getBoundingClientRect().top-root.getBoundingClientRect().top-root.clientHeight;})()');await wait(300);
  const dim=await read();assert(dim.all>=15,'Paragraph split into words');assert(dim.on<dim.all,'Words start dim before the reader arrives');assert.equal(dim.mark,false);
  await client.evaluate('(()=>{const root=document.querySelector("[data-landing-scroll]"),t=document.querySelector("[data-read-text]");root.scrollTop+=t.getBoundingClientRect().top-root.getBoundingClientRect().top-root.clientHeight*.15;})()');await wait(300);
  const type=await client.evaluate('({read:parseFloat(getComputedStyle(document.querySelector("[data-read-text]")).fontSize),ribbon:parseFloat(getComputedStyle(document.querySelector(".al-ribbon-track")).fontSize),ribbonCase:getComputedStyle(document.querySelector(".al-ribbon-track")).textTransform})');
  assert(type.read>=26&&type.ribbon>=19&&type.ribbonCase==='none','Lit paragraph and moving ribbon use the display type, not the old small caps '+JSON.stringify(type));
  const lit=await read();assert.equal(lit.on,lit.all,'All words lit after scrolling past');assert.equal(lit.mark,true,'Highlight painted on "o que marca"');await shot('read-lit');
  await client.evaluate('document.getElementById("recursos").scrollIntoView()');await wait(200);
  await client.evaluate('(()=>{const root=document.querySelector("[data-landing-scroll]"),cards=document.querySelectorAll("[data-stack]>article");root.scrollTop+=cards[2].getBoundingClientRect().top-root.getBoundingClientRect().top-200;})()');await wait(300);
  const stack=await client.evaluate('[...document.querySelectorAll("[data-stack]>article")].map(c=>({pos:getComputedStyle(c).position,top:Math.round(c.getBoundingClientRect().top),transform:c.style.transform}))');
  assert(stack.every(c=>c.pos==='sticky'),'Resource cards are sticky');assert(stack.some(c=>/scale\(0\.9/.test(c.transform)),'Covered card recedes');await shot('stacked-cards');

  console.log('Checking layouts');
  const layouts=[];for(const [width,height]of [[320,568],[360,800],[390,844],[430,932],[768,1024],[1024,800],[1440,1000],[1920,1080],[844,390]]){
    await viewport(width,height);await client.evaluate('document.querySelector("[data-landing-scroll]").scrollTop=0');await wait(150);
    const sizes=await client.evaluate('(()=>{const root=document.querySelector("[data-landing-scroll]"),h1=document.querySelector(".al-press h1").getBoundingClientRect(),book=document.querySelector(".al-press-book").getBoundingClientRect();return{width:innerWidth,document:document.documentElement.scrollWidth,scroll:root.scrollWidth,client:root.clientWidth,h1Right:h1.right,bookLeft:book.left,bookRight:book.right,words:[...document.querySelectorAll(".al-press h1 .al-w")].map(w=>w.getBoundingClientRect().right)}})()');
    assert(sizes.document<=sizes.width&&sizes.scroll<=sizes.client,`No horizontal overflow at ${width}x${height} `+JSON.stringify(sizes));
    assert(Math.max(...sizes.words)<=sizes.client+1,`Title words fit at ${width}px`);assert(sizes.bookLeft>=-1&&sizes.bookRight<=sizes.client+1,`Book fits at ${width}px`);
    layouts.push({width,height,...sizes,words:undefined});if([320,390,1440].includes(width))await shot(`layout-${width}`);
    if(width===390){await client.evaluate('document.querySelector(".al-mobile-menu summary").click()');assert(await client.evaluate('document.querySelector(".al-mobile-menu").open'));await client.command('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape'});assert.equal(await client.evaluate('document.querySelector(".al-mobile-menu").open'),false);await client.evaluate('document.querySelector(".al-mobile-menu summary").click();[...document.querySelectorAll(".al-mobile-menu a")].find(a=>a.hash==="#recursos").click()');await until('location.hash==="#recursos"&&!document.querySelector(".al-mobile-menu").open','mobile native anchor and menu close');}
  }
  await viewport(390,844);await client.evaluate('sessionStorage.clear()');await navigate('/');await until('!!document.querySelector("[data-press-hero][data-playing]")','phone opening');await wait(2600);await shot('phone-composing');await settled();await shot('phone-rest');
  await viewport(1440,1000);

  console.log('Checking FAQ, plans and reduced motion');
  await client.command('Page.bringToFront');await client.evaluate('document.querySelector(".al-faq summary").focus()');
  assert.ok(await client.evaluate('document.activeElement===document.querySelector(".al-faq summary")'),'FAQ focus before key');
  await client.command('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',text:'\r',unmodifiedText:'\r',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});await client.command('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});await until('document.querySelector(".al-faq details").open','native FAQ keyboard');
  await client.evaluate('document.getElementById("planos").scrollIntoView()');await wait(900);assert.equal(await client.evaluate('getComputedStyle(document.querySelector("[data-reveal][data-visible=true]")).opacity'),'1');await shot('landing-plans');
  assert.ok(await client.evaluate('document.querySelector(".al-plan-pro button").disabled'),'No fake purchase');
  await client.command('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await client.evaluate('sessionStorage.clear()');await navigate('/');await landing();await wait(800);
  const reduced=await state();assert.deepEqual([reduced.wait,reduced.playing,reduced.dark],[false,false,'none'],'Reduced motion opens printed, with no opening');
  assert.equal(await client.evaluate('document.querySelector("[data-read-text]").hasAttribute("data-armed")'),false,'Reduced motion keeps the paragraph fully visible');
  assert.equal(await client.evaluate('getComputedStyle(document.querySelector("[data-stack]>article")).position'),'static','Reduced motion does not pin cards');await shot('reduced-motion');
  await client.command('Emulation.setEmulatedMedia',motionBaseline);

  console.log('Checking skip link, accessibility and Auth routes');
  await client.evaluate('document.querySelector(".al-skip").focus()');await client.command('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});assert.ok(await client.evaluate('document.activeElement.matches("a,button,summary")'));
  await client.command('Accessibility.enable');const ax=await client.command('Accessibility.getFullAXTree');
  assert.ok(ax.nodes.some(n=>n.role?.value==='heading'&&n.name?.value==='Muito mais que uma biblioteca.'),'Split title keeps one readable heading name');
  assert.ok(ax.nodes.some(n=>n.role?.value==='button'&&n.name?.value==='Ver a abertura'),'Named replay button');
  await client.evaluate('document.querySelector(".al-header-actions a").click()');await until('location.pathname.includes("/auth/login") && !!document.querySelector("input")','real login route');
  await navigate('/');await landing();await client.evaluate('document.querySelector(".al-hero-actions a").click()');await until('location.pathname.includes("/auth/signup") && !!document.querySelector("input")','real signup route');
  console.log('Checking protected routes and authenticated catalog');
  await navigate('/reader/private-canary');await landing();assert.ok(!(await text()).includes('PRIVATE_CONTENT_CANARY'));
  await navigate('/admin');await landing();assert.ok(!(await text()).includes('Usuários cadastrados'));
  await client.evaluate('localStorage.setItem("fixture-marketing-user","yes");localStorage.setItem("fixture-catalog-books","137")');await navigate('/');await landing();await until('document.body.innerText.includes("Catálogo consultado com sua sessão")','authenticated catalog');assert.match(await text(),/137/);assert.ok(await client.evaluate('document.querySelector(".al-hero-actions a").getAttribute("href")==="/library"'));
  assert.ok(!(await client.evaluate('window.fixtureRemotePaths')).some(p=>p.includes('aldus_admin')||p.includes('saas_account_snapshot')||p.includes('saas_quota_snapshot')),'Marketing reads catalog only');
  await client.evaluate('document.querySelector(".al-hero-actions a").click()');await until('location.pathname==="/library" && !!document.querySelector("input[aria-label=\\"Buscar livros por metadados\\"]")','authenticated Library route');
  await navigate('/admin');await until('document.body.innerText.includes("Acesso administrativo indisponível")','ordinary user direct admin denied');assert.ok(!(await text()).includes('Usuários cadastrados'));
  console.log('Checking legal routes');
  for(const [route,label] of [['/legal/privacy','Privacidade'],['/legal/terms','Termos de Uso'],['/legal/copyright','Direitos Autorais e Conteúdo']]){await navigate(route);await until('location.pathname==='+JSON.stringify(route)+'&&document.body.innerText.includes('+JSON.stringify(label)+')','legal route '+route);}
  assert.deepEqual(client.errors,[],'No unhandled browser exceptions');
  fs.writeFileSync(path.join(shots,'results.json'),JSON.stringify({at:new Date().toISOString(),platform:'Chromium headless; HTTP fixtures, no remote writes or physical phone proof',timeline,layouts,nojs,reduced},null,2));
  console.log('PASS Chromium press opening: no-JS printed page, held dark screen before hydration, medal struck and flown to the header, title composed and printed, self-hosted face, session memory, skip/Escape/replay, words lighting and highlight, sticky receding cards, 9 viewports without overflow (320–1920), reduced motion, menu/FAQ/keyboard/Auth/catalog/legal regressions. Headless Chromium is not physical phone proof.');
 }catch(error){
  if(client)try{const image=await client.command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(shots,'failure.png'),Buffer.from(image.data,'base64'));console.error('Failure screenshot .expo/landing-validation/failure.png');}catch{}
  throw error;
 }finally{client?.close();chrome.kill();await wait(500);server.closeAllConnections();await new Promise(r=>server.close(r));if(fs.existsSync(profile)&&path.dirname(fs.realpathSync(profile)).toLowerCase()===fs.realpathSync(os.tmpdir()).toLowerCase()&&path.basename(profile).startsWith('aldus-marketing-browser-'))try{fs.rmSync(profile,{recursive:true,maxRetries:5,retryDelay:100})}catch{}}
})().catch(e=>{console.error(e);process.exitCode=1;});
