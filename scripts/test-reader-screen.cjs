// Actual ReaderScreen orchestration; storage, viewers and native hardware boundaries controlled.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),cp=require('node:child_process');
const React=require('../.expo/auth-test-tools/node_modules/react'),{act,create}=require('../.expo/auth-test-tools/node_modules/react-test-renderer');global.IS_REACT_ACT_ENVIRONMENT=true;
const baseline=process.argv.includes('--baseline'),finalizationBaseline=process.argv.includes('--finalization-baseline'),cache=new Map(),timers=new Map(),listeners=new Set(),writes=[],back=new Set();let timerId=0,fixture='reflow',hideReadingCounts=false;
let reader={progress:0,controlsVisible:false,setProgress:v=>setReader({progress:v}),setControlsVisible:v=>setReader({controlsVisible:v}),toggleControls:()=>setReader({controlsVisible:!reader.controlsVisible})};
function setReader(next){reader={...reader,...next};listeners.forEach(fn=>fn());}
const readerStore=()=>React.useSyncExternalStore(fn=>{listeners.add(fn);return()=>listeners.delete(fn)},()=>reader);readerStore.getState=()=>reader;
const noop=()=>{},widget=name=>props=>React.createElement(name,props,props.children);
const palette={background:'#fff',panel:'#eee',text:'#222',secondaryText:'#777',accent:'#a54'};
const dependencies={highlightRepository:{listByBookId:async()=>[]},openBook:{execute:async id=>({book:{id,title:'Fixture',mimeType:fixture==='epub'?'application/epub+zip':'application/pdf',filePath:'file:///fixture',fileName:'fixture.pdf',fileSize:123,fileHash:'fixture-signature'},chapters:fixture==='epub'?[{id:'epub',title:'Chapter',html:'<p>Text</p>',characterCount:4}]:[],progress:{percentage:fixture==='preview'?0:.5}})},pdfReaderSettings:{get:async()=>({...load('src/domain/types/pdfReader.ts').defaultPdfReaderSettings,mode:fixture==='original'?'original':'reflow',reflowProgress:fixture==='preview'?0:.5,originalProgress:.2}),save:async()=>{}},pdfReflowCache:{findByBookId:async()=>null,save:async()=>{}},updateReadingProgress:{execute:async x=>writes.push(x)}};
function load(file){if(cache.has(file))return cache.get(file);const exports={};cache.set(file,exports);const input=(baseline||finalizationBaseline)&&file.endsWith('ReaderScreen.tsx')?cp.execFileSync('git',['show',(finalizationBaseline?'3df3f5b':'77c490c')+':'+file],{encoding:'utf8'}):fs.readFileSync(file,'utf8');const code=ts.transpileModule(input,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
new Function('require','exports','setTimeout','clearTimeout',code)(name=>{
if(name==='react')return React;if(name==='react/jsx-runtime')return require('../.expo/auth-test-tools/node_modules/react/jsx-runtime');if(name==='react-native')return {View:'View',Text:'Text',Pressable:'Pressable',ActivityIndicator:'Spinner',StatusBar:'StatusBar',Platform:{OS:'android'},StyleSheet:{create:x=>x,absoluteFill:{position:'absolute',top:0,bottom:0,left:0,right:0}},AppState:{currentState:'active',addEventListener:()=>({remove:noop})},BackHandler:{addEventListener:(_,fn)=>{back.add(fn);return {remove:()=>back.delete(fn)}}},useWindowDimensions:()=>({width:420,height:780})};if(name==='react-native-safe-area-context')return {useSafeAreaInsets:()=>({top:32,bottom:24,left:5,right:7})};if(name==='expo-router')return {router:{push:noop}};if(name==='expo-brightness')return {isAvailableAsync:async()=>false};if(name==='expo-speech')return {speak(){},stop:async()=>{}};if(name.includes('/services/dependencies'))return {appDependencies:dependencies};if(name.includes('/stores/readerStore'))return {useReaderStore:readerStore};if(name.includes('/contexts/ReaderSettingsContext'))return {useReaderSettings:()=>({hideReadingCounts,fontSize:16,fontFamily:'Georgia',marginSize:24,theme:'light',brightness:100,useSystemBrightness:true,palette})};if(name.includes('epubOpenMetrics'))return {epubDiagnosticConsole:{log:noop},markEpubOpenEvent:noop,markEpubOpenSpanStart:noop,markEpubOpenSpanEnd:noop};
if(name.endsWith('/StudyPanelControls'))return {studyColorNames:{yellow:'Amarelo',green:'Verde',blue:'Azul',pink:'Rosa',purple:'Roxo'}};
for(const component of ['QuoteCardModal','HighlightSelectionPopup','MotionCuesOverlay','StudyBookmarksPanel','ReaderControls','ReaderSettingsPanel','DocumentReaderAdapter','PdfModeChooser','PdfReflowProcessor','PdfReflowPreviewReader'])if(name.endsWith('/'+component))return {[component]:widget(component)};
if(name.startsWith('@/')||name.startsWith('.')){const base=name.startsWith('@/')?name.slice(2):path.posix.join(path.posix.dirname(file),name);return load(['.ts','.tsx'].map(ext=>base+ext).find(p=>fs.existsSync(p)));}return require(name);},exports,file.endsWith('cooperativeWork.ts')?global.setTimeout:fn=>{timers.set(++timerId,fn);return timerId},file.endsWith('cooperativeWork.ts')?global.clearTimeout:id=>timers.delete(id));return exports;}
const flushTimers=async()=>act(async()=>{const due=[...timers.values()];timers.clear();due.forEach(fn=>fn());});
(async()=>{
 const {ReaderScreen}=load('src/presentation/screens/ReaderScreen.tsx');let renderer;
 const builder=load('src/data/local/PdfReflowDocumentBuilder.ts');const valid=builder.buildPdfReflowDocument([{pageNumber:1,pageWidth:500,pageHeight:700,textItems:[{text:'A readable paragraph. '.repeat(100),x:20,y:600,width:300,height:12}],images:[]}],1);
 await act(async()=>{renderer=create(React.createElement(ReaderScreen,{bookId:'reflow'}));});
 if(baseline){const doc=renderer.root.findByType('DocumentReaderAdapter');assert.equal(doc.props.pdfReflowChapters.length,0);await act(async()=>doc.props.onEpubPageInfo({pageNumber:1,totalPages:1,chapterIndex:0,layoutReady:true}));await flushTimers();assert.equal(writes.at(-1).percentage,0);console.log('REPRODUCED empty Reflow before publication clears saved .5 progress to 0');await act(async()=>renderer.root.findByType('PdfReflowProcessor').props.onCancel());const original=renderer.root.findByType('DocumentReaderAdapter');await act(async()=>original.props.onPdfTotalPages(101));assert.equal(renderer.root.findByType('DocumentReaderAdapter').props.pdfPage,51);console.log('REPRODUCED cancel restores Reflow .5 instead of Original .2');await act(async()=>renderer.unmount());return;}
 assert.equal(renderer.root.findAllByType('DocumentReaderAdapter').length,0,'Must not instantiate an empty candidate document during preparation');assert.equal(reader.progress,.5);
 await act(async()=>renderer.root.findByType('PdfReflowProcessor').props.onComplete(valid));
 const getDoc=()=>renderer.root.findByType('DocumentReaderAdapter');let doc=getDoc();assert.equal(doc.props.initialRestorePending,true);
 const report=async(page,total,ready)=>act(async()=>getDoc().props.onEpubPageInfo({pageNumber:page,totalPages:total,chapterIndex:0,layoutReady:ready}));
 await report(1,3,false);assert.equal(reader.progress,.5);assert.equal(writes.length,0);
 await report(1,101,true);assert.equal(getDoc().props.epubPage,51);assert.equal(getDoc().props.restoreTargetReady,true);assert.equal(writes.length,0);
 await report(51,101,true);await flushTimers();assert.equal(getDoc().props.initialRestorePending,false);assert.equal(writes.at(-1).pageNumber,51);assert.equal(writes.at(-1).percentage,.5);
 const instance=getDoc();for(let i=0;i<10;i++)await act(async()=>reader.toggleControls());assert.strictEqual(getDoc(),instance);assert.equal(getDoc().props.epubPage,51);
 await act(async()=>renderer.root.findByType('ReaderControls').props.onSettings());assert.strictEqual(getDoc(),instance);assert.equal(getDoc().props.epubPage,51);
 hideReadingCounts=true;await act(async()=>setReader({controlsVisible:true}));assert.equal(renderer.root.findByType('ReaderControls').props.hideReadingCounts,true);assert.strictEqual(getDoc(),instance);assert.equal(getDoc().props.epubPage,51);
 const writesBeforeFocus=writes.length;await act(async()=>renderer.root.findByType('ReaderSettingsPanel').props.onReadInFocus());assert.equal(reader.controlsVisible,false);assert.equal(renderer.root.findByType('ReaderSettingsPanel').props.visible,false);assert.strictEqual(getDoc(),instance);assert.equal(getDoc().props.epubPage,51);assert.equal(writes.length,writesBeforeFocus);
 await act(async()=>setReader({controlsVisible:true}));assert.equal(getDoc().props.epubPage,51);
 const preferences=renderer.root.findByType('ReaderSettingsPanel');await act(async()=>preferences.props.onPdfSettingsChange({...preferences.props.pdfSettings,fontSize:22,lineHeight:1.8}));assert.strictEqual(getDoc(),instance);assert.equal(getDoc().props.epubPage,51);
 await report(1,101,true);await flushTimers();assert.equal(writes.at(-1).pageNumber,1);assert.equal(writes.at(-1).percentage,0,'An acknowledged real navigation to page 1 must be accepted');
 await act(async()=>renderer.unmount());assert.equal(back.size,0);
 // Back during preparation returns to the preserved Original mode progress.
 writes.length=0;await act(async()=>{renderer=create(React.createElement(ReaderScreen,{bookId:'cancel'}));});assert.equal(back.size,1);
 await act(async()=>{assert.equal([...back][0](),true)});assert.equal(getDoc().props.pdfReadingMode,'original');
 await act(async()=>getDoc().props.onPdfTotalPages(101));assert.equal(getDoc().props.pdfPage,21);assert.equal(reader.progress,.2);await act(async()=>renderer.unmount());
 for(const terminal of ['onCancel','onError','onComplete']) {
   await act(async()=>{renderer=create(React.createElement(ReaderScreen,{bookId:'terminal-'+terminal}));});
   const processor=renderer.root.findByType('PdfReflowProcessor');
   await act(async()=>processor.props[terminal](terminal==='onComplete'?{...valid,extractionQuality:undefined}:'Invalid extracted text'));
   assert.equal(getDoc().props.pdfReadingMode,'original');await act(async()=>getDoc().props.onPdfTotalPages(101));assert.equal(getDoc().props.pdfPage,21);assert.equal(reader.progress,.2);await act(async()=>renderer.unmount());
 }
 // A pending position write must neither revert mode nor be lost on closing.
 await act(async()=>{renderer=create(React.createElement(ReaderScreen,{bookId:'mode-race'}));});
 await act(async()=>renderer.root.findByType('PdfReflowProcessor').props.onComplete(valid));await report(1,101,true);await report(51,101,true);
 await act(async()=>renderer.root.findByType('ReaderSettingsPanel').props.onPdfModeChange('original'));await flushTimers();assert.equal(getDoc().props.pdfReadingMode,'original');await act(async()=>renderer.unmount());
 writes.length=0;await act(async()=>{renderer=create(React.createElement(ReaderScreen,{bookId:'close'}));});
 await act(async()=>renderer.root.findByType('PdfReflowProcessor').props.onComplete(valid));await report(1,101,true);await report(51,101,true);await act(async()=>renderer.unmount());await flushTimers();assert.equal(writes.at(-1)?.pageNumber,51,'Last acknowledged position must survive immediate close');
 // Cache completion is part of preparation, not an unobserved background write.
 let releaseSave,saveStarted=false,publication,notifySaveStarted;
 const observeSaveStart=()=>new Promise(resolve=>{notifySaveStarted=resolve});
 let saveStartedSignal=observeSaveStart();
 dependencies.pdfReflowCache.save=async()=>{saveStarted=true;await new Promise(resolve=>{releaseSave=resolve;notifySaveStarted()})};
 // The cooperative pipeline crosses real host timers. A fixed number of
 // setImmediate turns can finish before those timers run on a fast CI host.
 const waitForSaveStart=()=>act(async()=>{
   await Promise.race([saveStartedSignal,publication.then(()=>{throw new Error('Publication ended before requesting the cache write')})]);
 });
 await act(async()=>{renderer=create(React.createElement(ReaderScreen,{bookId:'cache-cancel'}));});
 await act(async()=>{publication=renderer.root.findByType('PdfReflowProcessor').props.onComplete(valid)});
 await waitForSaveStart();assert.equal(saveStarted,true);
 assert.equal(renderer.root.findAllByType('DocumentReaderAdapter').length,0,'Do not publish Reflow before cache commit');
 assert.equal(renderer.root.findAllByType('PdfReflowProcessor').length,1,'Final cache write must remain cancellable/Back-handled');
 await act(async()=>{[...back][0]()});assert.equal(getDoc().props.pdfReadingMode,'original');
 await act(async()=>{releaseSave();await publication});assert.equal(getDoc().props.pdfReadingMode,'original','Late cache write cannot restore cancelled Reflow');await act(async()=>renderer.unmount());
 saveStarted=false;saveStartedSignal=observeSaveStart();
 await act(async()=>{renderer=create(React.createElement(ReaderScreen,{bookId:'cache-commit'}));});
 await act(async()=>{publication=renderer.root.findByType('PdfReflowProcessor').props.onComplete(valid)});
 await waitForSaveStart();assert.equal(saveStarted,true);
 await act(async()=>{releaseSave();await publication});assert.equal(getDoc().props.pdfReadingMode,'reflow');assert.ok(getDoc().props.pdfReflowChapters[0].html.includes('readable'));
 await act(async()=>renderer.unmount());
 dependencies.pdfReflowCache.save=async()=>{};
 fixture='epub';writes.length=0;await act(async()=>{renderer=create(React.createElement(ReaderScreen,{bookId:'epub'}));});
 await report(1,3,false);assert.equal(getDoc().props.epubPage,1);assert.equal(reader.progress,.5);
 await report(1,101,true);assert.equal(getDoc().props.epubPage,51);await report(51,101,true);await flushTimers();assert.equal(writes.at(-1).pageNumber,51);
 const surface=getDoc().parent.parent.props.style;assert.deepEqual(surface[1],{top:32,bottom:24,left:5,right:7});
 await act(async()=>renderer.unmount());
 // A persisted textual anchor owns restoration until its dedicated ACK, not page-1/layout messages.
 const anchor={version:1,kind:'epub-text',chapterId:'epub',start:0,end:4,quote:'Text',prefix:'',suffix:'',path:[0]};
 const location=load('src/domain/types/readerLocation.ts').encodeReaderLocation('epub',anchor);
 const oldOpen=dependencies.openBook.execute;dependencies.openBook.execute=async id=>{const item=await oldOpen(id);return {...item,progress:{...item.progress,cfiPosition:location}}};
 writes.length=0;await act(async()=>{renderer=create(React.createElement(ReaderScreen,{bookId:'anchor-cold'}));});
 await report(1,101,true);assert.deepEqual(getDoc().props.restoreTextAnchor,anchor);assert.equal(writes.length,0);assert.equal(getDoc().props.restoreTargetReady,true);
 await act(async()=>getDoc().props.onEpubPageInfo({pageNumber:1,totalPages:101,chapterIndex:0,layoutReady:true,origin:'LAYOUT_RECALC',operationId:0}));assert.equal(writes.length,0);
 const restored={pageNumber:37,totalPages:101,chapterIndex:0,layoutReady:true,origin:'RESTORE',operationId:0,readingAnchor:anchor,anchorRestoreStatus:'exact'};
 await act(async()=>getDoc().props.onEpubPageInfo(restored));assert.equal(getDoc().props.epubPage,37);assert.equal(getDoc().props.initialRestorePending,false);assert.equal(writes.at(-1).cfiPosition,location);
 const committed=writes.length;for(let i=0;i<4;i++)await act(async()=>getDoc().props.onEpubPageInfo({...restored,origin:'LAYOUT_RECALC'}));assert.equal(writes.length,committed);
 // Only an explicit selection opens the highlight composer; capturing a marker is separate.
 await act(async()=>renderer.root.findByType('ReaderControls').props.onStudy());
 let panel=()=>renderer.root.findByType('StudyBookmarksPanel');
 assert.equal(panel().props.selectionCaptured,false);
 await act(async()=>panel().props.onCapture());let request=getDoc().props.studyRequest;
 await act(async()=>getDoc().props.onStudyResult({id:request.id,status:'captured',anchor}));assert.equal(panel().props.selectionCaptured,false);
 await act(async()=>panel().props.onSelectText());request=getDoc().props.studyRequest;assert.equal(request.type,'studySelection');assert.equal(request.enabled,true);
 assert.equal(renderer.root.findAllByType('StudyBookmarksPanel').length,0);
 await act(async()=>getDoc().props.onStudyResult({id:request.id-1,status:'captured',anchor}));assert.equal(renderer.root.findAllByType('StudyBookmarksPanel').length,0,'Old selection result ignored');
 // Phase B: the selection now ends in the highlight pop-up; "Adicionar nota" opens the panel with the trecho.
 const popup=()=>renderer.root.findAllByType('HighlightSelectionPopup')[0];
 await act(async()=>getDoc().props.onStudyResult({id:request.id,status:'captured',anchor}));assert.equal(popup().props.quote,anchor.quote);assert.equal(renderer.root.findAllByType('StudyBookmarksPanel').length,0);
 assert.equal(getDoc().props.panelOpen,true,'page touch zones are suspended while the pop-up is open');
 await act(async()=>popup().props.onNote());assert.equal(renderer.root.findAllByType('HighlightSelectionPopup').length,0);
 assert.deepEqual([getDoc().props.studyRequest.type,getDoc().props.studyRequest.enabled],['studySelection',false],'document selection is released');
 assert.equal(panel().props.selectionCaptured,true);assert.deepEqual(panel().props.capture,anchor);
 await act(async()=>panel().props.onCaptureConsumed());assert.equal(panel().props.selectionCaptured,false);assert.equal(panel().props.capture,null);
 assert.equal(getDoc().props.epubPage,37);assert.equal(writes.length,committed,'Opening and saving panel state cannot write reading progress');
 // Press-and-hold: word under the finger, adjust, save with one color; a failed save keeps the trecho.
 await act(async()=>panel().props.onClose());assert.equal(typeof getDoc().props.onLongPressText,'function');
 await act(async()=>getDoc().props.onLongPressText(120,300));request=getDoc().props.studyRequest;assert.deepEqual([request.type,request.x,request.y],['studySelectAt',120,300]);assert.equal(popup().props.busy,true);
 await act(async()=>getDoc().props.onStudyResult({id:request.id,status:'error',message:'Pressione sobre uma palavra do texto.'}));assert.equal(popup().props.quote,null);assert.match(popup().props.error,/Pressione sobre uma palavra/);
 await act(async()=>popup().props.onCancel());assert.equal(renderer.root.findAllByType('HighlightSelectionPopup').length,0);
 // Drag after press-and-hold from the touch zones (23/11/2026): the zones stay mounted while the finger is down, the finger is
 // forwarded with the press request id, and release asks for the final trecho; a press without drag sends nothing more.
 await act(async()=>getDoc().props.onZoneLongPressText(150,320));const press=getDoc().props.studyRequest;assert.equal(press.type,'studySelectAt');
 assert.equal(getDoc().props.textGesture,true,'touch zones stay while the finger is down');assert.equal(getDoc().props.panelOpen,true);
 await act(async()=>getDoc().props.onDragText(200,400,false,true));request=getDoc().props.studyRequest;
 assert.deepEqual([request.type,request.id,request.x,request.y,request.final],['studyDragTo',press.id,200,400,false]);
 await act(async()=>getDoc().props.onStudyResult({id:press.id,status:'captured',anchor:{...anchor,end:anchor.start+3,quote:anchor.quote.slice(0,3)}}));assert.equal(popup().props.quote,anchor.quote.slice(0,3));
 await act(async()=>getDoc().props.onDragText(220,420,true,true));request=getDoc().props.studyRequest;
 assert.deepEqual([request.type,request.id,request.final],['studyDragTo',press.id,true]);assert.equal(popup().props.busy,true);assert.equal(getDoc().props.textGesture,false,'release ends the gesture');
 await act(async()=>getDoc().props.onStudyResult({id:press.id,status:'captured',anchor}));assert.equal(popup().props.quote,anchor.quote,'the dragged trecho replaces the word');assert.equal(popup().props.busy,false);
 await act(async()=>popup().props.onCancel());
 await act(async()=>getDoc().props.onZoneLongPressText(150,320));const still=getDoc().props.studyRequest;
 await act(async()=>getDoc().props.onDragText(150,320,true,false));assert.equal(getDoc().props.studyRequest,still,'a press without drag sends nothing more');assert.equal(getDoc().props.textGesture,false);
 await act(async()=>popup().props.onCancel());
 await act(async()=>getDoc().props.onLongPressText(150,320));request=getDoc().props.studyRequest;
 const word={...anchor,end:anchor.start+3,quote:anchor.quote.slice(0,3)};
 await act(async()=>getDoc().props.onStudyResult({id:request.id,status:'captured',anchor:word}));assert.equal(popup().props.quote,word.quote);
 await act(async()=>getDoc().props.onStudyResult({id:request.id-1,status:'captured',anchor}));assert.equal(popup().props.quote,word.quote,'old result ignored');
 await act(async()=>popup().props.onAdjust('growEnd'));request=getDoc().props.studyRequest;assert.deepEqual([request.type,request.op,request.anchor.quote],['studyAdjust','growEnd',word.quote]);
 await act(async()=>getDoc().props.onStudyResult({id:request.id,status:'captured',anchor}));assert.equal(popup().props.quote,anchor.quote);
 // Phase C: "Compartilhar" opens the quote card with this trecho and the book; closing returns to the pop-up.
 await act(async()=>popup().props.onShare());const card=renderer.root.findByType('QuoteCardModal');assert.equal(card.props.quote,anchor.quote);assert.equal(typeof card.props.title,'string');assert.equal(card.props.paletteName,'classic');
 await act(async()=>card.props.onClose());assert.equal(renderer.root.findAllByType('QuoteCardModal').length,0);assert.equal(popup().props.quote,anchor.quote);
 const saved=[];dependencies.highlightRepository.save=async h=>{throw Error('Disco cheio.')};
 await act(async()=>popup().props.onColor('green'));assert.equal(popup().props.quote,anchor.quote,'failed save keeps the trecho');assert.match(popup().props.error,/Disco cheio/);
 dependencies.highlightRepository.save=async h=>{saved.push(h)};
 await act(async()=>popup().props.onColor('green'));assert.equal(saved.length,1);assert.equal(saved[0].colorLabel,'green');assert.equal(saved[0].highlightedText,anchor.quote);assert.equal(JSON.parse(saved[0].startCfi).anchor.start,anchor.start);
 assert.equal(renderer.root.findAllByType('HighlightSelectionPopup').length,0);assert.deepEqual([getDoc().props.studyRequest.type,getDoc().props.studyRequest.enabled],['studySelection',false]);
 assert.ok(JSON.stringify(renderer.toJSON()).includes('Grifo salvo em verde.'),'saved notice');
 assert.equal(writes.length,committed,'selecting and saving a highlight never writes reading progress');
 await act(async()=>renderer.unmount());
 writes.length=0;await act(async()=>{renderer=create(React.createElement(ReaderScreen,{bookId:'anchor-missing'}));});await report(1,101,true);
 await act(async()=>getDoc().props.onEpubPageInfo({...restored,readingAnchor:null,anchorRestoreStatus:'missing',pageNumber:51}));assert.equal(writes.length,0);assert.match(renderer.root.findByType('StudyBookmarksPanel').props.feedback,/trecho salvo/);
 await act(async()=>getDoc().props.onEpubPageInfo({...restored,pageNumber:52,operationId:1,origin:'TAP_NEXT',anchorRestoreStatus:null}));assert.equal(writes.at(-1).pageNumber,52);
 await act(async()=>renderer.unmount());dependencies.openBook.execute=oldOpen;
 // Leitura Livre (owner's report, 18/11): press-and-hold highlights, the highlight panel is available, and each mode shows only its own highlights.
 // 18/11: the processor validates before handing over; the screen no longer repeats that pass (validated=true), and still
 // refuses an unvalidated document from anyone else.
 { const forged={...valid,extractionQuality:{...valid.extractionQuality,version:99}};
   fixture='reflow';await act(async()=>{renderer=create(React.createElement(ReaderScreen,{bookId:'validated-skip'}));});
   await act(async()=>renderer.root.findByType('PdfReflowProcessor').props.onComplete(forged));
   assert.equal(renderer.root.findAllByType('DocumentReaderAdapter').some(d=>d.props.pdfReadingMode==='reflow'&&d.props.pdfReflowChapters.length>0),false,'unvalidated document refused');
   await act(async()=>renderer.unmount());
   await act(async()=>{renderer=create(React.createElement(ReaderScreen,{bookId:'validated-skip-2'}));});
   await act(async()=>renderer.root.findByType('PdfReflowProcessor').props.onComplete(forged,undefined,true));
   assert.equal(getDoc().props.pdfReadingMode,'reflow');assert.ok(getDoc().props.pdfReflowChapters.length>0,'processor-validated document published without a second pass');
   await act(async()=>renderer.unmount()); }
 const study=load('src/domain/usecases/StudyHighlights.ts');
 const reflowAnchor={version:1,kind:'epub-text',chapterId:'reflow-hl-reflow-0',start:2,end:10,quote:'readable',prefix:'A ',suffix:' p',path:[0]};
 const epubOne=study.createStudyHighlight({bookId:'reflow-hl',anchor:{...reflowAnchor,chapterId:'other'},chapterTitle:'EPUB',color:'blue',id:'h-epub',now:1});
 const reflowOne=study.createStudyHighlight({bookId:'reflow-hl',anchor:reflowAnchor,chapterTitle:'Início',color:'pink',id:'h-reflow',now:2,mode:'pdf-reflow'});
 const legacy={id:'h-legacy',bookId:'reflow-hl',chapterId:'c',startCfi:'epubcfi(/6/2)',endCfi:'epubcfi(/6/4)',highlightedText:'old',colorLabel:'yellow',createdAt:0};
 const future={...reflowOne,id:'h-future',startCfi:reflowOne.startCfi.replace('"pdf-reflow"','"pdf-original"')};
 assert.equal(study.readHighlightLocation(future),null,'an unknown mode is never shown in the wrong reader');
 assert.deepEqual(study.highlightsForReaderMode([epubOne,reflowOne,legacy,future],'epub').map(h=>h.id),['h-epub','h-legacy']);
 assert.deepEqual(study.highlightsForReaderMode([epubOne,reflowOne,legacy,future],'pdf-reflow').map(h=>h.id),['h-reflow']);
 assert.ok(!('mode' in JSON.parse(epubOne.startCfi)),'EPUB highlights keep the old format');
 const oldList=dependencies.highlightRepository.listByBookId;dependencies.highlightRepository.listByBookId=async()=>[epubOne,reflowOne];
 fixture='reflow';writes.length=0;saved.length=0;await act(async()=>{renderer=create(React.createElement(ReaderScreen,{bookId:'reflow-hl'}));});
 await act(async()=>renderer.root.findByType('PdfReflowProcessor').props.onComplete(valid));
 assert.equal(getDoc().props.pdfReadingMode,'reflow');
 assert.deepEqual(getDoc().props.studyHighlights.map(h=>h.id),['h-reflow'],'Leitura Livre draws only its own highlights');
 assert.equal(typeof renderer.root.findByType('ReaderControls').props.onStudy,'function','the highlight panel opens in Leitura Livre');
 assert.equal(typeof getDoc().props.onLongPressText,'function','press-and-hold is enabled in Leitura Livre');
 await act(async()=>getDoc().props.onLongPressText(80,200));request=getDoc().props.studyRequest;assert.equal(request.type,'studySelectAt');
 await act(async()=>getDoc().props.onStudyResult({id:request.id,status:'captured',anchor:reflowAnchor}));assert.equal(popup().props.quote,'readable');
 await act(async()=>popup().props.onColor('yellow'));assert.equal(saved.length,1);
 const savedLocation=study.readHighlightLocation(saved[0]);assert.equal(savedLocation.mode,'pdf-reflow');assert.equal(savedLocation.anchor.chapterId,'reflow-hl-reflow-0');
 assert.equal(writes.length,0,'highlighting never writes reading progress');
 await act(async()=>renderer.root.findByType('ReaderControls').props.onStudy());
 assert.deepEqual(renderer.root.findByType('StudyBookmarksPanel').props.highlights.map(h=>h.id),['h-reflow']);assert.equal(renderer.root.findByType('StudyBookmarksPanel').props.highlightMode,'pdf-reflow');
 await act(async()=>renderer.unmount());dependencies.highlightRepository.listByBookId=oldList;
 // Leitura Livre preview (18/11/2026): offered only from the start, readable while preparing, Back closes it first, never writes
 // progress; the complete book continues from the paragraph at the top of the preview, located by its text.
 {const lines=text=>{const cut=text.lastIndexOf(' ',text.length>>1);return [{text:text.slice(0,cut),x:70,y:700,width:400,height:11},{text:text.slice(cut+1),x:40,y:684,width:430,height:11}];};
  const pageText=n=>Array.from({length:12},(_,i)=>`Frase ${i} da página ${n} conta a vida de Marx em Londres.`).join(' ');
  const full=builder.buildPdfReflowDocument(Array.from({length:6},(_,i)=>({pageNumber:i+1,pageWidth:500,pageHeight:760,images:[],textItems:lines(pageText(i+1))})),6);
  const paragraphs=full.chapters.flatMap(c=>c.blocks).filter(b=>b.type==='paragraph').map(b=>b.text);assert.equal(paragraphs.length,6);
  const preview={pageCount:3,blocks:paragraphs.slice(0,3).map(text=>({type:'paragraph',text}))};
  const offer=()=>renderer.root.findAll(n=>n.props.accessibilityHint==='Abre as primeiras páginas enquanto o restante é preparado'&&typeof n.props.onPress==='function');
  const previewReader=()=>renderer.root.findAllByType('PdfReflowPreviewReader');
  fixture='reflow';await act(async()=>{renderer=create(React.createElement(ReaderScreen,{bookId:'saved-place'}));});
  await act(async()=>renderer.root.findByType('PdfReflowProcessor').props.onPreview(preview));
  assert.equal(offer().length,0,'a saved position is never replaced by the opening pages');await act(async()=>renderer.unmount());
  fixture='preview';writes.length=0;await act(async()=>{renderer=create(React.createElement(ReaderScreen,{bookId:'preview'}));});
  assert.equal(offer().length,0);await act(async()=>renderer.root.findByType('PdfReflowProcessor').props.onPreview(preview));
  assert.equal(offer().length,1,'offered once the first pages are ready');await act(async()=>offer()[0].props.onPress());
  assert.equal(previewReader().length,1);assert.deepEqual(previewReader()[0].props.preview,preview);
  assert.equal(renderer.root.findAllByType('PdfReflowProcessor').length,1,'preparation goes on underneath');
  await act(async()=>{assert.equal([...back].at(-1)(),true)});assert.equal(previewReader().length,0,'Back closes the preview');assert.equal(renderer.root.findAllByType('PdfReflowProcessor').length,1,'without cancelling the preparation');
  await act(async()=>offer()[0].props.onPress());await act(async()=>previewReader()[0].props.onResumeText(paragraphs[2]));
  await flushTimers();assert.equal(writes.length,0,'reading the preview writes no progress');
  await act(async()=>renderer.root.findByType('PdfReflowProcessor').props.onComplete(full,undefined,true));
  assert.equal(previewReader().length,0);assert.equal(offer().length,0);
  const resume=getDoc().props.restoreTextAnchor;assert.equal(resume.chapterId,'preview-reflow-0');assert.ok(paragraphs[2].startsWith(resume.quote),'continues at the paragraph read');
  assert.equal(getDoc().props.initialRestorePending,true,'restored by the reader (missing/ambiguous reported), not assumed');assert.equal(writes.length,0);
  await act(async()=>renderer.unmount());
  writes.length=0;await act(async()=>{renderer=create(React.createElement(ReaderScreen,{bookId:'preview-lost'}));});
  await act(async()=>renderer.root.findByType('PdfReflowProcessor').props.onPreview(preview));await act(async()=>offer()[0].props.onPress());
  await act(async()=>previewReader()[0].props.onResumeText('Parágrafo que não existe no livro completo.'));
  await act(async()=>renderer.root.findByType('PdfReflowProcessor').props.onComplete(full,undefined,true));
  assert.equal(getDoc().props.restoreTextAnchor,null,'no guessed position');
  assert.ok(renderer.root.findAll(n=>typeof n.props.message==='string'&&n.props.message.includes('não foi localizado com segurança')).length>0,'and the reader is told');
  await act(async()=>renderer.unmount());fixture='reflow';}
 console.log('PASS ReaderScreen Reflow publication/restore/persistence, EPUB layout acknowledgement, controls/settings identity, real page-1 navigation, hardware Back + preserved Original progress, Native safe owner, Leitura Livre preview (start only, Back, no progress writes, continues by text, unlocated told)');
})().catch(e=>{console.error(e);process.exitCode=1;});
