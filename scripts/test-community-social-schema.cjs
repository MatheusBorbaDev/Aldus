// Community Etapa 2 (grafo social) em PostgreSQL WASM local. Nunca conecta ao Supabase; não comprova implantação remota.
// Aplica as migrations reais de profiles, community_foundation e community_social_graph e exercita contas A/B/C/anon.
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
    await db.query('insert into auth.users(id) values($1)', [D]); // conta sem @usuario
    await db.exec(fs.readFileSync('supabase/migrations/202610130001_community_foundation.sql', 'utf8'));
    await db.exec(fs.readFileSync('supabase/migrations/20261112120000_community_social_graph.sql', 'utf8'));
    const actor = async (id, role = 'authenticated') => { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id ?? '']); await db.exec('set role ' + role); };
    const admin = async () => { await db.exec('reset role'); };
    const rows = async (sql, params = []) => (await db.query(sql, params)).rows;
    const rpc = async (name, ...params) => rows(`select * from public.${name}(${params.map((_, i) => '$' + (i + 1)).join(',')})`, params);
    const visible = async () => (await rows('select username from public.community_profiles order by username')).map(r => r.username);
    const publish = (id, name, privacy) => db.query("insert into public.community_profiles(user_id,username,display_name,privacy,avatar_url) values($1,'spoofed',$2,$3,'https://evil.example/x.png')", [id, name, privacy]);

    // 1. Identidade vem da conta: @usuario e avatar enviados pelo cliente são ignorados; conta sem @usuario não publica.
    await actor(A); await publish(A, 'Alice', 'PUBLIC');
    assert.deepEqual(await rows('select username, avatar_url from public.community_profiles'), [{ username: 'alice', avatar_url: null }]);
    await db.exec("update public.community_profiles set username='bob'"); assert.deepEqual(await visible(), ['alice'], 'update também não troca o @usuario');
    await actor(D); await assert.rejects(() => publish(D, 'Dan', 'PUBLIC'), /community:account/);
    await actor(B); await publish(B, 'Bob', 'FOLLOWERS');

    // 2. Visibilidade inicial: FOLLOWERS fechado para quem não foi aceito; anônimo só vê o público.
    await actor(A); assert.deepEqual(await visible(), ['alice']);
    await actor(null, 'anon'); assert.deepEqual(await visible(), ['alice']);
    await assert.rejects(() => rpc('community_follow', B), /permission denied/);
    await actor(A);
    await assert.rejects(() => db.query("insert into public.community_follows(follower_id,following_id,status,accepted_at) values($1,$2,'accepted',now())", [A, B]), /permission denied/);
    await assert.rejects(() => db.query('insert into public.community_blocks(blocker_id,blocked_id) values($1,$2)', [A, B]), /permission denied/);
    await assert.rejects(() => rows('select * from public.community_reports'), /permission denied/);

    // 3. Encontrar e seguir: público entra direto, "seguidores" vira pedido que o dono aceita.
    assert.deepEqual(await rpc('community_find_reader', ' BOB '), [{ user_id: B, username: 'bob', display_name: 'Bob', avatar_url: null, privacy: 'FOLLOWERS', relation: 'none', follows_me: false }]);
    assert.deepEqual(await rpc('community_find_reader', 'ninguem'), []);
    assert.equal((await rpc('community_follow', B))[0].community_follow, 'pending');
    assert.equal((await rpc('community_follow', B))[0].community_follow, 'pending', 'repetir não duplica');
    assert.deepEqual(await visible(), ['alice'], 'pedido pendente não abre o perfil');
    assert.equal((await rpc('community_find_reader', 'bob'))[0].relation, 'pending');
    assert.deepEqual((await rpc('community_list_follows', 'sent')).map(r => r.username), ['bob']);
    await assert.rejects(() => rpc('community_follow', A), /community:target/, 'não segue a si mesmo');
    await assert.rejects(() => rpc('community_follow', D), /community:target/, 'sem perfil publicado');
    await actor(C); await rpc('community_respond_follow', A, true); // terceiro não aceita pedido alheio
    await actor(A); assert.deepEqual(await visible(), ['alice']); assert.equal((await rpc('community_find_reader', 'bob'))[0].relation, 'pending');
    await actor(B);
    assert.deepEqual((await rpc('community_list_follows', 'requests')).map(r => [r.username, r.display_name, r.status]), [['alice', 'Alice', 'pending']]);
    await rpc('community_respond_follow', A, true);
    assert.deepEqual((await rpc('community_list_follows', 'followers')).map(r => r.username), ['alice']);
    await actor(A); assert.deepEqual(await visible(), ['alice', 'bob'], 'seguidor aceito vê o perfil');
    assert.equal((await rpc('community_find_reader', 'bob'))[0].relation, 'following');
    assert.deepEqual((await rpc('community_list_follows', 'following')).map(r => r.username), ['bob']);
    // Quem segue sem ter perfil publicado aparece só pelo @usuario da conta.
    await actor(C); assert.equal((await rpc('community_follow', A))[0].community_follow, 'accepted');
    assert.deepEqual(await visible(), ['alice']);
    await actor(A); assert.deepEqual((await rpc('community_list_follows', 'followers')).map(r => [r.username, r.display_name]), [['carol', null]]);
    assert.equal((await rows('select count(*)::int as n from public.community_follows'))[0].n, 2, 'A só lê as próprias relações');
    await actor(E); assert.equal((await rows('select count(*)::int as n from public.community_follows'))[0].n, 0, 'terceiro não lê relações alheias');

    // 4. Busca: só perfis públicos, por prefixo, sem contagens.
    await actor(C);
    assert.deepEqual((await rpc('community_search_readers', 'AL')).map(r => r.username), ['alice']);
    assert.deepEqual(await rpc('community_search_readers', 'bo'), [], 'perfil para seguidores não aparece na busca');
    assert.deepEqual(await rpc('community_search_readers', 'a_'), [], '_ não é curinga');
    await assert.rejects(() => rpc('community_search_readers', 'a'), /community:query/);

    // 5. Atividades (derivadas pelo servidor) respeitam perfil e privacidade da atividade.
    await admin();
    await db.query("insert into public.community_activities(user_id,id,type,book_title,privacy) values($1,'pub','finished_book','Pública','PUBLIC'),($1,'fol','finished_book','Seguidores','FOLLOWERS'),($1,'pri','finished_book','Privada','PRIVATE')", [B]);
    const titles = async () => (await rows('select book_title from public.community_activities order by book_title')).map(r => r.book_title);
    await actor(A); assert.deepEqual(await titles(), ['Pública', 'Seguidores']);
    await actor(C); assert.deepEqual(await titles(), [], 'não seguidor não vê nada de perfil para seguidores');
    await actor(null, 'anon'); assert.deepEqual(await titles(), []);
    await actor(B); assert.deepEqual(await titles(), ['Privada', 'Pública', 'Seguidores']);

    // 6. Bloqueio corta a relação nos dois sentidos e esconde os perfis; desbloquear não refaz o seguir.
    await actor(B); await rpc('community_block', A);
    assert.deepEqual((await rpc('community_list_blocked')).map(r => r.username), ['alice']);
    assert.deepEqual(await visible(), ['bob'], 'quem bloqueou também deixa de ver o bloqueado');
    await actor(A); assert.deepEqual(await visible(), ['alice']);
    assert.deepEqual(await rpc('community_find_reader', 'bob'), []);
    await assert.rejects(() => rpc('community_follow', B), /community:target/, 'mesma resposta de perfil inexistente');
    assert.deepEqual(await titles(), []);
    await actor(B); await rpc('community_unblock', A); await actor(A);
    assert.equal((await rpc('community_find_reader', 'bob'))[0].relation, 'none');

    // 7. Remover seguidor, deixar de seguir e mudanças de privacidade.
    await actor(A); await rpc('community_remove_follower', C); assert.deepEqual(await rpc('community_list_follows', 'followers'), []);
    await actor(C); assert.equal((await rpc('community_follow', B))[0].community_follow, 'pending');
    await actor(B); await db.exec("update public.community_profiles set privacy='PUBLIC'");
    assert.deepEqual((await rpc('community_list_follows', 'followers')).map(r => r.username), ['carol'], 'virar público aceita os pedidos pendentes');
    await actor(C); await rpc('community_unfollow', B); assert.deepEqual(await rpc('community_list_follows', 'following'), []);
    assert.equal((await rpc('community_follow', B))[0].community_follow, 'accepted'); assert.equal((await rpc('community_follow', A))[0].community_follow, 'accepted');
    await actor(B); await db.exec('delete from public.community_profiles'); // retirar da rede
    await actor(C); assert.deepEqual((await rpc('community_list_follows', 'following')).map(r => r.username), ['alice'], 'perfil retirado perde os seguidores');
    await assert.rejects(() => rpc('community_follow', B), /community:target/);

    // 8. Denúncia: só criação, um registro por motivo, limites.
    await rpc('community_report', A, 'spam', '  propaganda  '); await rpc('community_report', A, 'spam', 'de novo');
    await assert.rejects(() => rpc('community_report', A, 'feio', ''), /community:report/);
    await assert.rejects(() => rpc('community_report', C, 'spam', ''), /community:target/);
    await assert.rejects(() => rpc('community_report', A, 'other', 'x'.repeat(1001)), /community:report/);
    await admin(); assert.deepEqual(await rows('select reason, details from public.community_reports'), [{ reason: 'spam', details: 'de novo' }]);
    await db.query('delete from public.community_reports where reporter_id=$1', [C]);
    for (let i = 0; i < 20; i++) await db.query("insert into auth.users(id, raw_user_meta_data) values($1,$2)", [`00000000-0000-4000-8000-0000000001${String(i).padStart(2, '0')}`, JSON.stringify({ username: 'alvo' + i })]);
    await actor(C);
    for (let i = 0; i < 20; i++) await rpc('community_report', `00000000-0000-4000-8000-0000000001${String(i).padStart(2, '0')}`, 'spam', '');
    await assert.rejects(() => rpc('community_report', A, 'other', ''), /community:limit/, '20 denúncias por dia');

    // 9. Conta: trocar o @usuario reflete no perfil; conta desativada sai da rede e não age mais.
    await actor(A); await db.exec("update public.profiles set username='alicia'"); assert.deepEqual(await visible(), ['alicia']);
    await admin(); await db.query("update public.profiles set account_status='disabled' where id=$1", [A]);
    assert.equal((await rows('select count(*)::int as n from public.community_profiles'))[0].n, 0);
    assert.equal((await rows('select count(*)::int as n from public.community_follows where following_id=$1', [A]))[0].n, 0);
    await actor(A); await assert.rejects(() => rpc('community_search_readers', 'bo'), /community:account/);
    await actor(D); await assert.rejects(() => rpc('community_follow', B), /community:account/, 'conta sem @usuario não entra no grafo');
    console.log('PASS community social schema (PGlite local): identidade da conta, FOLLOWERS só para aceitos, pedidos, busca só de públicos, bloqueio nos dois sentidos, atividades por privacidade, denúncias sem leitura, limites, conta desativada. Não aplicado no Supabase.');
  } finally { await db.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
