const assert=require('node:assert/strict'),JSZip=require('jszip');
const React=require('../.expo/auth-test-tools/node_modules/react'),{act,create}=require('../.expo/auth-test-tools/node_modules/react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT=true;
const load=require('./community-test-loader.cjs')({react:React,'react/jsx-runtime':require('../.expo/auth-test-tools/node_modules/react/jsx-runtime'),'react-native':{View:'View',Text:'Text',Image:'Image',ActivityIndicator:'ActivityIndicator',StyleSheet:{create:v=>v,absoluteFill:{position:'absolute'},hairlineWidth:1}}});
const {EpubParserService}=load('src/data/epub/EpubParserService.ts'),{BookCover}=load('src/presentation/components/BookCover.tsx'),{editorialCover}=load('src/presentation/components/bookCoverPresentation.ts');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN9sAAAAASUVORK5CYII=','base64');
async function epub(kind,image=png){
 const z=new JSZip();z.file('mimetype','application/epub+zip');z.file('META-INF/container.xml','<container><rootfiles><rootfile full-path="OPS/book.opf"/></rootfiles></container>');
 z.file('OPS/book.opf',`<package><metadata><title>Teste</title>${kind==='legacy'?'<meta name="cover" content="art"/>':''}</metadata><manifest><item id="text" href="text.xhtml"/><item id="art" href="images/cover.png" media-type="image/png" ${kind==='modern'?'properties="nav cover-image"':''}/></manifest><spine><itemref idref="text"/></spine>${kind.startsWith('guide')?'<guide><reference type="cover" href="cover.xhtml"/></guide>':''}</package>`);
 z.file('OPS/text.xhtml','<h1>Texto</h1><p>Conteúdo preservado.</p>');z.file('OPS/images/cover.png',image);z.file('cover.png',image);z.file('OPS/cover.xhtml',kind==='guide-parent'?'<img src="../cover.png"/>':'<img src="images/cover.png"/>');
 return z.generateAsync({type:'uint8array'});
}
(async()=>{
 const parser=new EpubParserService();let reference;
 for(const kind of ['modern','legacy','guide','guide-parent']){const p=await parser.parse(await epub(kind));assert.equal(p.coverImagePath,'data:image/png;base64,'+png.toString('base64'));reference??=p.chapters;assert.deepEqual(p.chapters,reference);}
 for(const [kind,data] of [['none',png],['modern',Buffer.from('broken')],['modern',Buffer.alloc(1048577)]])assert.equal((await parser.parse(await epub(kind,data))).coverImagePath,null);
 const controller=new AbortController();controller.abort();await assert.rejects(parser.parse(await epub('modern'),controller.signal),e=>e.name==='AbortError');
 const design=editorialCover('stable','Livro.pdf','');assert.equal(design.title,'Livro');assert.equal(design.author,'Autor não informado');assert.deepEqual(design,editorialCover('stable','Livro.pdf',''));
 assert.equal(editorialCover('stable','Título .pdf no meio').title,'Título .pdf no meio');
 assert.equal(editorialCover('pdf','PDF','Arquivo local').author,'Autor não informado');
 const {aldusCoverDesign,coverHash}=load('src/domain/catalog/defaultCover.ts');
 assert.deepEqual(editorialCover('id-1','Dom Casmurro.epub','Machado de Assis'),editorialCover('id-2','Dom Casmurro','Machado de Assis'),'same title and author, same cover');
 assert.equal(coverHash('abc'),coverHash('abc'));const names=new Set(['Iracema','O Cortiço','Os Sertões','Dom Casmurro','Quincas Borba','A Moreninha','Senhora','Lucíola','Helena','Esaú e Jacó'].map(t=>aldusCoverDesign(t,'Autor').palette.name));assert.ok(names.size>=4,'the shelf varies: '+[...names]);
 assert.equal(aldusCoverDesign('Iracema').titleSize,40);assert.equal(aldusCoverDesign('x'.repeat(90)).titleSize,21);assert.equal(aldusCoverDesign('x'.repeat(90)).titleLines,5);
 let view;const render=async p=>act(async()=>{const e=React.createElement(BookCover,{identity:'A',title:'Título longo '.repeat(20),author:'Autora',format:'epub',...p});if(view)view.update(e);else view=create(e);});
 try{
  await render({source:{uri:'file:///cover.jpg'},thumbnail:{uri:'file:///thumbnail.jpg'}});
  const image=()=>view.root.findByType('Image');assert.equal(image().props.resizeMode,'contain');
  await act(async()=>image().props.onError());assert.equal(image().props.source.uri,'file:///thumbnail.jpg');
  await act(async()=>image().props.onLoad({nativeEvent:{source:{width:12,height:12}}}));assert.equal(view.root.findAllByType('Image').length,0);
  await render({identity:'B',source:{uri:'file:///valid.jpg'}});
  await act(async()=>image().props.onLoad({nativeEvent:{source:{width:300,height:450}}}));assert.equal(view.root.findAllByProps({testID:'book-cover-loading'}).length,0);
  await render({identity:'B',source:{uri:'file:///replacement.jpg'}});assert.equal(view.root.findAllByProps({testID:'book-cover-loading'}).length,1);
  await act(async()=>image().props.onLoad({nativeEvent:{target:{naturalWidth:300,naturalHeight:450}}}));assert.equal(view.root.findAllByProps({testID:'book-cover-loading'}).length,0);
  await render({identity:'web-tiny',source:{uri:'file:///web-tiny.jpg'},thumbnail:{uri:'file:///web-valid.jpg'}});
  await act(async()=>image().props.onLoad({nativeEvent:{target:{naturalWidth:1,naturalHeight:1}}}));assert.equal(image().props.source.uri,'file:///web-valid.jpg');
  await act(async()=>image().props.onLoad({nativeEvent:{}}));assert.equal(view.root.findAllByType('Image').length,0);assert.equal(view.root.findAllByProps({testID:'book-cover-loading'}).length,0);
  await render({identity:'drive-file',source:null,format:'pdf',compact:true});assert.equal(view.root.findAllByType('Image').length,0);
  // Approved Aldus default cover (18/11): drawn after layout, top label is the real file format, compact keeps frame/label/title only.
  const texts=()=>view.root.findAllByType('Text').map(t=>t.children.join(''));
  await act(async()=>view.root.findByProps({testID:'book-cover'}).props.onLayout({nativeEvent:{layout:{width:200,height:300}}}));
  assert.deepEqual(texts(),['PDF','Título longo '.repeat(20).trim()],'compact: format label and title only');
  await render({identity:'full',source:null,format:'epub',title:'Dom Casmurro',author:'Machado de Assis'});
  await act(async()=>view.root.findByProps({testID:'book-cover'}).props.onLayout({nativeEvent:{layout:{width:400,height:600}}}));
  assert.deepEqual(texts(),['EPUB','Dom Casmurro','MACHADO DE ASSIS','ALDUS'],'full cover: label, title, author, mark');
 }finally{if(view)await act(async()=>view.unmount());}
 console.log('PASS covers: EPUB 3/2/guide, absent/broken/bounded/cancelled; chapters unchanged; deterministic editorial; failure/thumbnail/tiny/reset/list/Drive. No remote book downloads.');
})().catch(e=>{console.error(e);process.exitCode=1;});
