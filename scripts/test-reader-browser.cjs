// Actual generated reader document in isolated Chromium/CDP. No user profile/data.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),WebSocket=require('ws'),cp=require('node:child_process');
const coldBaseline=process.argv.includes('--cold-baseline');
const baseline=process.argv.includes('--baseline'), fractionalBaseline=process.argv.includes('--fractional-baseline'), columnCountBaseline=process.argv.includes('--column-count-baseline'), cache=new Map();
const React=require('react'),ReactDOMServer=require('react-dom/server');
function css(style){const v=Object.assign({},...[style].flat(Infinity).filter(Boolean));for(const axis of ['Horizontal','Vertical']){for(const kind of ['padding','margin']){const key=kind+axis;if(v[key]!==undefined){v[kind+(axis==='Horizontal'?'Left':'Top')]=v[key];v[kind+(axis==='Horizontal'?'Right':'Bottom')]=v[key];delete v[key];}}}for(const key of Object.keys(v))if(key.startsWith('shadow')||key==='elevation')delete v[key];return v;}
function host(tag){return ({children,style,accessibilityLabel,pointerEvents,...props})=>{const styles=css(style);if(styles.opacity?.value!==undefined)styles.opacity=styles.opacity.value;if(typeof styles.lineHeight==='number')styles.lineHeight+='px';return React.createElement(tag,{style:{...(tag==='span'?{}:{display:'flex',flexDirection:'column',boxSizing:'border-box',flexShrink:0}),...(tag==='button'?{border:0,padding:0}:{}),...styles,...(['none','box-none'].includes(pointerEvents)?{pointerEvents:'none'}:{})},'data-box-none':pointerEvents==='box-none'?'true':undefined,'aria-label':accessibilityLabel},children);};}
function load(file){if(cache.has(file))return cache.get(file);const exports={};cache.set(file,exports);
 let original=coldBaseline&&file.endsWith('EpubReaderDocument.ts')?cp.execFileSync('git',['show','aa21605:'+file],{encoding:'utf8'}):baseline&&file.endsWith('EpubReaderDocument.ts')?cp.execFileSync('git',['show','77c490c:'+file],{encoding:'utf8'}):fs.readFileSync(file,'utf8');
 if(fractionalBaseline&&file.endsWith('EpubReaderDocument.ts')){const previous=cp.execFileSync('git',['show','77c490c:'+file],{encoding:'utf8'}).match(/function getPageWidth\(\) \{[\s\S]*?\n  \}/)[0];original=original.replace(/function getPageWidth\(\) \{[\s\S]*?\n  \}/,previous);}
 if(columnCountBaseline&&file.endsWith('EpubReaderDocument.ts'))original=original.replace(/function calculateTotalPages\(\) \{[\s\S]*?\n  \}/,`function calculateTotalPages() {
    var width = getPageWidth();
    if (!content || width <= 0) return 1;
    var left = content.getBoundingClientRect().left;
    var extent = width;
    Array.prototype.forEach.call(content.children, function(section) {
      extent = Math.max(extent, section.getBoundingClientRect().right - left);
    });
    return Math.max(1, Math.ceil(extent / width));
  }`);
 const source=ts.transpileModule(original,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 new Function('require','exports',source)(name=>{
 if(name==='react-native')return {View:host('div'),Text:host('span'),Pressable:host('button'),Animated:{View:host('div'),Value:class{constructor(value){this.value=value;}},timing:()=>({start:()=>{}})},StyleSheet:{create:x=>x,absoluteFill:{position:'absolute',top:0,left:0,right:0,bottom:0}},Platform:{OS:'android'}};
 if(name==='@react-native-community/slider')return {__esModule:true,default:host('input')};
 if(name.includes('AppThemeContext'))return {useAppTheme:()=>({palette:{accent:'#a54',text:'#222',secondaryText:'#444',surface:'#fff'}})};
 if(name==='react-native-safe-area-context')return {useSafeAreaInsets:()=>({top:32,bottom:24,left:0,right:0})};
 if(name==='@expo/vector-icons')return {Ionicons:()=>React.createElement('span',null,'●')};
 if(name.startsWith('@/')||name.startsWith('.')){const base=name.startsWith('@/')?name.slice(2):path.posix.join(path.posix.dirname(file),name);const target=['.ts','.tsx'].map(e=>base+e).find(p=>fs.existsSync(p));return load(target);}return require(name);},exports);return exports;}
(async()=>{
 const endpoint=process.env.READER_CDP_URL ?? 'http://127.0.0.1:9382';
 const parsedEndpoint=new URL(endpoint);assert.ok(['127.0.0.1','localhost'].includes(parsedEndpoint.hostname),'Use an isolated local Chromium profile');
 const target=(await(await fetch(endpoint+'/json/list')).json()).find(t=>t.type==='page');
 const ws=new WebSocket(target.webSocketDebuggerUrl);let id=0;const calls=new Map();
 ws.on('message',raw=>{const m=JSON.parse(raw);if(m.id){const c=calls.get(m.id);calls.delete(m.id);m.error?c.reject(m.error):c.resolve(m.result);}});
 await new Promise(r=>ws.on('open',r));
 const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;calls.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 try{
 await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:420,height:780,deviceScaleFactor:1,mobile:true});
 assert.equal(await evaluate('6*7'),42);
 const {createEpubReaderDocument}=load('src/presentation/components/EpubReaderDocument.ts');
 const paragraphs=Array.from({length:240},(_,i)=>`<p>Parágrafo ${i}. ${'A leitura conserva a localização do trecho e permite consultar o livro com clareza. '.repeat(8)}</p>`).join('');
 let chapters=[{id:'fixture-chapter',title:'Capítulo de regressão',html:paragraphs}];
 if(process.argv.includes('--epub')){
  const file='machado-de-assis-dom-casmurro.epub';
  const {EpubParserService}=load('src/data/epub/EpubParserService.ts');chapters=(await new EpubParserService().parse(new Uint8Array(fs.readFileSync(path.join('assets','Livros',file))))).chapters;
  console.log('REAL EPUB',JSON.stringify({file,chapters:chapters.length}));
 }
 if(process.argv.includes('--reflow')){
  const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs'),task=pdfjs.getDocument({data:new Uint8Array(fs.readFileSync('assets/Livros/memórias postumas.pdf')),useSystemFonts:true});
  const pdf=await task.promise,pages=[];
  try{for(let n=1;n<=pdf.numPages;n++){const p=await pdf.getPage(n);try{const text=await p.getTextContent(),vp=p.getViewport({scale:1});pages.push({pageNumber:n,pageWidth:vp.width,pageHeight:vp.height,textItems:text.items.filter(i=>typeof i.str==='string'&&i.transform).map(i=>({text:i.str,x:i.transform[4],y:i.transform[5],width:i.width,height:i.height,fontName:i.fontName,hasEOL:i.hasEOL})),images:[]});}finally{p.cleanup();}}
  const builder=load('src/data/local/PdfReflowDocumentBuilder.ts');chapters=builder.toStoredReflowChapters('reflow-browser',builder.buildPdfReflowDocument(pages,pdf.numPages));console.log('REAL REFLOW',JSON.stringify({file:'memórias postumas.pdf',sourcePages:pdf.numPages,chapters:chapters.length}));}finally{await task.destroy();}
 }
 // Nonce fixo: Page.setDocumentContent troca o conteúdo na MESMA página, e a CSP <meta> do primeiro documento continua valendo
 // (o script do segundo, com outro nonce, seria bloqueado). No app cada documento é uma carga nova, com a própria CSP.
 const options={fontSize:16,fontFamily:'Georgia',marginSize:24,lineHeight:1.65,paragraphSpacing:1,textColor:'#222222',backgroundColor:'#f5ebd9',scriptNonce:'readerbrowsertest0123456789abcd'};
 if(process.argv.includes('--lazy-images')){
  const image=color=>'data:image/svg+xml;base64,'+Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="${color}"/></svg>`).toString('base64');
  chapters=[{id:'synthetic-images',title:'Synthetic offscreen images',html:`<img src="${image('red')}"/>${paragraphs}<img src="${image('blue')}"/>`}];
 }
 const html=createEpubReaderDocument(chapters,options).replace(/<script nonce="([^"]+)">/,'<script nonce="$1">window.messages=[];window.ReactNativeWebView={postMessage:function(x){messages.push(JSON.parse(x));}};');
 const {frameTree}=await send('Page.getFrameTree');await send('Page.setDocumentContent',{frameId:frameTree.frame.id,html});
 await evaluate(`new Promise((resolve,reject)=>{let count=0;function step(){if(messages.some(m=>m.type==='page'&&m.layoutReady))return resolve(true);if(++count>600)return reject(Error('layout not ready'));requestAnimationFrame(step);}step();})`);
 if(process.argv.includes('--lazy-images')){
  const images=await evaluate(`Array.from(document.images).map(image=>({complete:image.complete,width:image.naturalWidth}))`);
  assert.equal(images.length,2);assert.ok(images.every(image=>image.complete&&image.width===24));
  console.log('PASS Chromium: offscreen EPUB images settle initial pagination without user navigation',JSON.stringify(images));
 }
 if(!baseline){
  const fractional=await evaluate(`(()=>{const v=document.getElementById('reader-viewport');v.style.setProperty('width','419.727px','important');v.style.setProperty('min-width','0px','important');window.display();const page=Math.min(120,messages.filter(m=>m.type==='page').at(-1).totalPages);window.goToPage(page);const c=document.getElementById('reader-content'),width=c.getBoundingClientRect().width,x=new DOMMatrix(getComputedStyle(c).transform).m41;return {page,width,rounded:v.clientWidth,x,drift:Math.abs(x+(page-1)*width)};})()`);
  if(fractionalBaseline){assert.ok(fractional.drift>5,JSON.stringify(fractional));console.log('REPRODUCED integer viewport width accumulates column drift',JSON.stringify(fractional));return;}
  assert.ok(fractional.drift<.05,JSON.stringify(fractional));console.log('PASS fractional viewport: distant page stays aligned with its column',JSON.stringify(fractional));
  const lastPage=await evaluate(`(()=>{const total=messages.filter(m=>m.type==='page').at(-1).totalPages;window.goToPage(total);const v=document.getElementById('reader-viewport'),w=v.getBoundingClientRect().width,h=v.getBoundingClientRect().height,walker=document.createTreeWalker(document.getElementById('reader-content'),NodeFilter.SHOW_TEXT);let n,visible=0;while(n=walker.nextNode()){if(!n.data.trim()||n.parentElement.closest('style,script'))continue;for(const offset of [n.data.search(/\\S/),n.data.trimEnd().length-1]){const range=document.createRange();range.setStart(n,offset);range.setEnd(n,offset+1);const r=range.getBoundingClientRect();if(r.width>0&&r.right>0&&r.left<w&&r.bottom>0&&r.top<h)visible++;}}return {total,visible,width:w,scrollWidth:document.getElementById('reader-content').scrollWidth};})()`);
  assert.ok(lastPage.visible>0,JSON.stringify(lastPage));console.log('PASS fractional viewport: final page contains visible text',JSON.stringify(lastPage));
  const counts=await evaluate(`(async()=>{const v=document.getElementById('reader-viewport');v.style.setProperty('width','392.727px','important');const rows=[];for(const size of [16,25]){window.updateTypography({...${JSON.stringify(options)},fontSize:size,lineHeight:1.65});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));window.goToPage(1);window.display();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const total=messages.filter(m=>m.type==='page').at(-1).totalPages;for(const p of [1,120,121,220,221,total-1,total]){window.goToPage(Math.min(p,total));window.display();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const m=messages.filter(m=>m.type==='page').at(-1);rows.push({size,page:m.pageNumber,total:m.totalPages});}}return rows;})()`);
  const varying=[16,25].some(size=>new Set(counts.filter(x=>x.size===size).map(x=>x.total)).size>1);
  if(columnCountBaseline){console.log(varying?'REPRODUCED translated column bounds change page total':'INCONCLUSIVE column count variation in this Chromium geometry',JSON.stringify(counts));return;}
  assert.equal(varying,false,JSON.stringify(counts));console.log('PASS fractional viewport: page total stays stable across distant navigation',JSON.stringify(counts));
  await send('Page.setDocumentContent',{frameId:frameTree.frame.id,html});
  await evaluate(`new Promise(resolve=>{function step(){if(messages.some(m=>m.type==='page'&&m.layoutReady))return resolve();requestAnimationFrame(step);}step();})`);
 }
 let beforePage=await evaluate(`Math.min(30,messages.filter(m=>m.type==='page').at(-1).totalPages-2)`);assert.ok(beforePage>1);
 let before=await evaluate(`window.goToPage(${beforePage});window.readerStudy({type:'studyCapture',id:1});messages.at(-1)`);
 assert.equal(before.status,'captured');assert.ok(before.anchor.start>=0);
 if(!baseline){
  // Paper texture (16/11/2026): updateSurface only paints the viewport background. No page message, same page, same anchor;
  // the data: SVG passes the document CSP; anything that is not a data: SVG is refused.
  const paper=load('src/domain/reader/paperTexture.ts').paperTextureCss('aged',options.backgroundColor);
  const surface=await evaluate(`(async()=>{const v=document.getElementById('reader-viewport'),violations=[];document.addEventListener('securitypolicyviolation',e=>violations.push(e.violatedDirective));const start=messages.length;const post=data=>window.dispatchEvent(new MessageEvent('message',{data}));const tick=()=>new Promise(r=>setTimeout(r,120));
   post({type:'updateSurface',backgroundImage:${JSON.stringify(paper)}});await tick();const applied=getComputedStyle(v).backgroundImage;
   post({type:'updateSurface',backgroundImage:'url("https://example.invalid/x.png")'});await tick();const external=v.style.backgroundImage;
   post({type:'updateSurface',backgroundImage:${JSON.stringify(paper)}});await tick();window.readerStudy({type:'studyCapture',id:2});
   return {applied,external,pageMessages:messages.slice(start).filter(m=>m.type==='page').length,after:messages.at(-1),violations};})()`);
  assert.match(surface.applied,/data:image\/svg\+xml/);assert.match(surface.applied,/radial-gradient/);assert.equal(surface.external,'none','external image refused');
  assert.equal(surface.pageMessages,0,'texture does not relayout or move the page');assert.deepEqual(surface.violations,[],'no CSP violation');
  assert.equal(surface.after.status,'captured');assert.equal(surface.after.anchor.start,before.anchor.start,'same anchor after the texture');
  console.log('PASS paper texture on the actual document: data: SVG + edge gradient applied, external URL refused, no page message, anchor unchanged, no CSP violation');
  // Highlight selection (phase B, 16/11/2026). Android selection handles change the selection without a pointerup in the
  // document: the capture must still arrive once the selection settles. Press-and-hold selects the word under the finger, and
  // the trecho can be adjusted word by word or to the sentence, all without moving the page.
  const selection=await evaluate(`(async()=>{const start=messages.length,study=id=>messages.slice(start).filter(m=>m.type==='study'&&m.id===id);const sleep=ms=>new Promise(r=>setTimeout(r,ms));
   const width=document.getElementById('reader-viewport').getBoundingClientRect().width;
   const visibleWord=()=>{const walker=document.createTreeWalker(document.getElementById('reader-content'),NodeFilter.SHOW_TEXT);let n;while(n=walker.nextNode()){const m=/[A-Za-zÀ-ÿ]{4,}/.exec(n.textContent);if(!m)continue;const r=document.createRange();r.setStart(n,m.index);r.setEnd(n,m.index+m[0].length);const b=r.getBoundingClientRect();if(b.width>0&&b.left>8&&b.right<width-8&&b.top>40&&b.bottom<700)return {node:n,index:m.index,word:m[0],x:b.left+b.width/2,y:b.top+b.height/2};}return null;};
   const w=visibleWord();if(!w)return {skipped:true};
   window.readerStudy({type:'studySelection',id:10,enabled:true});
   const handle=document.createRange();handle.setStart(w.node,w.index);handle.setEnd(w.node,Math.min(w.node.length,w.index+w.word.length+12));
   window.getSelection().removeAllRanges();window.getSelection().addRange(handle);const dragged=window.getSelection().toString().trim();
   await sleep(1000);const settled=study(10);
   window.readerStudy({type:'studySelection',id:11,enabled:false});const cleared=window.getSelection().isCollapsed||window.getSelection().rangeCount===0;
   window.readerStudy({type:'studySelectAt',id:12,x:w.x,y:w.y});const word=study(12).at(-1);const shown=window.getSelection().toString();
   window.readerStudy({type:'studyAdjust',id:13,anchor:word.anchor,op:'growEnd'});const grown=study(13).at(-1);
   window.readerStudy({type:'studyAdjust',id:14,anchor:grown.anchor,op:'shrinkEnd'});const shrunk=study(14).at(-1);
   window.readerStudy({type:'studyAdjust',id:15,anchor:word.anchor,op:'shrinkStart'});const single=study(15).at(-1);
   window.readerStudy({type:'studyAdjust',id:16,anchor:word.anchor,op:'sentence'});const sentence=study(16).at(-1);
   window.readerStudy({type:'studySelectAt',id:17,x:2,y:2});const outside=study(17).at(-1);
   await sleep(800);
   return {dragged,settled:settled.map(m=>({status:m.status,quote:m.anchor&&m.anchor.quote})),cleared,word:w.word,selected:word,shown,grown:grown.anchor.quote,shrunk:shrunk.anchor.quote,single:single.anchor.quote,sentence:sentence.anchor.quote,outside,pageMessages:messages.slice(start).filter(m=>m.type==='page').length,extra:study(12).length+study(13).length};})()`);
  if(selection.skipped)console.log('SKIP highlight selection: this fixture has no visible word on the current page');
  else {
  assert.equal(selection.settled.length,1,'one capture once the selection settles, without pointerup: '+JSON.stringify(selection.settled));
  assert.equal(selection.settled[0].status,'captured');assert.equal(selection.settled[0].quote,selection.dragged,'captured quote is the trimmed selection');
  assert.equal(selection.cleared,true,'disabling selection mode clears the selection');
  assert.equal(selection.selected.status,'captured');assert.equal(selection.selected.anchor.quote,selection.word,'press-and-hold selects the whole word');
  assert.equal(selection.shown,selection.word,'the word is shown selected in the document');
  assert.ok(selection.grown.startsWith(selection.word)&&selection.grown.split(/\s+/).length===2,'growEnd adds the next word: '+selection.grown);
  assert.equal(selection.shrunk,selection.word,'shrinkEnd returns to the word');assert.equal(selection.single,selection.word,'a single word does not shrink to nothing');
  assert.ok(selection.sentence.includes(selection.word)&&selection.sentence.length>selection.word.length,'sentence widens around the word');
  assert.equal(selection.outside.status,'error');assert.match(selection.outside.message,/Pressione sobre uma palavra/);
  assert.equal(selection.pageMessages,0,'selection never moves the page');assert.equal(selection.extra,2,'programmatic selections do not echo extra captures');
  console.log('PASS highlight selection on the actual document: settled selection captured without pointerup, press-and-hold word, grow/shrink/sentence, outside text refused, no page move',JSON.stringify({word:selection.word,grown:selection.grown,sentence:selection.sentence.slice(0,60)}));
  }
  // Drag after press-and-hold (23/11/2026, owner: "não dá mais pra ir arrastando e selecionando outras palavras"). Document path:
  // the finger moves before the app's select request arrives, and the trecho still goes from the pressed word to the word under
  // the finger. Touch-zone path: the app forwards the finger; dragging back toward an earlier word also works.
  const drag=await evaluate(`(async()=>{const start=messages.length,study=id=>messages.slice(start).filter(m=>m.type==='study'&&m.id===id);const sleep=ms=>new Promise(r=>setTimeout(r,ms));
   const v=document.getElementById('reader-viewport'),width=v.getBoundingClientRect().width,words=[];
   const walker=document.createTreeWalker(document.getElementById('reader-content'),NodeFilter.SHOW_TEXT);let n;
   while((n=walker.nextNode())&&words.length<400){const re=/[A-Za-zÀ-ÿ]{4,}/g;let m;while((m=re.exec(n.textContent))){const r=document.createRange();r.setStart(n,m.index);r.setEnd(n,m.index+m[0].length);const b=r.getBoundingClientRect();if(b.width>0&&b.left>8&&b.right<width-8&&b.top>40&&b.bottom<700)words.push({word:m[0],x:b.left+b.width/2,y:b.top+b.height/2});}}
   const a=words[0],b=words.find(w=>w.y>a.y+40);if(!a||!b)return {skipped:true};
   const fire=(t,p)=>v.dispatchEvent(new PointerEvent(t,{bubbles:true,clientX:p.x,clientY:p.y}));
   fire('pointerdown',a);await sleep(650);const long=messages.slice(start).filter(m=>m.type==='longPress').length;
   fire('pointermove',{x:(a.x+b.x)/2,y:(a.y+b.y)/2});fire('pointermove',b);fire('pointerup',b);
   window.readerStudy({type:'studySelectAt',id:30,x:a.x,y:a.y});const doc=study(30),docShown=window.getSelection().toString().trim();
   window.readerStudy({type:'studySelection',id:31,enabled:false});
   window.readerStudy({type:'studySelectAt',id:32,x:b.x,y:b.y});
   window.readerStudy({type:'studyDragTo',id:32,x:a.x,y:a.y,final:false});const live=window.getSelection().toString().trim(),liveReplies=study(32).length;
   window.readerStudy({type:'studyDragTo',id:32,x:a.x,y:a.y,final:true});const zone=study(32);
   window.readerStudy({type:'studySelection',id:33,enabled:false});
   return {a:a.word,b:b.word,long,doc:doc.map(m=>m.status+':'+(m.anchor&&m.anchor.quote)),docShown,live,liveReplies,zone:zone.map(m=>m.status+':'+(m.anchor&&m.anchor.quote)),pageMessages:messages.slice(start).filter(m=>m.type==='page').length};})()`);
  if(drag.skipped)console.log('SKIP drag selection: no two visible lines of words');
  else {
  const quoteOf=entry=>entry.slice(entry.indexOf(':')+1);
  assert.equal(drag.long,1,'the press posts one long press');
  assert.equal(drag.doc.length,2,'word first, then the dragged trecho: '+JSON.stringify(drag.doc));
  const docQuote=quoteOf(drag.doc[1]);assert.ok(drag.doc[1].startsWith('captured:')&&docQuote.startsWith(drag.a)&&docQuote.endsWith(drag.b)&&docQuote.length>drag.a.length+drag.b.length,'document drag goes from the pressed word to the word under the finger: '+JSON.stringify(drag));
  assert.equal(drag.docShown,docQuote,'the dragged trecho is shown selected');
  assert.equal(drag.liveReplies,1,'moving the finger only updates the visible selection (no reply until release)');
  assert.ok(drag.live.startsWith(drag.a)&&drag.live.endsWith(drag.b),'dragging back to an earlier word selects from it to the pressed word: '+drag.live);
  assert.equal(drag.zone.length,2);assert.equal(quoteOf(drag.zone[1]),drag.live,'release replies with the trecho shown');
  assert.equal(drag.pageMessages,0,'dragging never moves the page');
  console.log('PASS drag after press-and-hold on the actual document: forward from the document, backward from the touch zones, one reply on release',JSON.stringify({a:drag.a,b:drag.b,quote:quoteOf(drag.doc[1]).slice(0,80)}));
  }
  // Page turn (phase D, 16/11/2026): none is immediate, flip rotates the viewport and confirms the page only at the end, rapid
  // taps add up in every mode, reduce motion (app flag or system media) forces none, and nothing is left rotated afterwards.
  // The system preference is emulated explicitly: this PC has Windows animations off, which Chrome reports as reduce.
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  const turns=await evaluate(`(async()=>{const sleep=ms=>new Promise(r=>setTimeout(r,ms)),pages=()=>messages.filter(m=>m.type==='page'),last=()=>pages().at(-1).pageNumber,v=document.getElementById('reader-viewport');
   window.goToPage(10);await sleep(50);const out={};
   window.updateMotion({pageTurn:'none'});let n=pages().length;window.navigatePage(1);out.none={sync:pages().length-n,page:last()};
   window.updateMotion({pageTurn:'slide'});n=pages().length;let t0=performance.now();window.navigatePage(1);out.slideSync=pages().length-n;while(pages().length===n&&performance.now()-t0<2000)await sleep(5);out.slideMs=Math.round(performance.now()-t0);
   window.updateMotion({pageTurn:'flip'});window.readerStudy({type:'studyCapture',id:31});const startText=messages.filter(m=>m.type==='study'&&m.id===31).at(-1).anchor.quote.trim().slice(0,24);
   n=pages().length;const before=last();window.navigatePage(1);await sleep(200);
   const sheet=document.getElementById('reader-curl'),flap=document.getElementById('reader-curl-flap');
   out.flipMid={messages:pages().length-n,sheet:!!sheet,flap:!!flap,animated:(()=>{const box=document.getElementById('reader-curl-front');return box&&typeof box.getAnimations==='function'?box.getAnimations().length:-1})(),clip:sheet&&sheet.style.clipPath,copy:!!sheet&&sheet.textContent.replace(/s+/g,' ').includes(startText.replace(/s+/g,' ')),startText};await sleep(800);
   out.flip={messages:pages().length-n,page:last(),from:before,left:['reader-curl','reader-curl-front','reader-curl-flap','reader-curl-shadow','reader-curl-edge'].some(id=>document.getElementById(id)),width:Math.round(v.getBoundingClientRect().width)};
   const back0=last();window.navigatePage(-1);await sleep(200);out.backMid=!!document.getElementById('reader-curl');await sleep(800);out.back={from:back0,to:last(),left:!!document.getElementById('reader-curl')};window.navigatePage(1);await sleep(900);
   const startFlip=last();window.navigatePage(1);window.navigatePage(1);window.navigatePage(1);await sleep(2500);out.flipRapid={from:startFlip,to:last()};
   window.updateMotion({pageTurn:'slide'});const startSlide=last();window.navigatePage(1);window.navigatePage(1);window.navigatePage(1);await sleep(1500);out.slideRapid={from:startSlide,to:last()};
   window.updateMotion({pageTurn:'flip',reduceMotion:true});n=pages().length;window.navigatePage(-1);out.reduced={sync:pages().length-n};
   window.updateMotion({pageTurn:'slide'});window.readerStudy({type:'studyCapture',id:30});out.capture=messages.filter(m=>m.type==='study'&&m.id===30).at(-1).status;
   return out;})()`);
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  const system=await evaluate(`(()=>{const n=messages.filter(m=>m.type==='page').length;window.updateMotion({pageTurn:'flip'});window.navigatePage(1);const sync=messages.filter(m=>m.type==='page').length-n;window.updateMotion({pageTurn:'slide'});return sync;})()`);
  await send('Emulation.setEmulatedMedia',{features:[]});
  // Continuous scroll (phase E, 16/11/2026): Páginas → Rolagem keeps the trecho on top, the reader's scroll is reported once when it
  // stops, "next" moves one screen, typography keeps the top trecho, Rolagem → Páginas shows the same trecho, taps and long press
  // come from the document (no touch zones over a scrolling page).
  const flow=await evaluate(`(async()=>{const sleep=ms=>new Promise(r=>setTimeout(r,ms)),pages=()=>messages.filter(m=>m.type==='page'),v=document.getElementById('reader-viewport');
   const capture=id=>{window.readerStudy({type:'studyCapture',id});return messages.filter(m=>m.type==='study'&&m.id===id).at(-1).anchor;};
   window.readerStudy({type:'studySelection',id:39,enabled:false}); // the app releases the selection when the pop-up closes
   window.goToPage(20);await sleep(120);const a0=capture(40);
   window.updateFlow({flow:'scroll'});await sleep(500);const entered=pages().at(-1),top=capture(41);
   let n=pages().length;v.scrollTop+=900;await sleep(600);const scrolled=pages().slice(n);
   const before=v.scrollTop;window.navigatePage(1);await sleep(50);const step=v.scrollTop-before,stepPage=pages().at(-1);
   const b0=capture(42);window.updateTypography(${JSON.stringify({...options,fontSize:22})});await sleep(800);const b1=capture(43);
   window.updateTypography(${JSON.stringify(options)});await sleep(800);const b2=capture(44);
   n=messages.length;const r=v.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,fire=(t)=>v.dispatchEvent(new PointerEvent(t,{bubbles:true,clientX:x,clientY:y}));
   fire('pointerdown');fire('pointerup');const tap=messages.slice(n).filter(m=>m.type==='tap').length;
   fire('pointerdown');await sleep(650);fire('pointerup');const long=messages.slice(n).filter(m=>m.type==='longPress').at(-1);const tapsAfterLong=messages.slice(n).filter(m=>m.type==='tap').length;
   window.updateFlow({flow:'paged'});await sleep(500);const back=pages().at(-1),c=capture(45);
   // Virar páginas: the app's touch zones cover 20%-80% of the height; a long press on the first line reaches the document.
   n=messages.length;const topY=r.top+r.height*0.1,firePaged=(t)=>v.dispatchEvent(new PointerEvent(t,{bubbles:true,clientX:x,clientY:topY}));
   firePaged('pointerdown');await sleep(650);firePaged('pointerup');const pagedLong=messages.slice(n).filter(m=>m.type==='longPress').at(-1);
   firePaged('pointerdown');firePaged('pointerup');const pagedTaps=messages.slice(n).filter(m=>m.type==='tap').length;
   return {a0,entered:{origin:entered.origin,anchor:entered.readingAnchor&&entered.readingAnchor.start,total:entered.totalPages},top:top.start,
    scrolled:scrolled.map(m=>({origin:m.origin,page:m.pageNumber,anchor:m.readingAnchor&&m.readingAnchor.start})),scrollTop:v.scrollTop,H:v.clientHeight,step,stepOrigin:stepPage.origin,
    b0:b0.start,b1:b1.start,b2:b2.start,tap,long:long&&{x:Math.round(long.x),y:Math.round(long.y)},x:Math.round(x),y:Math.round(y),tapsAfterLong,pagedLong:pagedLong&&{x:Math.round(pagedLong.x),y:Math.round(pagedLong.y)},topY:Math.round(topY),pagedTaps,back:{origin:back.origin,anchor:back.readingAnchor&&back.readingAnchor.start},c:c.start,transform:document.getElementById('reader-content').style.transform};})()`);
  assert.equal(flow.entered.origin,'SETTINGS_LAYOUT');assert.equal(flow.entered.anchor,flow.a0.start,'Páginas → Rolagem keeps the saved trecho');
  assert.ok(Math.abs(flow.top-flow.a0.start)<120,'the trecho is at the top of the screen: '+JSON.stringify({top:flow.top,a0:flow.a0.start}));
  assert.equal(flow.scrolled.length,1,'one report when the reader stops scrolling: '+JSON.stringify(flow.scrolled));assert.equal(flow.scrolled[0].origin,'SCROLL');
  assert.ok(flow.scrolled[0].anchor>flow.a0.start,'the new top trecho is further in the book');
  assert.ok(flow.step>flow.H*0.8&&flow.step<=flow.H,'next moves about one screen: '+flow.step);assert.equal(flow.stepOrigin,'NEXT_PAGE');
  assert.ok(Math.abs(flow.b1-flow.b0)<120&&Math.abs(flow.b2-flow.b0)<120,'typography keeps the top trecho: '+JSON.stringify([flow.b0,flow.b1,flow.b2]));
  assert.equal(flow.tap,1,'tap from the document');assert.deepEqual(flow.long,{x:flow.x,y:flow.y},'long press from the document');assert.equal(flow.tapsAfterLong,1,'a long press is not a tap');
  assert.deepEqual(flow.pagedLong,{x:flow.x,y:flow.topY},'Virar páginas: long press on the first line, outside the touch zones, comes from the document');
  assert.equal(flow.pagedTaps,0,'Virar páginas: a tap outside the zones still does not toggle the controls from the document');
  assert.equal(flow.back.origin,'SETTINGS_LAYOUT');assert.ok(flow.c<=flow.b2&&flow.b2-flow.c<3000,'Rolagem → Páginas shows the same trecho: '+JSON.stringify({c:flow.c,b2:flow.b2}));
  console.log('PASS continuous scroll on the actual document: same trecho both ways, one report per reader scroll, next = one screen, typography keeps the trecho, tap and long press from the document',JSON.stringify({a0:flow.a0.start,top:flow.top,scrolled:flow.scrolled,step:flow.step,b:[flow.b0,flow.b1,flow.b2],c:flow.c}));
  // Back to the trecho the typography check expects. By the trecho, not the page number: the scroll pass loaded images that were
  // offscreen in the paged layout, which can move later pages (the app follows the anchor, so readers are not affected).
  await evaluate(`new Promise(resolve=>{window.readerStudy({type:'studyNavigate',id:98,anchor:${JSON.stringify(before.anchor)}});requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true)));})`);
  // The typography check measures the trecho at the top of the current page: take it again where the reader now is.
  beforePage=await evaluate(`messages.filter(m=>m.type==='page').at(-1).pageNumber`);
  before=await evaluate(`(()=>{window.goToPage(${beforePage});window.readerStudy({type:'studyCapture',id:97});return messages.filter(m=>m.type==='study'&&m.id===97).at(-1);})()`);assert.equal(before.status,'captured');
  assert.deepEqual(turns.none,{sync:1,page:11},'Sem animação turns at once');
  assert.equal(turns.slideSync,0,'Deslizar animates (not instant) without reduce motion');assert.ok(turns.slideMs>=150,'slide lasts its transition: '+turns.slideMs);
  assert.equal(turns.flipMid.messages,0,'Folhear does not confirm the page mid-turn');assert.equal(turns.flipMid.sheet&&turns.flipMid.flap,true,'page copy and paper flap mid-turn');assert.equal(turns.flipMid.animated,1,'the fold runs as a native transform animation');assert.equal(turns.flipMid.clip,'','no per-frame clip-path (it made the turn stutter on the Redmi)');
  assert.equal(turns.flipMid.copy,true,'the curling sheet is a copy of the visible page: '+JSON.stringify(turns.flipMid.startText));
  assert.equal(turns.backMid,true,'going back also curls');assert.equal(turns.back.to,turns.back.from-1);assert.equal(turns.back.left,false);
  assert.equal(turns.flip.messages,1);assert.equal(turns.flip.page,turns.flip.from+1);assert.equal(turns.flip.left,false,'no curl layer left behind');assert.ok(turns.flip.width>300,'viewport back to full width');
  assert.equal(turns.flipRapid.to,turns.flipRapid.from+3,'three quick taps while flipping move three pages');assert.equal(turns.slideRapid.to,turns.slideRapid.from+3,'three quick taps while sliding move three pages');
  assert.equal(turns.reduced.sync,1,'app reduce motion turns at once even with Folhear chosen');assert.equal(system,1,'system reduce motion turns at once');assert.equal(turns.capture,'captured','reader usable after turns');
  console.log('PASS page turn on the actual document: none immediate, slide animates, flip confirms only at the end and leaves no transform, rapid taps add up (flip and slide), app and system reduce motion force none',JSON.stringify({slideMs:turns.slideMs,flip:turns.flip}));
 }
 const moved=await evaluate(`(async()=>{const start=messages.length;window.updateTypography(${JSON.stringify({...options,fontSize:25,lineHeight:2,marginSize:40})});await new Promise((resolve,reject)=>{let count=0;function step(){if(messages.slice(start).some(m=>m.type==='page'))return resolve();if(++count>600)return reject(Error('typography did not commit'));requestAnimationFrame(step);}step();});window.readerStudy({type:'studyCapture',id:2});return {page:messages.filter(m=>m.type==='page').at(-1),anchor:messages.at(-1)};})()`);
 // Locate the old logical start in the actual new layout. A new page number is expected.
 const rect=await evaluate(`(()=>{const section=Array.from(document.querySelectorAll('.epub-chapter')).find(s=>s.getAttribute('data-chapter-id')===${JSON.stringify(before.anchor.chapterId)});const walker=document.createTreeWalker(section,NodeFilter.SHOW_TEXT);let n,offset=0;while(n=walker.nextNode()){if(n.parentElement.closest('style,script'))continue;if(offset+n.length>${before.anchor.start}){const r=document.createRange();r.setStart(n,${before.anchor.start}-offset);r.setEnd(n,${before.anchor.start}+1-offset);const b=r.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom};}offset+=n.length;}})()`);
 const visible=rect.right>0&&rect.left<420&&rect.bottom>0&&rect.top<780;
 if(baseline){assert.equal(visible,false);console.log('REPRODUCED numeric-page typography loses logical anchor',JSON.stringify({beforePage,afterPage:moved.page.pageNumber,beforeStart:before.anchor.start,afterStart:moved.anchor.anchor.start,rect}));}
 else {assert.equal(visible,true,JSON.stringify(rect));assert.ok(moved.page.pageNumber>beforePage);console.log('PASS typography preserves old logical anchor',JSON.stringify({beforePage,afterPage:moved.page.pageNumber,beforeStart:before.anchor.start,afterStart:moved.anchor.anchor.start}));}
 if(!baseline){
  const roundtrip=await evaluate(`(async()=>{const rows=[];for(const options of ${JSON.stringify([options,{...options,fontSize:25,lineHeight:2,marginSize:40},options])}){const start=messages.length;window.updateTypography(options);await new Promise((resolve,reject)=>{let frames=0;function step(){if(messages.slice(start).some(m=>m.type==='page'&&m.origin==='SETTINGS_LAYOUT'))return resolve();if(++frames>600)return reject(Error('Settings roundtrip not acknowledged'));requestAnimationFrame(step)}step()});rows.push({size:options.fontSize,page:messages.filter(m=>m.type==='page').at(-1).pageNumber})}return rows})()`);
  for(const row of roundtrip.filter(r=>r.size===options.fontSize))assert.equal(row.page,beforePage,'Repeated typography changes must retain the original reading intent, not drift toward earlier page starts');
  console.log('PASS typography roundtrip without cumulative anchor drift',JSON.stringify(roundtrip));
 }
 // Cold restart uses a fresh document and the exact persisted text anchor, never the prior JS closure.
 if(!baseline){
  const instrument=source=>source.replace(/<script nonce="([^"]+)">/,'<script nonce="$1">window.messages=[];window.ReactNativeWebView={postMessage:x=>messages.push(JSON.parse(x))};');
  const ready=()=>evaluate(`new Promise((resolve,reject)=>{let frames=0;function step(){if(messages.some(m=>m.type==='page'&&m.layoutReady))return resolve();if(++frames>600)return reject(Error('Cold layout unavailable'));requestAnimationFrame(step)}step()})`);
  for(const size of [25,18]){
   await send('Page.setDocumentContent',{frameId:frameTree.frame.id,html});await ready();
   await evaluate(`window.goToPage(${beforePage});window.updateTypography(${JSON.stringify({...options,fontSize:size})})`);
   await evaluate(`new Promise(resolve=>{function step(){if(messages.some(m=>m.type==='page'&&m.origin==='SETTINGS_LAYOUT'))return resolve();requestAnimationFrame(step)}step()})`);
   const saved=await evaluate(`messages.filter(m=>m.type==='page').at(-1)`);
   const encoded=load('src/domain/types/readerLocation.ts').encodeReaderLocation('epub',saved.readingAnchor||before.anchor);
   const anchor=load('src/domain/types/readerLocation.ts').decodeReaderLocation(encoded,'epub');
   await send('Page.setDocumentContent',{frameId:frameTree.frame.id,html:instrument(createEpubReaderDocument(chapters,{...options,fontSize:size,initialRestorePending:true}))});await ready();
   await evaluate(`window.restoreReadingPosition?window.restoreReadingPosition({pageNumber:${saved.pageNumber},anchor:${JSON.stringify(anchor)}}):window.goToPage(${saved.pageNumber},0,'RESTORE')`);
   await evaluate(`new Promise(resolve=>{function step(){if(messages.some(m=>m.type==='page'&&m.origin==='RESTORE'))return resolve();requestAnimationFrame(step)}step()})`);
   const ack=await evaluate(`messages.filter(m=>m.type==='page').at(-1)`);
   await evaluate(`window.dispatchEvent(new MessageEvent('message',{data:{type:'completeInitialRestore'}}));window.updateTypography(${JSON.stringify(options)})`);
   await evaluate(`new Promise(resolve=>{function step(){if(messages.some(m=>m.type==='page'&&m.origin==='SETTINGS_LAYOUT'))return resolve();requestAnimationFrame(step)}step()})`);
   const returned=await evaluate(`messages.filter(m=>m.type==='page').at(-1)`);
   if(coldBaseline){assert.notEqual(returned.pageNumber,beforePage);console.log('REPRODUCED cold restart loses textual reading intent',JSON.stringify({size,beforePage,returnedPage:returned.pageNumber}));return;}
   assert.equal(ack.anchorRestoreStatus,'exact');assert.deepEqual(returned.readingAnchor,anchor);assert.equal(returned.pageNumber,beforePage);
   console.log('PASS fresh document restores persisted anchor before typography roundtrip',JSON.stringify({size,beforePage,returnedPage:returned.pageNumber,anchorStart:anchor.start}));
  }
  await send('Page.setDocumentContent',{frameId:frameTree.frame.id,html});await ready();await evaluate(`window.goToPage(${beforePage})`);
 }
 // Display/controls do not replace the document or move its logical location.
 const stable=await evaluate(`(()=>{window.readerToken={};window.savedToken=readerToken;window.savedContent=document.getElementById('reader-content');const start=messages.filter(m=>m.type==='page').at(-1).pageNumber;window.display();window.readerStudy({type:'studyCapture',id:3});return {same:readerToken===savedToken&&savedContent===document.getElementById('reader-content'),page:messages.filter(m=>m.type==='page').at(-1).pageNumber,start,anchor:messages.at(-1).anchor};})()`);
 assert.equal(stable.same,true);assert.equal(stable.page,stable.start);
 // transitionend commits target, including recalculation while animating.
 const next=await evaluate(`new Promise(resolve=>{let frames=0;window.navigatePage(1);window.display();function step(){if(++frames>90)return resolve(messages.filter(m=>m.type==='page').at(-1).pageNumber);requestAnimationFrame(step);}step();})`);
 assert.equal(next,baseline?stable.page:stable.page+1);console.log(baseline?'REPRODUCED display during transition overwrites target':'PASS display identity/page and transitionend target');
 if(!baseline){
  const navigatedRoundtrip=await evaluate(`(async()=>{for(const options of ${JSON.stringify([{...options,fontSize:25,lineHeight:2,marginSize:40},options])}){const start=messages.length;window.updateTypography(options);await new Promise((resolve,reject)=>{let frames=0;function step(){if(messages.slice(start).some(m=>m.type==='page'&&m.origin==='SETTINGS_LAYOUT'))return resolve();if(++frames>600)return reject(Error('Navigation typography not acknowledged'));requestAnimationFrame(step)}step()})}return messages.filter(m=>m.type==='page').at(-1).pageNumber})()`);
  assert.equal(navigatedRoundtrip,stable.page+1,'Explicit page navigation replaces the retained typography anchor');
  const sliderTarget=await evaluate('Math.min(80,messages.filter(m=>m.type===\'page\').at(-1).totalPages)');
  const navigation=await evaluate(`(async()=>{const start=messages.length,content=document.getElementById('reader-content');window.dispatchEvent(new MessageEvent('message',{data:{type:'navigatePage',direction:1,operationId:41,origin:'NEXT_PAGE'}}));window.dispatchEvent(new MessageEvent('message',{data:{type:'goToPage',pageNumber:${sliderTarget},operationId:42,origin:'SLIDER_COMMIT'}}));window.display();await new Promise((resolve,reject)=>{let frames=0;function step(){if(messages.slice(start).some(m=>m.type==='page'&&m.operationId===42))return resolve();if(++frames>120)return reject(Error('deferred explicit navigation not acknowledged'));requestAnimationFrame(step);}step();});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const states=messages.slice(start).filter(m=>m.type==='page');return {states:states.map(m=>({page:m.pageNumber,operationId:m.operationId})),last:states.at(-1),same:content===document.getElementById('reader-content')};})()`);
  assert.equal(navigation.last.pageNumber,sliderTarget);assert.equal(navigation.last.operationId,42);assert.equal(navigation.same,true);assert.ok(navigation.states.every(m=>m.operationId<42||m.page===sliderTarget));console.log('PASS explicit slider commit wins over in-flight transition/display without replay',JSON.stringify(navigation.states));
 }
 if(process.argv.includes('--study'))await require('./verify-reader-study-browser.cjs')({send,evaluate,frameId:frameTree.frame.id,createEpubReaderDocument,options});
 // Real TopHeader markup with RN styles, feedback geometry and actual Chromium hit testing.
 const {TopHeader}=load('src/presentation/components/TopHeader.tsx');
 const header=ReactDOMServer.renderToStaticMarkup(React.createElement(TopHeader,{title:'Livro',chapterTitle:'Capítulo',text:'#222',accent:'#a54',background:'#fff',onBack:()=>{},onSearch:()=>{},onContents:()=>{},onSettings:()=>{},onStudy:()=>{}}));
 const feedbackTop=baseline?44:load('src/presentation/components/reader/ReaderGeometry.ts').readerFeedbackTop(32,true,86);
 await send('Page.setDocumentContent',{frameId:frameTree.frame.id,html:`<html><body style="margin:0"><div style="position:relative;width:420px;height:780px">${header}<div id="feedback" style="position:absolute;top:${feedbackTop}px;left:16px;right:16px;z-index:40;display:flex;padding:12px;gap:12px;pointer-events:none;background:#eee"><span style="pointer-events:auto;flex:1">O Reflow está pronto para leitura. Mensagem de feedback do processador.</span><button style="pointer-events:auto">Fechar</button></div></div></body></html>`});
 const receivers=await evaluate(`(()=>{window.hits=[];const buttons=Array.from(document.querySelectorAll('button[aria-label]'));buttons.forEach(b=>b.onclick=()=>hits.push(b.getAttribute('aria-label')));return buttons.map(b=>{const r=b.getBoundingClientRect(),target=document.elementFromPoint(r.left+r.width/2,r.bottom-5);target.click();return {button:b.getAttribute('aria-label'),receiver:target.closest('button')?.getAttribute('aria-label')||target.tagName};});})()`);
 const blocked=receivers.filter(r=>r.button!==r.receiver).length;
 if(baseline){assert.ok(blocked>0);console.log('REPRODUCED feedback intercepts Header',JSON.stringify(receivers));}
 else{assert.equal(blocked,0);assert.equal(await evaluate('hits.length'),5);console.log('PASS Header back/search/contents/settings/study hits with feedback',JSON.stringify(receivers));}
 if(!baseline){
  const {ReaderControls}=load('src/presentation/components/ReaderControls.tsx');
  const controls=ReactDOMServer.renderToStaticMarkup(React.createElement(ReaderControls,{visible:true,layoutMode:'overlay',title:'Livro',chapterTitle:'Capitulo',progress:.4,pageNumber:20,totalPages:50,onBack:()=>{},onSearch:()=>{},onContents:()=>{},onSettings:()=>{},onProgressChange:()=>{},onPagePrevious:()=>{},onPageNext:()=>{}},React.createElement('iframe',{title:'Documento',srcDoc:'<p>Texto do documento</p>',style:{position:'absolute',inset:0,width:'100%',height:'100%',border:0}})));
  await send('Page.setDocumentContent',{frameId:frameTree.frame.id,html:`<html><head><style>[data-box-none="true"] > * {pointer-events:auto}</style></head><body style="margin:0"><div style="position:relative;width:420px;height:780px">${controls}</div></body></html>`});
  const geometry=await evaluate(`(()=>{const footer=document.querySelector('input[aria-label]'),r=footer.getBoundingClientRect();return {top:r.top,bottom:r.bottom,buttons:Array.from(document.querySelectorAll('button[aria-label]')).map(b=>{const p=b.getBoundingClientRect(),target=document.elementFromPoint(p.left+p.width/2,p.top+p.height/2);return {name:b.getAttribute('aria-label'),top:p.top,bottom:p.bottom,hit:target?.closest('button')===b};})};})()`);
  assert.ok(geometry.top>600&&geometry.bottom<=780,JSON.stringify(geometry));
  assert.equal(geometry.buttons.length,6);assert.ok(geometry.buttons.every(b=>b.top>=0&&b.bottom<=780&&b.hit),JSON.stringify(geometry));
  console.log('PASS actual Reflow control wrappers: footer in viewport, all 6 header/footer buttons receive hits above iframe',JSON.stringify(geometry));
 }
 }finally{ws.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
