// Metadata-only book catalog, phase 1 (owner, 18/11/2026). Domain (ISBN, categories, merge, validation), open sources with a
// controlled network (Open Library search, Wikidata genres, spacing, cancel, errors) and the per-account cache.
const assert = require('node:assert/strict');
const { loader } = require('./library-test-utils.cjs');
const load = loader();
const { normalizeIsbn, parseCatalogBook, mergeCatalogBooks, categoriesFor, ALDUS_CATEGORIES } = load('src/domain/catalog/catalogBook.ts');
const { OpenLibrarySource, GoogleBooksSource, WikidataGenres, RequestSpacer, CatalogUnavailableError } = load('src/data/catalog/catalogSources.ts');
const { CatalogService, catalogCacheKey } = load('src/data/catalog/CatalogService.ts');
const { LibraryAccountScope } = load('src/data/library/LibraryAccountScope.ts');
const json = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data });
const noWait = () => new RequestSpacer(0);

(async () => {
  // 1. Domain.
  assert.equal(normalizeIsbn('85-359-0277-5'), '9788535902778', 'ISBN-10 converted');
  assert.equal(normalizeIsbn('978-85-359-0277-8'), '9788535902778');
  for (const bad of ['8535902776', '9788535902779', 'abc', '', null, 12345]) assert.equal(normalizeIsbn(bad), null, 'invalid ISBN: ' + bad);
  assert.equal(normalizeIsbn('080442957X'), '9780804429573', 'X check digit');
  assert.deepEqual(categoriesFor(['Brazilian fiction', 'Classics', 'Love stories']), ['literatura-brasileira', 'classicos', 'romance']);
  assert.deepEqual(categoriesFor(['Fiction, science fiction, general', 'Dystopias']), ['ficcao-cientifica']);
  assert.deepEqual(categoriesFor(['Accessible book', 'Protected DAISY']), [], 'no category is forced');
  assert.ok(Object.values(ALDUS_CATEGORIES).every(label => /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(label)), 'pt-BR labels');
  const valid = parseCatalogBook({ id: 'ol:OL1W', source: 'openlibrary', title: '  Dom   Casmurro ', authors: ['Machado de Assis', 'Machado de Assis', ''], firstPublishYear: 1899, isbns: ['8535902775', 'nope'], pages: 256, subjects: ['Brazilian fiction'], coverUrl: 'https://covers.openlibrary.org/b/id/12345-M.jpg', sourceUrl: 'https://openlibrary.org/works/OL1W' });
  assert.equal(valid.title, 'Dom Casmurro'); assert.deepEqual(valid.authors, ['Machado de Assis']); assert.deepEqual(valid.isbns, ['9788535902778']);
  assert.deepEqual(valid.categories, ['literatura-brasileira']);
  const hostile = parseCatalogBook({ id: 'ol:OL2W', source: 'openlibrary', title: 'X', firstPublishYear: 99999, pages: -3, coverUrl: 'https://evil.invalid/x.jpg', sourceUrl: 'javascript:alert(1)' });
  assert.deepEqual([hostile.firstPublishYear, hostile.pages, hostile.coverUrl, hostile.sourceUrl], [null, null, null, null], 'bad values become empty, never invented');
  for (const bad of [null, [], { id: 'x', title: 'T', source: 'openlibrary' }, { id: 'ol:OL3W', title: '', source: 'openlibrary' }, { id: 'ol:OL3W', title: 'T', source: 'google' }]) assert.equal(parseCatalogBook(bad), null);
  const merged = mergeCatalogBooks([valid, { ...valid, id: 'ol:OL9W', title: 'Dom Casmurro', coverUrl: null, pages: null, subtitle: 'Romance', isbns: ['9780195103083'] }]);
  assert.equal(merged.length, 1); assert.equal(merged[0].subtitle, 'Romance'); assert.equal(merged[0].pages, 256); assert.equal(merged[0].isbns.length, 2);

  // 2. Open Library.
  const urls = [];
  const olDocs = { docs: [
    { key: '/works/OL45883W', title: 'Dom Casmurro', author_name: ['Machado de Assis'], first_publish_year: 1899, language: ['por', 'eng'], isbn: ['8535902775', 'x'], number_of_pages_median: 256, subject: ['Brazilian fiction', 'Classics'], cover_i: 8231856 },
    { key: '/works/OL99W', title: 'Sem capa', author_name: ['Autora'] },
    { key: '/authors/OL1A', title: 'Not a work' },
    { key: '/works/OL77W', title: '' },
  ] };
  const ol = new OpenLibrarySource(async (url, init) => { urls.push(url); assert.ok(!('Authorization' in (init.headers ?? {})), 'no credentials'); return json(olDocs); }, noWait());
  const books = await ol.search('dom casmurro');
  assert.deepEqual(books.map(b => b.id), ['ol:OL45883W', 'ol:OL99W'], 'only valid works');
  assert.equal(books[0].coverUrl, 'https://covers.openlibrary.org/b/id/8231856-M.jpg'); assert.equal(books[1].coverUrl, null, 'no cover, no invented cover');
  assert.equal(books[0].sourceUrl, 'https://openlibrary.org/works/OL45883W'); assert.deepEqual(books[0].categories, ['literatura-brasileira', 'classicos']);
  assert.match(urls[0], /^https:\/\/openlibrary\.org\/search\.json\?q=dom\+casmurro&fields=/); assert.ok(!urls[0].includes('@'), 'no account data in the request');
  await ol.search('85-359-0277-5'); assert.match(urls[1], /[?&]isbn=9788535902778&/, 'ISBN searches by ISBN');
  await assert.rejects(new OpenLibrarySource(async () => json({}, 503), noWait()).search('x y'), e => e instanceof CatalogUnavailableError);
  await assert.rejects(new OpenLibrarySource(async () => json({}, 429), noWait()).search('x y'), e => /muitas buscas/.test(e.message));
  await assert.rejects(new OpenLibrarySource(async () => { throw Error('PRIVATE dns failure'); }, noWait()).search('x y'), e => e instanceof CatalogUnavailableError && !/PRIVATE/.test(e.message));
  const controller = new AbortController(); controller.abort();
  await assert.rejects(new OpenLibrarySource(async () => json(olDocs), noWait()).search('x y', controller.signal), e => e.name === 'AbortError');
  // Spacing: 1 per second, measured with a controlled clock.
  let clock = 0; const sleeps = [];
  const spacer = new RequestSpacer(1000, () => clock, async ms => { sleeps.push(ms); clock += ms; });
  await spacer.wait(); await spacer.wait(); await spacer.wait();
  assert.deepEqual(sleeps, [1000, 1000], 'the second and third calls wait one second each');

  // 3. Wikidata genres by ISBN.
  let sparql = '';
  const wd = new WikidataGenres(async url => { sparql = decodeURIComponent(url); return json({ results: { bindings: [{ genreLabel: { value: 'romance' } }, { genreLabel: { value: 'Q12345' } }, { genreLabel: { value: 'romance' } }, {}] } }); }, noWait());
  assert.deepEqual(await wd.byIsbn('85-359-0277-5'), ['romance'], 'labels only, unresolved ids dropped');
  assert.match(sparql, /9788535902778/); assert.deepEqual(await wd.byIsbn('not an isbn'), [], 'no request for an invalid ISBN');

  // 4. Service: per-account cache, TTL, unreadable cache, account switch.
  const store = new Map(); let now = 1_000_000, calls = 0;
  const storage = { getItem: async k => store.get(k) ?? null, setItem: async (k, v) => { store.set(k, v); } };
  const scope = new LibraryAccountScope(); scope.set('user-a');
  const source = { name: 'fake', search: async q => { calls++; return [parseCatalogBook({ id: 'ol:OL1W', source: 'openlibrary', title: q, authors: ['A'] })]; } };
  const service = new CatalogService([source], storage, scope, () => now);
  assert.deepEqual(await service.search(' x '), [], 'too short: nothing sent'); assert.equal(calls, 0);
  assert.equal((await service.search('Iracema'))[0].title, 'Iracema'); assert.equal(calls, 1);
  await service.search('IRACEMA'); assert.equal(calls, 1, 'cache hit (same normalized query)');
  assert.ok(store.has(catalogCacheKey('user-a')) && !store.has(catalogCacheKey('user-b')));
  scope.set('user-b'); await service.search('Iracema'); assert.equal(calls, 2, 'account B does not read A\'s searches');
  now += 8 * 24 * 60 * 60 * 1000; scope.set('user-a'); await service.search('Iracema'); assert.equal(calls, 3, 'expired after 7 days');
  store.set(catalogCacheKey('user-a'), '{not json'); await service.search('Senhora'); assert.equal(calls, 4, 'unreadable cache counts as empty');
  assert.ok(JSON.parse(store.get(catalogCacheKey('user-a'))).length >= 1, 'cache rewritten');
  // Cached books (base of "Para você"): this account only, expired entries out, no request.
  const before = calls; assert.deepEqual((await service.cachedBooks()).map(b => b.title), ['Senhora']); assert.equal(calls, before, 'no request');
  scope.set('user-b'); assert.deepEqual((await service.cachedBooks()).map(b => b.title), [], 'B never sees A\'s cache (B\'s entry expired)'); scope.set('user-a');
  // Shelves: fixed category queries, library affinity computed on the device, recommendations never invented.
  const { CATEGORY_QUERIES, INITIAL_SHELVES, MORE_SHELVES, libraryAffinity, recommendFor } = load('src/domain/catalog/catalogShelves.ts');
  assert.equal(Object.keys(CATEGORY_QUERIES).length, Object.keys(ALDUS_CATEGORIES).length, 'every Aldus category has a query');
  assert.equal(INITIAL_SHELVES.length + MORE_SHELVES.length, Object.keys(ALDUS_CATEGORIES).length);
  const lib = [{ id: 'r1', catalogId: 'ol:A', catalogCategories: ['fantasia'], isDeleted: false }, { id: 'r2', catalogId: 'ol:B', catalogCategories: ['terror'], isDeleted: false },
    { id: 'r3', catalogCategories: ['poesia'], isDeleted: true }, { id: 'f1', isDeleted: false }];
  const org = { r1: { readingStatus: 'completed', favorite: true }, r2: { readingStatus: 'interrupted' } };
  const affinity = libraryAffinity(lib, org);
  assert.deepEqual([...affinity], [['fantasia', 3]], 'completed + favorite weigh more; interrupted and deleted do not count');
  const cand = (id, categories) => parseCatalogBook({ id, source: 'openlibrary', title: id, authors: ['X'], subjects: categories });
  const recs = recommendFor([cand('ol:A', ['Fantasy']), cand('ol:C', ['Horror']), cand('ol:D', ['Fantasy']), cand('ol:D', ['Fantasy'])], affinity, new Set(['ol:A']));
  assert.deepEqual(recs.map(r => [r.book.id, r.because]), [['ol:D', 'fantasia']], 'owned, unrelated and repeated books are left out');
  assert.deepEqual(recommendFor([cand('ol:D', ['Fantasy'])], new Map(), new Set()), [], 'no affinity, no recommendation');
  const failing = new CatalogService([{ name: 'down', search: async () => { throw new CatalogUnavailableError(); } }], storage, scope, () => now);
  await assert.rejects(failing.search('Lucíola'), e => e instanceof CatalogUnavailableError);
  let release; const slow = new CatalogService([{ name: 'slow', search: () => new Promise(r => { release = () => r([]); }) }], storage, scope, () => now);
  const pending = slow.search('Helena'); await new Promise(r => setImmediate(r)); scope.set('user-c'); release();
  await assert.rejects(pending, /A conta mudou/, 'result from the previous account is discarded');
  // Google Books (19/11, dono: "Google Books + Open Library"): edições brasileiras, capa pelo id, ano da edição, sinopse sem HTML.
  const gbUrls = [];
  const gbBody = { items: [
    { id: 'abcDEF123456', volumeInfo: { title: 'Percy Jackson e o Ladrão de Raios', authors: ['Rick Riordan'], publishedDate: '2008-07-01', language: 'pt-BR',
      industryIdentifiers: [{ type: 'ISBN_13', identifier: '9788580575392' }, { type: 'OTHER', identifier: 'UOM:39015' }], pageCount: 400,
      categories: ['Juvenile Fiction / Fantasy & Magic'], imageLinks: { thumbnail: 'http://books.google.com/books/content?id=abcDEF123456&zoom=1' },
      description: '<p>Percy descobre que é <b>filho</b> de um deus &amp; parte numa missão.</p>' } },
    { id: 'no cover!', volumeInfo: { title: 'Id inválido' } },
    { id: 'zzzZZZ999999', volumeInfo: { title: 'Sem capa', authors: ['Autora'], publishedDate: 'sem data' } },
  ] };
  const gb = new GoogleBooksSource(async (url, init) => { gbUrls.push(url); assert.ok(!('Authorization' in (init.headers ?? {})), 'no credentials'); return json(gbBody); }, 'PUBLIC-KEY');
  const found = await gb.search('percy jackson');
  assert.equal(found.length, 2, 'invalid volume id skipped');
  const percy = found[0];
  assert.equal(percy.id, 'gb:abcDEF123456'); assert.equal(percy.source, 'googlebooks');
  assert.equal(percy.firstPublishYear, null, 'Google gives the edition date, never shown as first publication'); assert.equal(percy.editionYear, 2008);
  assert.deepEqual(percy.isbns, ['9788580575392']); assert.equal(percy.pages, 400); assert.deepEqual(percy.languages, ['pt-BR']);
  assert.ok(percy.categories.includes('infantojuvenil') && percy.categories.includes('fantasia'), 'Google categories map to Aldus categories');
  assert.equal(percy.coverUrl, 'https://books.google.com/books/content?id=abcDEF123456&printsec=frontcover&img=1&zoom=1&source=gbs_api', 'cover rebuilt from the id over https');
  assert.equal(percy.sourceUrl, 'https://books.google.com/books?id=abcDEF123456');
  assert.match(percy.description, /^Percy descobre que é filho de um deus & parte numa missão.$/, 'description without HTML');
  assert.equal(found[1].coverUrl, null, 'no thumbnail: no cover invented'); assert.equal(found[1].editionYear, null);
  const ordered = await new GoogleBooksSource(async () => json({ items: [{ id: 'enEN11111111', volumeInfo: { title: 'English', language: 'en' } }, { id: 'ptBR22222222', volumeInfo: { title: 'Português', language: 'pt-BR' } }, { id: 'esES33333333', volumeInfo: { title: 'Español', language: 'es' } }] }), 'K').search('x y');
  assert.deepEqual(ordered.map(book => book.title), ['Português', 'English', 'Español'], 'Portuguese editions first, Google order kept otherwise');
  const gbParams = new URL(gbUrls[0]).searchParams;
  assert.equal(gbParams.get('q'), 'percy jackson'); assert.equal(gbParams.get('key'), 'PUBLIC-KEY'); assert.equal(gbParams.get('printType'), 'books');
  await gb.search('85-359-0277-5'); assert.equal(new URL(gbUrls[1]).searchParams.get('q'), 'isbn:9788535902778', 'ISBN search by isbn:');
  await assert.rejects(new GoogleBooksSource(async () => json({}, 429), 'K').search('x y'), e => /muitas buscas/.test(e.message));
  assert.equal(parseCatalogBook({ ...percy, coverUrl: 'https://books.google.com/books/content?id=abc&evil=1' }).coverUrl, null, 'only the rebuilt Google cover is accepted');
  // Google first, Open Library second: the same work in both is merged, keeping the Brazilian edition's data.
  const both = new CatalogService([gb, new OpenLibrarySource(async () => json({ docs: [{ key: '/works/OL1W', title: 'Percy Jackson e o Ladrão de Raios', author_name: ['Rick Riordan'], first_publish_year: 2005, cover_i: 7 }] }), noWait())],
    { getItem: async () => null, setItem: async () => undefined }, new LibraryAccountScope());
  const bothFound = await both.search('percy jackson ladrao');
  const percyMerged = bothFound.find(book => book.title === 'Percy Jackson e o Ladrão de Raios');
  assert.equal(percyMerged.id, 'gb:abcDEF123456'); assert.equal(percyMerged.firstPublishYear, 2005, 'first publication comes from Open Library'); assert.equal(percyMerged.editionYear, 2008);

  console.log('PASS catalog phase 1: ISBN-10/13 with check digits, pt-BR Aldus categories never forced, invalid or hostile metadata emptied (never invented), merge of repeated works; Google Books (pt-BR edition, cover by volume id, edition year, plain description, isbn: path, merge with Open Library); Open Library search with cover by cover id, ISBN path, 1 request/s spacing, errors and limits explained without provider text, cancel; Wikidata genres by ISBN; per-account 7-day cache, unreadable cache ignored, account switch discards late results. Real network NOT TESTED.');
})().catch(error => { console.error(error); process.exitCode = 1; });
