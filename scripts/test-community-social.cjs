// Community Etapa 2 no app: domínio social, gateway Supabase com cliente simulado e telas Pessoas/Leitor com gateway falso.
// Não fala com rede nem com o Supabase real; as regras do servidor são cobertas por test-community-social-schema.cjs.
const assert = require('node:assert/strict'), fs = require('node:fs');
const React = require('../.expo/auth-test-tools/node_modules/react');
const { act, create } = require('../.expo/auth-test-tools/node_modules/react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const A = '00000000-0000-4000-8000-00000000000a', B = '00000000-0000-4000-8000-00000000000b', C = '00000000-0000-4000-8000-00000000000c';
const domainLoad = require('./community-test-loader.cjs')();
const social = domainLoad('src/community/domain/social');
const { createProfile } = domainLoad('src/community/domain/profile');
const { SupabaseCommunityGateway } = domainLoad('src/community/data/SupabaseCommunityGateway');
const { emptyState } = domainLoad('src/community/data/serialization');
const iso = '2026-11-12T10:00:00+00:00';
const remoteRow = (extra = {}) => ({ user_id: A, username: 'alice', display_name: 'Alice', avatar_url: null, bio: 'Leio devagar', favorite_genres: ['Romance'], favorite_authors: [], favorite_books: [],
  goal_year: 2026, goal_books: 12, privacy: 'PUBLIC', activity_privacy: 'PRIVATE', created_at: iso, updated_at: iso, ...extra });

(async () => {
  // 1. Domínio: contrato do servidor validado; nada fora do perfil literário sai do aparelho.
  const local = { ...createProfile({ userId: A, username: 'alice', displayName: 'Alice', avatar: null }, 1), bio: 'Leio devagar', favoriteGenres: ['Romance'], readingGoal: { year: 2026, books: 12 } };
  assert.throws(() => social.publishedProfileRow(local), e => e.kind === 'private', 'perfil privado não é publicado');
  const row = social.publishedProfileRow({ ...local, privacy: 'PUBLIC' });
  assert.deepEqual(Object.keys(row).sort(), ['activity_privacy', 'bio', 'display_name', 'favorite_authors', 'favorite_books', 'favorite_genres', 'goal_books', 'goal_year', 'privacy', 'user_id', 'username']);
  const published = social.parsePublishedProfile(remoteRow());
  assert.equal(published.readingGoal.books, 12); assert.equal(social.publicationOutdated({ ...local, privacy: 'PUBLIC' }, published), false);
  assert.equal(social.publicationOutdated({ ...local, privacy: 'PUBLIC', bio: 'Outra' }, published), true);
  for (const bad of [null, [], remoteRow({ user_id: 'x' }), remoteRow({ username: 'A' }), remoteRow({ privacy: 'OPEN' }), remoteRow({ goal_books: null }), remoteRow({ favorite_genres: 'x' }), remoteRow({ updated_at: 'ontem' })])
    assert.throws(() => social.parsePublishedProfile(bad), e => e.kind === 'contract');
  assert.equal(social.parseReaderCard({ user_id: B, username: 'bob', display_name: null, avatar_url: 'http://inseguro/x.png', privacy: 'FOLLOWERS' }).avatar, null, 'avatar sem https é descartado');
  assert.throws(() => social.parseReaderLookup({ user_id: B, username: 'bob', display_name: 'Bob', avatar_url: null, privacy: 'PUBLIC', relation: 'friend', follows_me: false }), e => e.kind === 'contract');
  assert.equal(social.normalizeUsernameQuery('  @Bob '), 'bob');
  assert.deepEqual(social.relationAction({ relation: 'none', privacy: 'FOLLOWERS' }), { label: 'Pedir para seguir', action: 'follow' });
  assert.deepEqual(social.relationAction({ relation: 'none', privacy: 'PUBLIC' }), { label: 'Seguir', action: 'follow' });
  assert.equal(social.relationAction({ relation: 'pending', privacy: 'FOLLOWERS' }).action, 'unfollow');
  assert.equal(social.relationAction({ relation: 'self', privacy: 'PUBLIC' }).action, null);
  assert.doesNotMatch(fs.readFileSync('src/community/domain/social.ts', 'utf8') + fs.readFileSync('src/community/presentation/CommunityPeopleScreen.tsx', 'utf8') + fs.readFileSync('src/community/presentation/CommunityReaderScreen.tsx', 'utf8'),
    /followerCount|followers_count|\.length\} seguidores|ranking de|top leitores/i, 'sem contagem pública nem ranking');

  // 2. Gateway: sessão da conta certa, mapeamento de erros, chamadas só por RPC para o grafo.
  const calls = []; let session = { user: { id: A } }, next = { data: null, error: null };
  const answer = () => Promise.resolve(next);
  const client = {
    auth: { getSession: async () => ({ data: { session }, error: null }) },
    rpc: (name, params) => { calls.push(['rpc', name, params]); return answer(); },
    from: table => ({
      select: () => ({ eq: (column, value) => ({ maybeSingle: () => { calls.push(['select', table, column, value]); return answer(); } }) }),
      upsert: (value, options) => ({ select: () => ({ single: () => { calls.push(['upsert', table, value, options]); return answer(); } }) }),
      delete: () => ({ eq: (column, value) => { calls.push(['delete', table, column, value]); return answer(); } }),
    }),
  };
  const gateway = new SupabaseCommunityGateway(client, A);
  next = { data: null, error: null }; assert.equal(await gateway.ownPublication(), null);
  next = { data: remoteRow(), error: null }; assert.equal((await gateway.publish({ ...local, privacy: 'PUBLIC' })).username, 'alice');
  assert.deepEqual(calls.at(-1).slice(0, 2), ['upsert', 'community_profiles']); assert.deepEqual(calls.at(-1)[3], { onConflict: 'user_id' });
  const before = calls.length; await assert.rejects(gateway.publish(local), e => e.kind === 'private'); assert.equal(calls.length, before, 'perfil privado nem chega ao servidor');
  await assert.rejects(gateway.publish({ ...local, userId: B, privacy: 'PUBLIC' }), e => e.kind === 'session');
  next = { data: remoteRow({ user_id: B, username: 'bob' }), error: null }; await assert.rejects(gateway.publish({ ...local, privacy: 'PUBLIC' }), e => e.kind === 'contract', 'servidor devolveu outra conta');
  next = { data: 'pending', error: null }; assert.equal(await gateway.follow(B), 'pending'); assert.deepEqual(calls.at(-1), ['rpc', 'community_follow', { p_target: B }]);
  await assert.rejects(gateway.follow(A), e => e.kind === 'target', 'não segue a si mesmo');
  next = { data: [], error: null }; assert.equal(await gateway.findReader('@Bob'), null); assert.deepEqual(calls.at(-1), ['rpc', 'community_find_reader', { p_username: 'bob' }]);
  await assert.rejects(gateway.findReader('b'), e => e.kind === 'query'); await assert.rejects(gateway.searchReaders('a'), e => e.kind === 'query');
  next = { data: [{ user_id: A, username: 'alice', display_name: 'Alice', avatar_url: null, privacy: 'PUBLIC' }, { user_id: B, username: 'bob', display_name: 'Bob', avatar_url: null, privacy: 'PUBLIC' }], error: null };
  assert.deepEqual((await gateway.searchReaders('  AL ')).map(c => c.username), ['bob'], 'a própria conta nunca aparece no resultado');
  next = { data: null, error: null }; await gateway.report(B, 'spam', '  texto  '); assert.deepEqual(calls.at(-1), ['rpc', 'community_report', { p_target: B, p_reason: 'spam', p_details: 'texto' }]);
  await assert.rejects(gateway.report(B, 'feio', ''), e => e.kind === 'contract');
  for (const [error, kind] of [[{ code: 'PGRST202', message: 'Could not find the function public.community_follow in the schema cache' }, 'unavailable'], [{ code: 'PGRST205', message: 'table not found' }, 'unavailable'],
    [{ code: '42P01', message: 'relation "community_profiles" does not exist' }, 'unavailable'], [{ code: 'P0001', message: 'community:target' }, 'target'], [{ code: 'P0001', message: 'community:limit' }, 'limit'],
    [{ code: 'P0001', message: 'community:account' }, 'account'], [{ code: 'P0001', message: 'community:kind' }, 'contract'], [{ code: 'PGRST301', message: 'JWT expired' }, 'session'],
    [{ code: '', message: 'TypeError: Failed to fetch' }, 'network'], [{ code: '23505', message: 'duplicate' }, 'contract']]) {
    next = { data: null, error }; await assert.rejects(gateway.follow(B), e => e.kind === kind, JSON.stringify(error));
  }
  session = { user: { id: B } }; next = { data: null, error: null };
  const guarded = calls.length; await assert.rejects(gateway.ownPublication(), e => e.kind === 'session'); assert.equal(calls.length, guarded, 'sessão de outra conta: nenhuma chamada');
  session = null; await assert.rejects(gateway.listBlocked(), e => e.kind === 'session');
  await assert.rejects(new SupabaseCommunityGateway(null, A).ownPublication(), e => e.kind === 'unavailable', 'sem Supabase configurado');

  // 3. Telas com gateway falso.
  const navigations = []; let params = { username: 'bob' };
  const palette = { background: '#f5f5f3', surface: '#fff', surfaceSecondary: '#f0f1f0', text: '#171a1d', secondaryText: '#5f6a70', border: '#d9ded9', accent: '#d97757', input: '#f8f9f8' };
  const entry = (id, username, displayName, status) => ({ userId: id, username, displayName, avatar: null, privacy: null, status, createdAt: 1 });
  const fake = () => {
    const state = { publication: null, requests: [entry(C, 'carol', null, 'pending')], followers: [], following: [], sent: [], blocked: [], log: [], unavailable: false,
      readers: { bob: { userId: B, username: 'bob', displayName: 'Bob', avatar: null, privacy: 'FOLLOWERS', relation: 'none', followsMe: false } }, profiles: {} };
    // As telas usam a classe de erro do próprio carregador delas.
    const guard = () => { if (state.unavailable) throw new (load('src/community/domain/social').SocialError)('unavailable'); };
    return { state, gateway: {
      ownPublication: async () => { guard(); return state.publication; },
      publish: async profile => { state.log.push(['publish', profile.privacy]); state.publication = social.parsePublishedProfile(remoteRow({ privacy: profile.privacy, bio: profile.bio })); return state.publication; },
      unpublish: async () => { state.log.push(['unpublish']); state.publication = null; state.followers = []; },
      findReader: async username => state.readers[username] ?? null,
      searchReaders: async query => { state.log.push(['search', query]); return []; },
      readProfile: async id => state.profiles[id] ?? null,
      follow: async id => { state.log.push(['follow', id]); state.readers.bob.relation = 'pending'; return 'pending'; },
      unfollow: async id => { state.log.push(['unfollow', id]); state.readers.bob.relation = 'none'; },
      respondFollow: async (id, accept) => { state.log.push(['respond', id, accept]); state.requests = []; if (accept) state.followers = [entry(C, 'carol', null, 'accepted')]; },
      removeFollower: async id => { state.log.push(['remove', id]); state.followers = []; },
      listFollows: async kind => state[kind],
      block: async id => { state.log.push(['block', id]); }, unblock: async id => { state.log.push(['unblock', id]); state.blocked = []; },
      listBlocked: async () => state.blocked, report: async (id, reason, details) => { state.log.push(['report', id, reason, details]); },
    } };
  };
  let net = fake();
  const profile = { ...local, privacy: 'PRIVATE' };
  let context = { loading: false, error: null, refresh: async () => {}, service: {}, social: net.gateway, view: { state: { ...emptyState(A), profile } } };
  const load = require('./community-test-loader.cjs')({
    react: React, 'react/jsx-runtime': require('../.expo/auth-test-tools/node_modules/react/jsx-runtime'),
    'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView', Image: 'Image', TextInput: 'TextInput', ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: x => x } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 28, bottom: 24 }) },
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    'expo-router': { router: { push: p => navigations.push(p), replace: p => navigations.push(p), back: () => navigations.push('back'), canGoBack: () => true }, useLocalSearchParams: () => params },
    '@/src/presentation/contexts/AppThemeContext': { useAppTheme: () => ({ palette }) },
    './CommunityProvider': { useCommunity: () => context, useCommunityFocus: () => {} },
  });
  let renderer;
  const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  const render = async Component => { if (renderer) await act(async () => renderer.unmount()); await act(async () => { renderer = create(React.createElement(Component)); }); await flush(); return renderer.root; };
  const text = () => renderer.root.findAllByType('Text').map(n => n.children.filter(v => typeof v === 'string').join('')).join('\n');
  const button = label => renderer.root.findAllByType('Pressable').find(n => n.props.accessibilityLabel === label);
  const press = async label => { const b = button(label); assert(b, `Botão ${label}\n${text()}`); await act(async () => b.props.onPress()); await flush(); };
  const { CommunityPeopleScreen: People, PUBLISH_DISCLOSURE } = load('src/community/presentation/CommunityPeopleScreen');
  const { CommunityReaderScreen: Reader } = load('src/community/presentation/CommunityReaderScreen');

  // Pessoas: perfil privado não publica; o aviso diz o que sai do aparelho; publicar é ato explícito.
  await render(People);
  assert.match(text(), /só neste aparelho/); assert.ok(text().includes(PUBLISH_DISCLOSURE)); assert.match(PUBLISH_DISCLOSURE, /biblioteca, progresso, tempo de leitura, grifos e notas não são enviados/);
  assert.equal(button('Publicar perfil como Público'), undefined); await press('Editar perfil e privacidade'); assert.equal(navigations.at(-1), '/community/edit-profile');
  assert.deepEqual(net.state.log, [], 'abrir a tela não publica nada');
  context = { ...context, view: { state: { ...emptyState(A), profile: { ...profile, privacy: 'FOLLOWERS' } } } }; await render(People);
  await press('Publicar perfil como Seguidores'); assert.deepEqual(net.state.log, [['publish', 'FOLLOWERS']]);
  assert.match(text(), /Publicado como Seguidores/); assert.match(text(), /Perfil publicado\./);
  // Pedidos e seguidores.
  assert.match(text(), /Pedidos para seguir você/); await press('Aceitar @carol'); assert.deepEqual(net.state.log.at(-1), ['respond', C, true]);
  assert.ok(!text().includes('Pedidos para seguir você')); await press('Remover @carol dos seguidores'); assert.deepEqual(net.state.log.at(-1), ['remove', C]);
  assert.match(text(), /Ninguém segue você ainda/); assert.match(text(), /Você ainda não segue ninguém/);
  // Publicação desatualizada e retirada com confirmação.
  context = { ...context, view: { state: { ...emptyState(A), profile: { ...profile, privacy: 'FOLLOWERS', bio: 'Bio nova' } } } }; await render(People);
  await press('Atualizar publicação com o perfil deste aparelho'); assert.equal(net.state.publication.bio, 'Bio nova');
  await press('Retirar meu perfil da rede'); assert.equal(net.state.log.filter(l => l[0] === 'unpublish').length, 0, 'retirar pede confirmação');
  await press('Confirmar: retirar meu perfil da rede'); assert.equal(net.state.publication, null); assert.match(text(), /Perfil retirado da rede/);
  // Busca.
  const input = renderer.root.findAllByType('TextInput').find(n => n.props.accessibilityLabel === 'Buscar leitor por @usuário ou nome');
  await act(async () => input.props.onChangeText('@Bob')); await press('Buscar');
  assert.deepEqual(net.state.log.at(-1), ['search', 'bob']); assert.match(text(), /Bob · @bob/); assert.match(text(), /Perfil para seguidores/);
  await press('Ver perfil de @bob'); assert.equal(navigations.at(-1), '/community/reader/bob');
  // Servidor sem a rede: aviso claro, nenhuma lista inventada.
  net.state.unavailable = true; await render(People);
  assert.match(text(), /ainda não está disponível no servidor/); assert.equal(button('Buscar'), undefined); assert.ok(!/Você segue|Seguem você/.test(text()));
  // Troca de conta: nada da conta anterior aparece.
  net.state.unavailable = false; net.state.following = [entry(B, 'bob', 'Bob', 'accepted')]; await render(People); assert.match(text(), /Bob · @bob/);
  const other = fake(); other.state.requests = [];
  context = { ...context, social: other.gateway }; await act(async () => renderer.update(React.createElement(People))); await flush();
  assert.ok(!text().includes('@bob'), 'A→B: listas de A somem'); assert.ok(!text().includes('carol'));

  // Leitor: perfil para seguidores fechado até aceitar; pedir, cancelar, bloquear com confirmação e denunciar.
  net = fake(); context = { ...context, social: net.gateway }; await render(Reader);
  assert.match(text(), /só para seguidores/); assert.ok(!text().includes('Gêneros favoritos'));
  await press('Pedir para seguir'); assert.deepEqual(net.state.log.at(-1), ['follow', B]); assert.match(text(), /Pedido enviado\./);
  await press('Cancelar pedido para seguir'); assert.deepEqual(net.state.log.at(-1), ['unfollow', B]);
  net.state.readers.bob = { ...net.state.readers.bob, relation: 'following', followsMe: true };
  net.state.profiles[B] = social.parsePublishedProfile(remoteRow({ user_id: B, username: 'bob', display_name: 'Bob', bio: 'Bio do Bob', privacy: 'FOLLOWERS' }));
  await render(Reader); assert.match(text(), /Bio do Bob/); assert.match(text(), /Segue você/); assert.match(text(), /Meta: 12 livros em 2026/); assert.ok(button('Deixar de seguir'));
  await press('Bloquear @bob'); assert.equal(net.state.log.filter(l => l[0] === 'block').length, 0); await press('Confirmar: bloquear @bob');
  assert.deepEqual(net.state.log.at(-1), ['block', B]); assert.equal(navigations.at(-1), '/community/people');
  await render(Reader); await press('Denunciar @bob'); await press('Assédio ou ofensa');
  const details = renderer.root.findAllByType('TextInput').find(n => n.props.accessibilityLabel === 'Detalhes da denúncia (opcional)');
  await act(async () => details.props.onChangeText('mensagens ofensivas')); await press('Enviar denúncia');
  assert.deepEqual(net.state.log.at(-1), ['report', B, 'harassment', 'mensagens ofensivas']); assert.match(text(), /Denúncia enviada/);
  params = { username: 'ninguem' }; await render(Reader); assert.match(text(), /Leitor não encontrado/); assert.equal(button('Seguir'), undefined);
  net.state.readers.alice = { userId: A, username: 'alice', displayName: 'Alice', avatar: null, privacy: 'PUBLIC', relation: 'self', followsMe: false };
  params = { username: 'alice' }; await render(Reader); assert.match(text(), /Este é o seu perfil/); assert.equal(button('Bloquear @alice'), undefined);
  for (const b of renderer.root.findAllByType('Pressable')) assert.ok(b.props.accessibilityLabel, 'todo botão tem rótulo');
  await act(async () => renderer.unmount());
  console.log('PASS community social app: contrato validado, só perfil literário publicado e por ato explícito, gateway com sessão da conta e erros mapeados, Pessoas/Leitor (publicar, pedidos, busca, retirar, bloquear, denunciar), servidor indisponível e troca de conta. Sem rede.');
})().catch(error => { console.error(error); process.exit(1); });
