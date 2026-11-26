// Drive pelo link público (26/11/2026): sem conta Google, sem token. HTTP é fixture; nenhuma pasta real é consultada.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
function loader(mocks = {}) {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const out = {}; cache.set(file, out);
    new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText)(name => {
      if (name in mocks) return mocks[name];
      return name.startsWith('@/') ? load(name.slice(2)+'.ts') : name.startsWith('.') ? load(path.posix.join(path.posix.dirname(file),name)+'.ts') : require(name);
    },out); return out;
  } return load;
}
const deferred = () => {let resolve; const promise = new Promise(r => resolve = r); return {promise,resolve};};
const tick = () => new Promise(setImmediate);
const KEY = 'AIzaFixtureOnlyKey_0123456789abcdef';
const source = {id:'drive-source',name:'Minha pasta',kind:'google-drive',url:'folder_123456789',folderId:'folder_123456789',enabled:true,status:'active',createdAt:1};
const file = (id,name,mimeType='application/epub+zip') => ({id,name,mimeType,size:'1234',resourceKey:'key123'});
const response = data => new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
const folderMeta = {mimeType:'application/vnd.google-apps.folder'};
(async () => {
  const load = loader(), {parseDriveFolder} = load('src/data/drive/driveFolder.ts');
  for (const url of ['folder_123456789','https://drive.google.com/drive/folders/folder_123456789?usp=sharing','https://drive.google.com/drive/u/0/folders/folder_123456789','https://drive.google.com/folders/folder_123456789','https://drive.google.com/open?id=folder_123456789','https://drive.google.com/folderview?id=folder_123456789']) assert.equal(parseDriveFolder(url).folderId,source.folderId);
  assert.equal(parseDriveFolder('https://drive.google.com/drive/folders/folder_123456789?resourcekey=secret_link_key').resourceKey,'secret_link_key');
  for(const url of ['', 'abc', 'invalid folder name','http://drive.google.com/drive/folders/folder_123456789','https://drive.google.com.evil/drive/folders/folder_123456789','https://drive.google.com/file/d/folder_123456789/view','https://user@drive.google.com/open?id=folder_123456789','https://drive.google.com/open?id=bad%27id']) assert.throws(()=>parseDriveFolder(url),e=>e.code==='invalid-folder');
  console.log('PASS Drive folder ID, canonical/account/open/folderview/resource-key URLs and invalid inputs');

  const {GoogleDriveService} = load('src/data/drive/GoogleDriveService.ts');
  const service = (request, key = KEY) => new GoogleDriveService(() => key, request);
  // Nenhuma conta: sem a chave do app a leitura falha fechada, antes de qualquer rede.
  let called = 0;
  for (const missing of [null, '', 'short', 'has space in it 0123456789']) await assert.rejects(service(async()=>{called++;return response({});}, missing).list(source), e=>e.code==='configuration');
  assert.equal(called, 0, 'No request without the app key');
  const requests=[];
  const drive = service(async (url,options) => {
    requests.push({url,options});
    assert.equal(options.headers['X-Goog-Api-Key'],KEY,'App key travels in the header');
    assert.equal(options.headers.Authorization,undefined,'No Google account token, ever');
    const u=new URL(url); assert.equal(u.searchParams.has('key'),false,'Key never goes in the URL'); assert.notEqual(u.searchParams.get('alt'),'media','No media during indexing');
    if(u.pathname.endsWith('/'+source.folderId)) return response({id:source.folderId,name:'Pasta',mimeType:'application/vnd.google-apps.folder',driveId:'shared_drive'});
    if(u.pathname.endsWith('/epub1')) { assert.equal(options.headers['X-Goog-Drive-Resource-Keys'],'epub1/key123'); return response({id:'epub1',capabilities:{canDownload:true}}); }
    assert.equal(u.searchParams.get('driveId'),'shared_drive'); assert.equal(u.searchParams.get('corpora'),'drive');
    assert.equal(u.searchParams.get('q'),"'folder_123456789' in parents and trashed = false");
    if(!u.searchParams.has('pageToken')) return response({files:[file('epub1','Memórias Póstumas de Brás Cubas.epub'),file('zip','zip.zip','application/zip'),file('shortcut','O Banquete.pdf','application/vnd.google-apps.shortcut')],nextPageToken:'page2'});
    return response({files:[file('pdf2','A Sociedade do Espetáculo.pdf','application/pdf'),file('wrong','doc.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document')]});
  });
  const books=await drive.list(source); assert.deepEqual(books.map(b=>b.format),['epub','pdf']); assert.equal(requests.length,3);
  assert.ok(books.every(b=>b.sourceId===source.id)); assert.equal(books[0].author,undefined,'Do not invent authors or read EPUB to obtain them');
  assert.ok(books.every(b=>!b.url.includes(KEY)),'Stored book URLs never carry the key');
  await drive.list(source); assert.equal(requests.length,3,'Session index is reused');
  await drive.list(source,undefined,true); assert.equal(requests.length,6,'Explicit update traverses pages again');
  const acquisition=await drive.downloadRequest(source,'epub1'); assert.match(acquisition.url,/alt=media/); assert.doesNotMatch(acquisition.url,/key=/);
  assert.equal(acquisition.headers['X-Goog-Drive-Resource-Keys'],'epub1/key123'); assert.equal(acquisition.headers['X-Goog-Api-Key'],KEY); assert.equal(acquisition.headers.Authorization,undefined);
  await assert.rejects(drive.downloadRequest(source,'not-in-folder'),e=>e.code==='not-found');
  console.log('PASS public link: app key in header only, no account token, EPUB/PDF metadata, shared-drive pagination, index refresh, download headers');

  // Pasta privada: com a chave do app o Google responde 404/403; a mensagem ensina a compartilhar pelo link.
  for(const [status,code] of [[401,'expired'],[403,'api'],[404,'not-found'],[429,'rate-limit'],[503,'api']]) await assert.rejects(service(async()=>new Response('',{status})).list(source),e=>e.code===code);
  await assert.rejects(service(async()=>new Response('',{status:404})).list(source),e=>/Qualquer pessoa com o link/.test(e.message),'Private folder explains link sharing');
  const filePermission={error:{message:'secret provider details must not escape',errors:[{reason:'insufficientFilePermissions'}]}};
  await assert.rejects(service(async()=>new Response(JSON.stringify(filePermission),{status:403})).list(source),e=>e.code==='permission'&&/Qualquer pessoa com o link/.test(e.message)&&!e.message.includes('secret'));
  await assert.rejects(service(async()=>{throw new Error('Do not surface sensitive raw provider errors');}).list(source),e=>e.code==='network'&&!e.message.includes('sensitive'));
  assert.deepEqual(await service(async url=>response(new URL(url).pathname.endsWith(source.folderId)?folderMeta:{files:[]})).list(source),[]);
  await assert.rejects(service(async url=>response(new URL(url).pathname.endsWith(source.folderId)?folderMeta:{files:[],incompleteSearch:true})).list(source),e=>e.code==='api');
  await assert.rejects(service(async url=>response(new URL(url).pathname.endsWith(source.folderId)?folderMeta:{files:[],nextPageToken:'repeat'})).list(source),e=>e.code==='api');
  await assert.rejects(service(async url=>response(new URL(url).pathname.endsWith(source.folderId)?folderMeta:new URL(url).pathname.endsWith('file1')?{capabilities:{canDownload:false}}:{files:[file('file1','Book.epub')]})).downloadRequest(source,'file1'),e=>e.code==='permission');
  for (const [reason, code, category] of [['accessNotConfigured','api-disabled','DRIVE_API_DISABLED'],['SERVICE_DISABLED','api-disabled','DRIVE_API_DISABLED'],['userRateLimitExceeded','rate-limit','RATE_LIMIT']]) {
    const body={error:{message:'secret provider details must not escape',errors:[{reason}]}};
    await assert.rejects(service(async()=>new Response(JSON.stringify(body),{status:403})).list(source),e=>e.code===code&&e.category===category&&!e.message.includes('secret'));
  }
  console.log('PASS private/removed folder explains sharing by link, empty/incomplete/repeated pages, download permission, API reasons, sanitized failures');

  const gate=deferred(), controller=new AbortController(), late=service(()=>gate.promise);
  const cancelled=late.list(source,controller.signal);controller.abort();await assert.rejects(cancelled,e=>e.name==='AbortError');gate.resolve(response(folderMeta));await tick();
  const clearGate=deferred(), cleared=service(()=>clearGate.promise);const old=cleared.list(source);cleared.clearIndex(source.id);clearGate.resolve(response(folderMeta));await assert.rejects(old);
  console.log('PASS cancellation and late responses after index purge are ignored');

  // A troca de conta do Aldus limpa os índices da sessão (dados de uma conta não aparecem na outra).
  {
    let clearedSessions=0;
    const {LibraryAccountScope}=loader()('src/data/library/LibraryAccountScope.ts'); const accountScope=new LibraryAccountScope();
    loader({'./GoogleDriveService':{GoogleDriveService:class{clearSession(){clearedSessions++;}}},'@/src/data/library/LibraryAccountScope':{libraryAccountScope:accountScope}})('src/data/drive/driveDependencies.ts');
    accountScope.set('a'); accountScope.set('b'); accountScope.set(null); assert.equal(clearedSessions,3);
    console.log('PASS Aldus account switch synchronously clears Drive indexes');
  }

  const localCatalog={sourceIdentity:JSON.stringify(['google-drive',source.folderId,null]),items:books.map(item=>({...item,remoteBookId:item.drive.fileId,availability:'available'}))};
  const pluginLoad=loader({'@/src/data/sources/sourceCatalogDependencies':{sourceCatalogs:{view:()=>({catalog:localCatalog}),load:async()=>{throw Error('No source reload for a known snapshot');}}}}),{GoogleDriveSearchPlugin}=pluginLoad('src/data/scraping/GoogleDriveSearchPlugin.ts'),{SearchBooksUseCase}=pluginLoad('src/domain/usecases/SearchBooksUseCase.ts');
  const uc=new SearchBooksUseCase([],{getText:async()=>{throw Error('No public fetch for Drive');}},{canFetch:async()=>{throw Error('No robots for Drive');}},{waitFor:async()=>{}},{validate:async()=>{throw Error('No binary HEAD for Drive');}},{save:async()=>{}});
  const plugin=new GoogleDriveSearchPlugin(source);assert.equal((await uc.executeDetailed('bras cubas',[plugin])).results[0].title,books[0].title);
  const callsBeforeSearch=requests.length;await plugin.search('sociedade espetaculo');assert.equal(requests.length,callsBeforeSearch,'Search reads the local full snapshot without Drive calls');
  const noSnapshot=loader({'@/src/data/sources/sourceCatalogDependencies':{sourceCatalogs:{view:()=>({catalog:null}),load:async()=>{}}}})('src/data/scraping/GoogleDriveSearchPlugin.ts').GoogleDriveSearchPlugin;
  await assert.rejects(new noSnapshot(source).search('Dom Casmuro'),/Atualize esta fonte/,'Search never performs implicit refresh');
  console.log('PASS Drive search uses existing use case/ranker and local persisted snapshot without API calls/download');

  const storeLoad=loader({'@/src/data/drive/driveDependencies':{googleDrive:drive},'@/src/data/sources/sourceCatalogDependencies':{sourceCatalogs:{view:()=>({catalog:localCatalog}),load:async()=>{}}},'@/src/data/sources/UserSourceRepository':{UserSourceRepository:class{async list(){return [source];}}},'@/src/presentation/services/dependencies':{appDependencies:{searchBooks:uc}}});
  const store=storeLoad('src/presentation/stores/searchStore.ts').useSearchStore;
  store.getState().setQuery('bras cubas');await store.getState().search(source.name);assert.equal(store.getState().results[0].sourceId,source.id);assert.equal(store.getState().sourceStatuses.length,1);
  console.log('PASS source-specific Drive selection runs only its adapter');

  let saved=null;
  const persistent=loader({'@react-native-async-storage/async-storage':{getItem:async()=>saved,setItem:async(_k,v)=>{saved=v;}},'@/src/data/drive/driveDependencies':{googleDrive:drive},'@/src/data/sources/sourceCatalogDependencies':{sourceCatalogs:{load:async()=>{},refresh:async()=>{},remove:async()=>{},cancel:()=>{},reset:async()=>{}}}});
  const sourceStore=persistent('src/presentation/stores/sourceStore.ts').useSourceStore;
  await sourceStore.getState().add(source);assert.equal(sourceStore.getState().sources[0].id,source.id,'Probe ID must survive persistence');assert.equal(sourceStore.getState().sources[0].folderId,source.folderId);assert.doesNotMatch(saved,new RegExp(KEY));
  await sourceStore.getState().remove(source.id);assert.deepEqual(JSON.parse(saved),[]);
  console.log('PASS real source repository stable ID/configuration persistence and removal without library deletion; app key never persisted');

  const resolver=loader({'@/src/data/drive/driveDependencies':{googleDrive:drive},'@/src/data/sources/UserSourceRepository':{UserSourceRepository:class{async list(){return [source];}}}})('src/data/drive/DriveDownloadResolver.ts').driveDownloadResolver;
  const resolved=await resolver.resolve({url:books[0].url,drive:{sourceId:source.id,fileId:'epub1'}},new AbortController().signal);assert.match(resolved.url,/alt=media/);assert.equal(resolved.headers['X-Goog-Api-Key'],KEY);assert.equal(resolved.headers.Authorization,undefined);
  await assert.rejects(resolver.resolve({drive:{sourceId:'removed-source',fileId:'epub1'}},new AbortController().signal),e=>e.code==='disconnected');
  assert.deepEqual(await resolver.resolve({url:'https://public.example/book.epub'},new AbortController().signal),{url:'https://public.example/book.epub',headers:{}});
  console.log('PASS Drive resolver: source membership, app key header only for the transfer, public fallback');

  // Nenhum resto do acesso à conta: escopo restrito, módulo nativo e tela de escolha de pastas saíram do app.
  const tree = dir => fs.readdirSync(dir,{withFileTypes:true}).flatMap(d=>d.isDirectory()?tree(path.join(dir,d.name)):[path.join(dir,d.name)]);
  const code = [...tree('src'),...tree('app')].filter(f=>/\.(ts|tsx)$/.test(f)).map(f=>fs.readFileSync(f,'utf8')).join('\n');
  assert.doesNotMatch(code,/auth\/drive\.readonly|auth\/drive"|AldusDriveAuth|accounts\.google\.com\/gsi|DriveFolderPicker/);
  assert.equal(fs.existsSync('modules/aldus-drive-auth'),false);
  console.log('PASS no Drive account scope, native authorization module or folder browser left in the app');
})().catch(e=>{console.error(e);process.exitCode=1;});
