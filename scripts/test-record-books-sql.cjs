// Migration 20261118120000_record_books on PostgreSQL/PGlite over the full local chain (profiles, library, fences, plans, admin,
// quota reservations). Not remote proof: the deployed database is checked separately before applying.
const assert = require('node:assert/strict'), fs = require('node:fs');
const { fixture } = require('./admin-test-fixture.cjs');
(async () => {
  const f = await fixture({ quota: true }), { db, as } = f;
  const q = async (sql, args = []) => (await db.query(sql, args)).rows;
  const apply = async (book, payload, kind = 'book', id = book, base = 0, deleted = false) => (await q('select public.library_apply($1,$2,$3,$4,$5,$6,$7) as r', [f.id(), book, kind, id, base, payload, deleted]))[0].r;
  const invalid = work => assert.rejects(work, error => /invalid book/.test(error.message));
  const before = await q('select * from public.user_library_items order by user_id,kind,id');
  await db.exec(fs.readFileSync('supabase/migrations/20261118120000_record_books.sql', 'utf8'));
  assert.deepEqual(await q('select * from public.user_library_items order by user_id,kind,id'), before, 'existing rows untouched');
  // Grants are kept: the private implementation stays closed, the public wrapper and snapshot stay callable.
  const grants = await q("select has_function_privilege('authenticated','library_private.library_apply(uuid,text,text,text,bigint,jsonb,boolean)','execute') as private, has_function_privilege('authenticated','public.saas_account_snapshot()','execute') as snapshot, has_function_privilege('authenticated','saas_private.quota_usage(uuid)','execute') as usage");
  assert.deepEqual(grants[0], { private: false, snapshot: true, usage: false });

  await db.exec("reset role; update public.saas_plans set synced_books=1 where id='free'");
  await as('owner');
  const record = (n, extra = {}) => ({ title: 'Livro ' + n, author: 'Autora', format: 'record', kind: 'record', recordFormat: 'physical', catalogId: 'ol:OL' + n + 'W', catalogCategories: ['fantasia'], ...extra });
  // A book without a file is accepted and never counted.
  assert.equal((await apply('record-aaaaaaaa1', record(1))).accepted, true);
  assert.equal((await apply('record-aaaaaaaa2', record(2))).accepted, true);
  assert.equal((await apply('book-file-1', { title: 'Com arquivo', format: 'epub' })).accepted, true, 'the only counted book fits the quota of 1');
  for (let n = 3; n <= 6; n++) assert.equal((await apply(`record-aaaaaaaa${n}`, record(n))).accepted, true, 'records never hit the quota');
  await assert.rejects(apply('book-file-2', { title: 'Outro', format: 'pdf' }), error => error.code === 'PQL01', 'file books still respect the quota');
  const usage = (await q('select public.saas_quota_snapshot() as r'))[0].r.usage.syncedBooks;
  const plan = (await q('select public.saas_account_snapshot() as r'))[0].r;
  assert.equal(usage, 1); assert.equal(plan.usage.syncedBooks, 1); assert.equal(plan.remaining.syncedBooks, 0, 'Meu Plano counts only file books');
  // Guards: a record has no private path and only the record- identity; other formats stay refused.
  await invalid(apply('record-bbbbbbbb1', record(7, { remotePath: `${f.ids.owner}/record-bbbbbbbb1/${'a'.repeat(64)}.epub` })));
  await invalid(apply('book-x-record', record(8)));
  await invalid(apply('record-short', record(9)));
  await invalid(apply('record-cccccccc1', { title: 'X', format: 'mobi' }));
  // Children of a book without a file (organization: Quero ler, rating, manual progress) are accepted; updates and deletion work.
  assert.equal((await apply('record-aaaaaaaa1', { bookId: 'record-aaaaaaaa1', favorite: false, collections: [], tags: [], series: '', volume: null, readingStatus: null, wantToRead: true, rating: 4, manualProgress: { page: 10, totalPages: 100, updatedAt: 1 } }, 'organization', 'record-aaaaaaaa1')).accepted, true);
  const row = (await q("select revision from public.user_library_items where kind='book' and id='record-aaaaaaaa1'"))[0];
  assert.equal((await apply('record-aaaaaaaa1', record(1, { title: 'Renomeado' }), 'book', 'record-aaaaaaaa1', row.revision)).accepted, true);
  const row2 = (await q("select revision from public.user_library_items where kind='book' and id='record-aaaaaaaa1'"))[0];
  assert.equal((await apply('record-aaaaaaaa1', record(1), 'book', 'record-aaaaaaaa1', row2.revision, true)).accepted, true, 'deleted');
  // The other account sees none of it.
  await as('second');
  assert.equal((await q("select count(*)::int as n from public.user_library_items where id like 'record-%'"))[0].n, 0);
  console.log('PASS record books SQL: migration keeps rows and grants; books without a file accepted, never counted by the trigger, quota usage or Meu Plano; file books still limited; private path, identity and format guards; organization children, update and delete; account isolation. PGlite, not the remote database.');
})().catch(error => { console.error(error); process.exit(1); });
