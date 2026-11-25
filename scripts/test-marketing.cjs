const fs=require('fs'),assert=require('assert/strict'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const load=require('./community-test-loader.cjs')();
const {LandingDocument}=load('src/marketing/LandingDocument.tsx');
const {initialCatalogReference:plans}=load('src/marketing/catalogReference.generated.ts');
const {publicSiteUrl}=load('src/marketing/seo.ts');
const {buildPublicHtml}=require('./write-public-web.cjs');
const initial=renderToStaticMarkup(React.createElement(LandingDocument));
const markup=initial.replace(/<style>[\s\S]*?<\/style>/g,'');
const visible=markup.replace(/<[^>]*>/g,' ');
// Abertura "A prensa" (23/11/2026). O HTML é a página já impressa: sem JavaScript ou com movimento reduzido, nada fica escondido.
assert.equal((markup.match(/<section[^>]*data-press-hero/g)||[]).length,1,'One opening hero');
assert.match(markup,/<h1 id="al-press-title" aria-label="Muito mais que uma biblioteca\.">/,'Split title keeps one readable name');
assert.ok(!/data-playing|data-intro|al-intro-wait/.test(markup),'SSR is the printed resting state');
for(const decor of ['al-press-dark','al-press-plate','al-press-edge','al-press-sorts','al-seal','al-press-stage'])assert.match(markup,new RegExp('class="'+decor+'"[^>]*aria-hidden="true"'),decor+' is decorative');
assert.match(markup,/<button type="button" class="al-press-skip">Pular abertura<\/button>/);assert.match(markup,/class="al-press-replay">.*Ver a abertura<\/button>/);
assert.equal((markup.match(/id="al-medal"/g)||[]).length,1,'Medal vectors are defined once');assert.ok((markup.match(/href="#al-medal"/g)||[]).length>=4,'Medal in header, book, final call and footer');
assert.equal(load('src/marketing/aldusProfilePath.ts').aldusProfilePath,fs.readFileSync('assets/brand/aldus-perfil-path.txt','utf8').trim(),'Same profile vector as the brand');
assert.match(markup,/class="al-ribbon" aria-label="EPUB \+ PDF, leitura local/,'Moving ribbon has one readable label');
assert.match(markup,/data-read-text[^>]*>Uma experiência que acompanha o livro inteiro: o que você lê, <span class="al-read-mark" data-read-mark="true">o que marca<\/span> e o que quer guardar\./);
assert.ok((markup.match(/<article style="--al-i:\d"/g)||[]).length>=6,'Stacked resource cards carry their order');
const css=initial.match(/<style>([\s\S]*?)<\/style>/)[1];
assert.doesNotMatch(css,/googleapis|gstatic/,'No third-party font request');
for(const font of css.match(/url\(\/fonts\/[^)]+\)/g))assert.ok(fs.existsSync('public'+font.slice(4,-1)),'Self-hosted font file '+font);
assert.ok(fs.existsSync('public/fonts/eb-garamond-OFL.txt'),'Font license shipped with the files');
const hero=fs.readFileSync('src/marketing/PressHero.tsx','utf8'),effects=fs.readFileSync('src/marketing/landingScrollEffects.ts','utf8');
for(const source of [hero,effects]){assert.match(source,/closest<HTMLElement>\('\[data-landing-scroll\], \.al-page-scroll'\)/,'Actual nested scroller');assert.doesNotMatch(source,/window\.scrollY|window\.scrollTo|preventDefault\(|setInterval\(/,'No window scroll, scroll-jacking or animation timer');assert.match(source,/prefers-reduced-motion: reduce/);}
assert.doesNotMatch(hero,/blur\(/,'Letters move on the GPU only (no per-letter blur)');
assert.match(hero,/html\.classList\.contains\('al-intro-wait'\)/,'Autoplay only on the held first load');
for(const id of ['conteudo','experiencia','recursos','como-funciona','planos','perguntas'])assert.ok(initial.includes(`id="${id}"`));
assert.equal((initial.match(/<h1[ >]/g)||[]).length,1);assert.match(initial,/href="\/auth\/signup"/);assert.match(initial,/href="\/auth\/login"/);
assert.match(visible,/Referência inicial/);assert.match(visible,/500 MiB/);assert.match(visible,/10 GiB/);assert.match(visible,/Preço ainda não disponível/);assert.match(initial,/<button[^>]*disabled=""[^>]*>Contratação ainda indisponível/);
assert.match(visible,/não vende livros e não tem função para compartilhar arquivos/,'Antipiracy FAQ');assert.doesNotMatch(visible,/não distribui/);
assert.doesNotMatch(visible,/\b(Free|OWNER|ADMIN|Dashboard|Storage|Sync|Churn)\b/);
assert.ok(!initial.includes('/admin'));assert.ok(!initial.includes('PRIVATE_CONTENT_CANARY'));
const updated=plans.map(p=>({...p,limits:{...p.limits,syncedBooks:137},priceBrlCentavos:p.id==='pro'?3990:p.priceBrlCentavos}));
const authed=renderToStaticMarkup(React.createElement(LandingDocument,{signedIn:true,catalog:updated}));
assert.match(authed,/href="\/library"/);assert.match(authed,/Catálogo consultado com sua sessão/);assert.match(authed,/137/);assert.match(authed,/39,90/);assert.match(authed,/apenas informativo/);
const template='<!doctype html><html lang="en"><head><title>Expo</title></head><body><noscript>You need to enable JavaScript to run this app.</noscript><div id="root"></div><script src="/entry.js"></script></body></html>';
const absent=buildPublicHtml(template);assert.match(absent.html,/<head>[\s\S]*al-intro-wait[\s\S]*<\/head>/,'Head holds the dark screen before hydration');assert.match(absent.html,/setTimeout\(function\(\)\{r\.classList\.remove\('al-intro-wait'\)\},8000\)/,'Held screen has a deadline');assert.doesNotMatch(absent.appHtml,/al-intro-wait/,'App shell has no opening');assert.match(absent.html,/<html lang="pt-BR">/);assert.match(absent.html,/<h1/);assert.match(absent.html,/og:locale/);assert.equal(absent.sitemap,null);assert.ok(!absent.html.includes('rel="canonical"'));assert.match(absent.robots,/Disallow: \/admin/);assert.match(absent.html,/entry.js/);
assert.doesNotMatch(absent.html,/You need to enable JavaScript/,'Public prerender must not retain the generic English Expo notice');
assert.match(absent.appHtml,/noindex,nofollow/);assert.doesNotMatch(absent.appHtml,/<h1/);assert.match(absent.appHtml,/id="root"><\/div>/);assert.match(absent.appHtml,/entry.js/);
const known=buildPublicHtml(template,{siteUrl:'https://aldus.example.invalid/'});assert.match(known.html,/rel="canonical" href="https:\/\/aldus.example.invalid\/"/);assert.match(known.sitemap,/<loc>https:\/\/aldus.example.invalid\/<\/loc>/);assert.match(known.robots,/Sitemap:/);
for(const invalid of ['javascript:alert(1)','https://user:secret@example.invalid/','https://example.invalid/?token=secret','https://example.invalid/#token','https://example.invalid/app']){assert.equal(publicSiteUrl(invalid),null);assert.throws(()=>buildPublicHtml(template,{siteUrl:invalid}),/Value redacted/);}
assert.match(fs.readFileSync('src/presentation/components/AccountEntry.tsx','utf8'),/Redirect href="\/library"/,'Native entry remains unchanged');
assert.match(fs.readFileSync('app/index.tsx','utf8'),/export default AccountEntry/);
// 25/11/2026: on the site "/" is the landing, so a finished login (Google included) goes to /auth/continue, which renders the same entry.
assert.match(fs.readFileSync('app/auth/continue.tsx','utf8'),/export default AccountEntry/);
for (const f of ['callback','login','signup','complete-profile','reset-password']) assert.doesNotMatch(fs.readFileSync(`app/auth/${f}.tsx`,'utf8'),/replace\("\/"\)|Redirect href="\/"/,f+' uses homeAfterAuth');
assert.match(fs.readFileSync('app/_layout.tsx','utf8'),/Stack.Protected guard=\{appReady\}/);
require('child_process').execFileSync(process.execPath,['scripts/generate-public-catalog.cjs','--check'],{stdio:'pipe'});
// Real Web entry component: an authenticated account still needing a username
// must reach the existing completion screen instead of seeing a signup loop.
let accountState={loading:false,session:null,profile:null};
const entryLoad=require('./community-test-loader.cjs')({
 'expo-router':{Redirect:({href})=>React.createElement('a',{'data-profile-redirect':href})},
 'expo-router/head':()=>null,
 '@/src/presentation/contexts/AuthContext':{useAuth:()=>accountState},
 '@/src/presentation/services/dependencies':{accountPlanRepository:{readCatalog:async()=>null}},
 '@/src/presentation/saas/useSaasRead':{useSaasRead:()=>({data:null})},
 '@/src/legal/legalConfig':{legalIdentity:{contactEmail:null}},
 './LandingDocument':{LandingDocument:({signedIn})=>React.createElement('main',{'data-entry-state':signedIn?'signed-in':'guest'})},
});
const Entry=entryLoad('src/marketing/LandingPage.web.tsx').LandingPage;
const renderEntry=()=>renderToStaticMarkup(React.createElement(Entry));
assert.match(renderEntry(),/data-entry-state="guest"/);
const complete={id:'synthetic-a',username:'reader_a',account_status:'active'};
accountState={loading:false,session:{user:{id:'synthetic-a'}},profile:{...complete,username:null}};
assert.match(renderEntry(),/data-profile-redirect="\/auth\/complete-profile"/,'Fresh verified account must complete its profile');
accountState.profile=complete;assert.match(renderEntry(),/data-entry-state="signed-in"/);
for(const profile of [{...complete,id:'synthetic-b',username:null},{...complete,account_status:'disabled',username:null},null]){
 accountState.profile=profile;const html=renderEntry();assert.doesNotMatch(html,/data-profile-redirect/);assert.match(html,/data-entry-state="guest"/);
}
accountState={loading:true,session:{user:{id:'synthetic-a'}},profile:{...complete,username:null}};
assert.doesNotMatch(renderEntry(),/data-profile-redirect/,'Do not navigate during profile resolution');
console.log('PASS press-opening SSR (printed resting state, one heading, decorative layers, medal once, self-hosted font, head hold with deadline), nested-scroll effects, public login/signup/library links, localized initial/authenticated catalog, no active purchase/private data, SEO and profile routing; Native entry/protected stack preserved. Browser and phone proof are separate.');
