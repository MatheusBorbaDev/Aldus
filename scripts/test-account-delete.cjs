// Account deletion (owner's request, 17/11/2026). Edge Function handler with a controlled Supabase client (session, admin refusal,
// file removal page by page and verified, Auth deletion only after files are gone, no secrets in replies) and the migration in PGlite
// with the real migrations (a user with an upload reservation can be deleted; before it, the reference blocked the deletion).
const assert = require('node:assert/strict'), fs = require('node:fs');
const { loader } = require('./library-test-utils.cjs');
const { createAccountDeleteHandler, ACCOUNT_DELETE_CONFIRMATION, PRIVATE_LIBRARY_BUCKET } = loader()('supabase/functions/account-delete/handler.ts');
const { fixture } = require('./admin-test-fixture.cjs');
const USER = '33333333-3333-4333-8333-333333333333';
const envValues = { SUPABASE_URL: 'https://example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'SERVER_SECRET_CANARY' };

function fakeClient(state) {
  const tree = state.tree;
  return {
    auth: {
      getUser: async token => token === 'valid-session' ? { data: { user: { id: USER } }, error: null } : { data: { user: null }, error: { message: 'bad' } },
      admin: { deleteUser: async id => { state.deleted.push(id); return { error: state.deleteError ? { message: 'x' } : null }; } },
    },
    from: table => ({ select: () => ({ eq: (_c, value) => ({ maybeSingle: async () => {
      assert.equal(table, 'aldus_admin_members'); return state.memberError ? { data: null, error: { message: 'x' } } : { data: state.admins.includes(value) ? { user_id: value } : null, error: null };
    } }) }) }),
    storage: { from: bucket => {
      assert.equal(bucket, PRIVATE_LIBRARY_BUCKET);
      return {
        list: async (folder, { limit, offset }) => {
          if (state.listError) return { data: null, error: { message: 'x' } };
          state.lists.push(folder);
          const prefix = folder + '/', names = new Map();
          for (const path of tree) if (path.startsWith(prefix)) { const rest = path.slice(prefix.length), [head, ...tail] = rest.split('/'); names.set(head, tail.length ? null : 'file'); }
          const entries = [...names].sort().map(([name, kind]) => ({ name, id: kind ? 'object-' + name : null }));
          return { data: entries.slice(offset, offset + limit), error: null };
        },
        remove: async paths => { state.batches.push(paths.length); if (!state.keepFiles) for (const p of paths) tree.delete(p); return { error: state.removeError ? { message: 'x' } : null }; },
      };
    } },
  };
}
const run = async (state, init = {}) => {
  const created = [];
  const handler = createAccountDeleteHandler((url, key) => { created.push(key); return fakeClient(state); }, name => envValues[name]);
  const response = await handler(new Request('https://example.invalid/functions/v1/account-delete', {
    method: init.method ?? 'POST', headers: { 'content-type': 'application/json', ...(init.auth === false ? {} : { authorization: 'Bearer ' + (init.token ?? 'valid-session') }) },
    body: init.method === 'GET' || init.method === 'OPTIONS' ? undefined : (init.body ?? JSON.stringify({ confirmation: init.confirmation ?? 'excluir minha conta' })),
  }));
  const text = response.status === 204 ? '' : await response.text();
  assert.ok(!text.includes('SERVER_SECRET_CANARY') && !text.includes(USER), 'no secret or account id in the reply');
  return { status: response.status, body: text ? JSON.parse(text) : null, created };
};
const newState = extra => ({ tree: new Set(), deleted: [], lists: [], batches: [], admins: [], ...extra });

(async () => {
  // 1. Handler.
  assert.equal(ACCOUNT_DELETE_CONFIRMATION, 'EXCLUIR MINHA CONTA');
  assert.equal((await run(newState(), { method: 'OPTIONS' })).status, 204);
  assert.equal((await run(newState(), { method: 'GET' })).status, 405);
  let state = newState();
  assert.deepEqual((await run(state, { auth: false })).body, { error: 'session' }); assert.deepEqual(state.deleted, []);
  assert.deepEqual((await run(state, { token: 'forged' })).body, { error: 'session' }); assert.deepEqual(state.deleted, []);
  assert.deepEqual((await run(state, { confirmation: 'excluir' })).body, { error: 'confirmation' }); assert.deepEqual(state.deleted, []);
  assert.deepEqual((await run(state, { body: 'x'.repeat(2000) })).body, { error: 'body' });
  state = newState({ admins: [USER] });
  assert.deepEqual(await run(state).then(r => [r.status, r.body]), [409, { error: 'admin' }]); assert.deepEqual(state.deleted, [], 'administration accounts are refused');
  // Files in nested folders, more than one page and more than one removal batch.
  const files = [];
  for (let book = 0; book < 3; book++) for (let i = 0; i < (book === 0 ? 1100 : 40); i++) files.push(`${USER}/book-${book}/${String(i).padStart(64, '0')}.epub`);
  state = newState({ tree: new Set(files) });
  const ok = await run(state);
  assert.deepEqual([ok.status, ok.body], [200, { deleted: true }]);
  assert.equal(state.tree.size, 0, 'every file removed'); assert.equal(state.batches.reduce((a, b) => a + b, 0), files.length);
  assert.ok(state.batches.every(size => size <= 100), 'batches of at most 100'); assert.deepEqual(state.deleted, [USER], 'Auth user deleted once, after the files');
  assert.deepEqual(ok.created, ['SERVER_SECRET_CANARY'], 'service role only inside the function');
  for (const failure of [{ listError: true }, { removeError: true }, { keepFiles: true }]) {
    state = newState({ tree: new Set(files.slice(0, 5)), ...failure });
    assert.deepEqual((await run(state)).body, { error: 'files' }, JSON.stringify(failure)); assert.deepEqual(state.deleted, [], 'no deletion while files remain');
  }
  state = newState({ deleteError: true }); assert.deepEqual((await run(state)).body, { error: 'delete' });
  state = newState({ memberError: true }); assert.deepEqual((await run(state)).body, { error: 'unavailable' }); assert.deepEqual(state.deleted, []);

  // 2. Migration with the real migrations in PGlite.
  // Auth admin deleteUser removes sessions and factors itself; the PGlite stand-ins have no cascade, so the test does it first.
  const deleteUser = (db, id) => db.query('delete from auth.sessions where user_id=$1', [id]).then(() => db.query('delete from auth.mfa_factors where user_id=$1', [id])).then(() => db.query('delete from auth.users where id=$1', [id]));
  const reservation = "insert into saas_private.upload_reservations(user_id,path,bytes,expires_at,state) values($1::uuid,$1::text||'/book/abc.epub',100,now()+interval '1 day','committed')";
  let { db, ids } = await fixture({ quota: true });
  await db.query(reservation, [ids.user]);
  await assert.rejects(deleteUser(db, ids.user), /upload_reservations/, 'before: the reservation blocked deleting the account');
  ({ db, ids } = await fixture({ quota: true }));
  await db.exec(fs.readFileSync('supabase/migrations/20261117120000_account_deletion.sql', 'utf8'));
  await db.query(reservation, [ids.user]);
  await deleteUser(db, ids.user);
  const left = await db.query(`select (select count(*) from public.profiles where id=$1)::int profiles, (select count(*) from saas_private.upload_reservations where user_id=$1)::int reservations,
    (select count(*) from public.user_library_items where user_id=$1)::int library, (select count(*) from public.saas_account_subscriptions where user_id=$1)::int subscription`, [ids.user]);
  assert.deepEqual(left.rows[0], { profiles: 0, reservations: 0, library: 0, subscription: 0 }, 'account rows leave by cascade');
  const others = await db.query('select count(*)::int n from public.profiles');
  assert.ok(others.rows[0].n >= 4, 'other accounts untouched');
  console.log('PASS account deletion: session required, exact confirmation, administration refused, every private file removed in batches and verified before the Auth user is deleted, no secret in replies; migration lets an account with upload reservations be deleted with all its rows (it was blocked before). Edge Function not deployed; Supabase real not exercised.');
})().catch(error => { console.error(error); process.exitCode = 1; });
