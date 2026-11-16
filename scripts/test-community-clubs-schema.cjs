// Community Etapa 3 (clubes por convite e fóruns) em PostgreSQL WASM local. Nunca conecta ao Supabase; não comprova implantação.
// Aplica as migrations reais (profiles, foundation, grafo social, clubes/fóruns) e exercita contas A/B/C/anon/sem @usuário.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { PGlite } = require(path.resolve('.expo/flashcard-db-test/node_modules/@electric-sql/pglite'));
const A = '00000000-0000-4000-8000-00000000000a', B = '00000000-0000-4000-8000-00000000000b', C = '00000000-0000-4000-8000-00000000000c',
  D = '00000000-0000-4000-8000-00000000000d', E = '00000000-0000-4000-8000-00000000000e';
(async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key, raw_user_meta_data jsonb not null default '{}');
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;`);
    await db.exec(fs.readFileSync('supabase/migrations/202610060001_profiles_and_features.sql', 'utf8'));
    for (const [id, username] of [[A, 'alice'], [B, 'bob'], [C, 'carol'], [E, 'erin']]) await db.query('insert into auth.users(id, raw_user_meta_data) values($1, $2)', [id, JSON.stringify({ username, display_name: username })]);
    await db.query('insert into auth.users(id) values($1)', [D]);
    for (const file of ['202610130001_community_foundation.sql', '20261112120000_community_social_graph.sql', '20261116120000_community_clubs_forums.sql'])
      await db.exec(fs.readFileSync(path.join('supabase/migrations', file), 'utf8'));
    const actor = async (id, role = 'authenticated') => { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id ?? '']); await db.exec('set role ' + role); };
    const rows = async (sql, params = []) => (await db.query(sql, params)).rows;
    const call = async (sql, params = []) => (await rows(sql, params))[0];
    const json = async (fn, ...params) => Object.values(await call(`select public.${fn}(${params.map((_, i) => '$' + (i + 1)).join(',')}) as v`, params))[0];

    // 1. Sem escrita direta; anônimo e conta sem @usuário não usam nada.
    await actor(A);
    for (const table of ['community_clubs', 'community_club_members', 'community_club_comments', 'community_threads', 'community_posts', 'community_content_reports'])
      await assert.rejects(() => rows(`select * from public.${table}`), /permission denied/, table);
    await actor(null, 'anon'); await assert.rejects(() => call('select * from public.community_list_threads($1)', ['']), /permission denied/);
    await actor(D); await assert.rejects(() => call('select * from public.community_list_my_clubs()'), /community:account/);

    // 2. Clube por convite: dono cria, convidado entra pelo código, quem não tem o código não vê nada.
    await actor(A);
    await assert.rejects(() => call("select * from public.community_create_club('Clube', '', 'Livro', array['só um'])"), /community:text/);
    const created = await call("select * from public.community_create_club('  Leitores de Machado ', 'Leitura sem pressa', 'Memórias Póstumas de Brás Cubas', array['Capítulos 1 a 40', 'Capítulos 41 a 100', 'Até o fim'])");
    assert.match(created.invite_code, /^[A-Z0-9]{10}$/);
    const club = created.club_id;
    let detail = await json('community_club_detail', club);
    assert.equal(detail.club.name, 'Leitores de Machado'); assert.equal(detail.club.invite_code, created.invite_code, 'dono vê o código');
    assert.deepEqual(detail.club.milestones, ['Capítulos 1 a 40', 'Capítulos 41 a 100', 'Até o fim']);
    await actor(C); await assert.rejects(() => json('community_club_detail', club), /community:target/, 'quem não é membro não vê o clube');
    await assert.rejects(() => call("select public.community_join_club('ERRADO0000')"), /community:target/);
    await actor(B); assert.equal(Object.values(await call('select public.community_join_club($1)', [created.invite_code.toLowerCase()]))[0], club, 'código sem diferenciar maiúsculas');
    assert.equal(Object.values(await call('select public.community_join_club($1)', [created.invite_code]))[0], club, 'entrar de novo não duplica');
    detail = await json('community_club_detail', club);
    assert.equal(detail.club.invite_code, null, 'membro não vê o código'); assert.equal(detail.me.role, 'member');
    assert.deepEqual(detail.members.map(m => m.username), ['alice', 'bob']); assert.equal(detail.members[0].display_name, null, 'sem perfil publicado: só @usuario');
    assert.deepEqual((await rows('select * from public.community_list_my_clubs()')).map(r => [r.name, r.role, r.reached_milestone, r.milestone_count]), [['Leitores de Machado', 'member', 0, 3]]);

    // 3. Comentários presos a marcos: só no marco já alcançado; quem está antes não vê o que vem depois.
    await assert.rejects(() => call("select public.community_add_club_comment($1, 1, 'Cedo demais')", [club]), /community:milestone/, 'marco ainda não alcançado');
    await call('select public.community_set_club_milestone($1, 2)', [club]);
    await assert.rejects(() => call('select public.community_set_club_milestone($1, 4)', [club]), /community:text/);
    await call("select public.community_add_club_comment($1, 1, 'Sobre o começo')", [club]);
    const spoiler = Object.values(await call("select public.community_add_club_comment($1, 2, 'Revelação do meio')", [club]))[0];
    await assert.rejects(() => call("select public.community_add_club_comment($1, 3, 'Fim')", [club]), /community:milestone/);
    await actor(A); await call('select public.community_set_club_milestone($1, 1)', [club]);
    let comments = await json('community_list_club_comments', club);
    assert.deepEqual(comments.map(k => k.body), ['Sobre o começo'], 'quem está no marco 1 não vê o comentário do marco 2');
    await call('select public.community_set_club_milestone($1, 3)', [club]);
    comments = await json('community_list_club_comments', club);
    assert.deepEqual(comments.map(k => [k.milestone, k.body, k.author.username, k.mine]), [[1, 'Sobre o começo', 'bob', false], [2, 'Revelação do meio', 'bob', false]]);

    // 4. Moderação no clube: dono remove comentário; denúncia só de escrita; bloqueio esconde e impede entrar.
    await call('select public.community_remove_club_comment($1)', [spoiler]);
    assert.deepEqual((await json('community_list_club_comments', club)).map(k => k.body), ['Sobre o começo']);
    await actor(B); await assert.rejects(() => call('select public.community_remove_club_comment($1)', [spoiler]), /community:target/, 'removido não é removido de novo');
    const first = (await json('community_list_club_comments', club))[0].id;
    await call("select public.community_report_content('club_comment', $1, 'spam', 'teste')", [first]);
    await actor(C); await assert.rejects(() => call("select public.community_report_content('club_comment', $1, 'spam', '')", [first]), /community:target/, 'quem não é membro não denuncia o que não vê');
    await actor(E); await call('select public.community_block($1)', [A]);
    await assert.rejects(() => call('select public.community_join_club($1)', [created.invite_code]), /community:target/, 'bloqueado não entra no clube do dono');
    await actor(A); await call('select public.community_unblock($1)', [E]).catch(() => undefined);
    // Dono não sai sem excluir; membro sai; dono remove membro e troca o código.
    await assert.rejects(() => call('select public.community_leave_club($1)', [club]), /community:owner/);
    const newCode = Object.values(await call('select public.community_regenerate_invite($1)', [club]))[0];
    assert.notEqual(newCode, created.invite_code);
    await actor(C); await assert.rejects(() => call('select public.community_join_club($1)', [created.invite_code]), /community:target/, 'código antigo deixa de valer');
    await call('select public.community_join_club($1)', [newCode]);
    await actor(B); await assert.rejects(() => call('select public.community_remove_club_member($1, $2)', [club, C]), /community:target/, 'só o dono remove');
    await actor(A); await call('select public.community_remove_club_member($1, $2)', [club, C]);
    await actor(C); await assert.rejects(() => json('community_club_detail', club), /community:target/);
    await actor(B); await call('select public.community_leave_club($1)', [club]); assert.equal((await rows('select * from public.community_list_my_clubs()')).length, 0);

    // 5. Fóruns: abertos a contas ativas, spoiler marcado, bloqueio nos dois sentidos, remoção pelo autor, denúncia.
    await actor(A);
    const thread = Object.values(await call("select public.community_create_thread('O final de Brás Cubas', 'O que acharam do último capítulo?', true)"))[0];
    await assert.rejects(() => call("select public.community_create_thread('ab', 'x', false)"), /community:text/);
    await actor(B);
    let threads = await json('community_list_threads', '');
    assert.deepEqual(threads.map(t => [t.title, t.contains_spoilers, t.author.username, t.mine]), [['O final de Brás Cubas', true, 'alice', false]]);
    assert.equal((await json('community_list_threads', 'brás')).length, 1); assert.equal((await json('community_list_threads', '%')).length, 0, '% não é curinga');
    const post = Object.values(await call("select public.community_add_post($1, 'Gostei muito.', false)", [thread]))[0];
    let detailThread = await json('community_thread_detail', thread);
    assert.equal(detailThread.thread.body, 'O que acharam do último capítulo?'); assert.deepEqual(detailThread.posts.map(p => [p.body, p.mine]), [['Gostei muito.', true]]);
    await actor(C); await assert.rejects(() => call('select public.community_remove_post($1)', [post]), /community:target/, 'terceiro não remove');
    await call("select public.community_report_content('post', $1, 'harassment', '')", [post]);
    await assert.rejects(() => call("select public.community_report_content('post', $1, 'feio', '')", [post]), /community:report/);
    await actor(C); await call('select public.community_block($1)', [A]);
    assert.equal((await json('community_list_threads', '')).length, 0, 'quem bloqueou não vê tópicos do bloqueado');
    await assert.rejects(() => json('community_thread_detail', thread), /community:target/);
    await assert.rejects(() => call("select public.community_add_post($1, 'oi', false)", [thread]), /community:target/);
    await actor(A); await call('select public.community_remove_post($1)', [post]), assert.equal((await json('community_thread_detail', thread)).posts.length, 0, 'autor do tópico remove resposta');
    await actor(B); await assert.rejects(() => call('select public.community_remove_thread($1)', [thread]), /community:target/);
    await actor(A); await call('select public.community_remove_thread($1)', [thread]); assert.equal((await json('community_list_threads', '')).length, 0);

    // 6. Limites: 10 tópicos por dia; 30 comentários por hora em clubes.
    await actor(E);
    for (let i = 0; i < 10; i++) await call(`select public.community_create_thread('Tópico ${i}', 'texto', false)`);
    await assert.rejects(() => call("select public.community_create_thread('Tópico 11', 'texto', false)"), /community:limit/);
    const own = await call("select * from public.community_create_club('Clube da Erin', '', 'Dom Casmurro', array['A', 'B'])");
    await call('select public.community_set_club_milestone($1, 1)', [own.club_id]);
    for (let i = 0; i < 30; i++) await call(`select public.community_add_club_comment($1, 1, 'c${i}')`, [own.club_id]);
    await assert.rejects(() => call("select public.community_add_club_comment($1, 1, 'demais')", [own.club_id]), /community:limit/);
    await call('select public.community_delete_club($1)', [own.club_id]);
    assert.equal((await rows('select * from public.community_list_my_clubs()')).length, 0, 'dono exclui o clube');
    await db.exec('reset role');
    assert.equal((await rows('select count(*)::int as n from public.community_club_comments where club_id=$1', [own.club_id]))[0].n, 0, 'comentários saem com o clube');
    assert.equal((await rows('select count(*)::int as n from public.community_content_reports'))[0].n, 2, 'denúncias registradas para a administração');
    console.log('PASS community clubs/forums schema (PGlite local): clube só por convite (código, troca, remoção), comentários presos ao marco alcançado, dono modera, bloqueio nos dois sentidos, fóruns com spoiler e remoção pelo autor, denúncias só de escrita, limites, sem escrita direta. Não aplicado no Supabase.');
  } finally { await db.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
