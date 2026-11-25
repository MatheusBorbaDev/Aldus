// Runs only in local PostgreSQL WASM. Never connects to Supabase. Admin helpers are stubbed: who is admin and MFA are set per test.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { PGlite } = require(path.resolve('.expo/flashcard-db-test/node_modules/@electric-sql/pglite'));
const a = '00000000-0000-4000-8000-000000000001', admin = '00000000-0000-4000-8000-0000000000aa';
(async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
      create table public.profiles(id uuid primary key, account_status text not null default 'active');
      insert into public.profiles values ('${a}','active'), ('${admin}','active');
      create schema aldus_admin_private;
      create table aldus_admin_private.flags(mfa boolean not null);
      insert into aldus_admin_private.flags values (true);
      create function aldus_admin_private.allowed(p text) returns boolean language sql stable security definer as $$ select auth.uid() = '${admin}'::uuid $$;
      create function aldus_admin_private.require_permission(p text) returns void language plpgsql stable security definer as $$ begin if not aldus_admin_private.allowed(p) then raise exception 'administrative access denied' using errcode='42501'; end if; end $$;
      create function aldus_admin_private.recent_mfa() returns boolean language sql stable security definer as $$ select mfa from aldus_admin_private.flags $$;
      create table public.aldus_admin_audit(id bigint generated always as identity primary key, actor uuid, resource text not null, action text not null, occurred_at timestamptz not null default now(), outcome text not null, reason text, changes jsonb not null default '{}', request_id uuid);`);
    await db.exec(fs.readFileSync('supabase/migrations/20261125120000_vestibular_readings.sql', 'utf8'));
    const as = async (id, role = 'authenticated') => { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id ?? '']); await db.exec('set role ' + role); };
    const one = async (sql, args = []) => (await db.query(sql, args)).rows[0];
    const fails = async (sql, args, pattern) => { await assert.rejects(db.query(sql, args), pattern); };
    const books = [{ position: 1, title: 'Iracema', author: 'José de Alencar' }, { position: 2, title: 'Dom Casmurro', author: 'Machado de Assis', note: 'Romance' }];
    const list = (b = books, url = 'https://www.fuvest.br/x') => JSON.stringify({ source_url: url, books: b });
    const change = 'select public.vestibular_admin_change($1,$2,$3,$4::jsonb,$5) as r';
    // Anyone (even without an account) reads the five vestibulares; nobody writes directly; the watched URL stays private.
    await as(null, 'anon');
    assert.deepEqual((await db.query('select id from public.vestibulares order by sort')).rows.map(r => r.id), ['fuvest', 'unicamp', 'ufrgs', 'uel', 'ufpr']);
    await fails("insert into public.vestibular_reading_lists(vestibular_id,exam_year,source_url,books) values('fuvest',2027,'https://x.br','[{}]')", [], /permission denied/);
    await fails('select watch_url from public.vestibulares', [], /permission denied/);
    // A regular account cannot publish, read the admin view or see suggestions.
    await as(a);
    await fails(change, ['publish', 'fuvest', 2027, list(), 'Edital oficial 2027'], /administrative access denied/);
    await fails('select public.vestibular_admin_read()', [], /administrative access denied/);
    await fails('select * from public.vestibular_suggestions', [], /permission denied/);
    // Suggestions: bounded, five per day, only active accounts.
    assert.equal((await one('select public.vestibular_suggest($1,$2) as r', ['fuvest', 'Faltou O cortiço na lista'])).r.ok, true);
    assert.equal((await one('select public.vestibular_suggest($1,$2) as r', [null, 'oi'])).r.code, 'message');
    assert.equal((await one('select public.vestibular_suggest($1,$2) as r', ['enem', 'Incluir o Enem'])).r.code, 'vestibular');
    for (let i = 0; i < 4; i++) await one('select public.vestibular_suggest($1,$2) as r', [null, 'Incluir a UERJ ' + i]);
    assert.equal((await one('select public.vestibular_suggest($1,$2) as r', [null, 'Mais uma sugestão'])).r.code, 'rate');
    await as(null, 'anon'); await fails('select public.vestibular_suggest($1,$2)', [null, 'Sem conta aqui'], /permission denied/);
    // Admin: MFA and a reason are required; invalid lists are refused; publishing is audited and readable by everyone.
    await db.exec('reset role'); await db.exec('update aldus_admin_private.flags set mfa=false'); await as(admin);
    await fails(change, ['publish', 'fuvest', 2027, list(), 'Edital oficial 2027'], /MFA/);
    await db.exec('reset role'); await db.exec('update aldus_admin_private.flags set mfa=true'); await as(admin);
    await fails(change, ['publish', 'fuvest', 2027, list(), 'curto'], /reason/);
    await fails(change, ['publish', 'fuvest', 2027, list(books, 'http://www.fuvest.br/x'), 'Edital oficial 2027'], /invalid list/);
    await fails(change, ['publish', 'fuvest', 2027, list([{ title: 'Sem autor' }]), 'Edital oficial 2027'], /invalid book 1/);
    await fails(change, ['publish', 'fuvest', 2027, list([{ title: 'A', author: 'B', price: 1 }]), 'Edital oficial 2027'], /invalid book 1/);
    assert.equal((await one(change, ['publish', 'fuvest', 2027, list(), 'Edital oficial 2027'])).r.ok, true);
    assert.equal((await one(change, ['publish', 'fuvest', 2027, list(books.slice(0, 1), 'https://www.fuvest.br/y'), 'Correção do edital'])).r.ok, true, 'republishing corrects in place');
    const view = (await one('select public.vestibular_admin_read() as r')).r;
    assert.equal(view.suggestions.length, 5); assert.equal(view.lists.length, 1); assert.deepEqual(view.alerts, []);
    assert.equal((await one(change, ['suggestion_done', null, null, JSON.stringify({ id: view.suggestions[0].id }), 'Lista corrigida'])).r.ok, true);
    assert.equal((await one('select public.vestibular_admin_read() as r')).r.suggestions.length, 4);
    await db.exec('reset role');
    assert.deepEqual((await db.query('select action from public.aldus_admin_audit order by id')).rows.map(r => r.action), ['publish', 'publish', 'suggestion_done'], 'audited');
    await as(null, 'anon');
    const lists = (await db.query('select vestibular_id, exam_year, source_url, books from public.vestibular_reading_lists')).rows;
    assert.deepEqual(lists.map(l => [l.vestibular_id, l.exam_year, l.source_url, l.books.length]), [['fuvest', 2027, 'https://www.fuvest.br/y', 1]]);
    await as(admin); assert.equal((await one(change, ['remove', 'fuvest', 2027, '{}', 'Lista publicada por engano'])).r.ok, true);
    await fails(change, ['remove', 'fuvest', 2027, '{}', 'Lista publicada por engano'], /list not found/);
    await fails(change, ['drop', 'fuvest', 2027, '{}', 'Comando desconhecido'], /unknown command/);
    // Robot (second migration): pg_net/pg_cron replaced by local fakes. Baseline first, alert only when the set of PDF links changes.
    await db.exec('reset role');
    await db.exec(`create schema net; create table net._http_response(id bigint primary key, status_code integer, content text); create sequence net.ids;
      create table net.requests(id bigint, url text);
      create function net.http_get(url text, timeout_milliseconds integer) returns bigint language plpgsql as $$ declare i bigint := nextval('net.ids'); begin insert into net.requests values (i, url); return i; end $$;
      create schema cron; create table cron.jobs(name text, schedule text, command text);
      create function cron.schedule(n text, s text, c text) returns bigint language sql as $$ insert into cron.jobs values (n, s, c) returning 1::bigint $$;`);
    await db.exec(fs.readFileSync('supabase/migrations/20261125120100_vestibular_watch.sql', 'utf8').replace(/create extension[^;]*;/g, ''));
    assert.deepEqual((await db.query('select schedule from cron.jobs order by name')).rows.map(r => r.schedule), ['15 12 * * *', '0 12 * * *']);
    await db.exec("update public.vestibulares set watch_url = 'https://www.fuvest.br/leituras' where id = 'fuvest'");
    const respond = async (status, html) => { const ids = (await db.query('select id from net.requests where id not in (select id from net._http_response)')).rows; for (const r of ids) await db.query('insert into net._http_response values ($1,$2,$3)', [r.id, status, html]); };
    const cycle = async (status, html) => { await db.exec('select aldus_admin_private.vestibular_watch_send()'); await respond(status, html); await db.exec('select aldus_admin_private.vestibular_watch_collect()'); };
    const alerts = async () => { await as(admin); const r = (await one('select public.vestibular_admin_read() as r')).r.alerts; await db.exec('reset role'); return r; };
    await cycle(200, '<a href="/edital-2027.pdf">Edital</a> hoje é 25/11');
    assert.deepEqual(await alerts(), [], 'first read is only the baseline');
    await cycle(200, '<a href="/EDITAL-2027.pdf">Edital</a> hoje é 26/11 <script>token=9</script>');
    assert.deepEqual(await alerts(), [], 'date, token or letter case do not alert');
    await cycle(503, 'fora do ar');
    assert.deepEqual(await alerts(), [], 'an outage does not alert nor erase the baseline');
    await cycle(200, `<a href="/edital-2027.pdf">Edital</a> <a href='/leituras-2028.pdf'>Leituras 2028</a>`);
    const alert = await alerts(); assert.equal(alert.length, 1); assert.equal(alert[0].vestibular_id, 'fuvest');
    await as(admin); assert.equal((await one(change, ['alert_seen', 'fuvest', null, '{}', 'Conferido no site oficial'])).r.ok, true);
    assert.deepEqual(await alerts(), [], 'seen alert leaves the panel');
    await as(a); await fails('select aldus_admin_private.vestibular_watch_send()', [], /permission denied/);
    console.log('PASS vestibular schema (PGlite): public read without account, no direct writes, hidden watch URL; suggestions bounded and rate limited for active accounts; admin publish/correct/remove needs access, MFA and a reason, validates books and https source, audited; robot: baseline first, alert only on new PDF links (not on dates, tokens, case or outages), seen alerts leave, not callable by users.');
  } finally { await db.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
