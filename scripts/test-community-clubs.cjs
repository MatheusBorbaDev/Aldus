// Community Etapa 3 no app: domínio de clubes/fóruns, gateway com cliente simulado e as telas (Clubes, Clube, Fóruns, Tópico)
// com gateway falso. Regras do servidor (marcos, bloqueio, limites) ficam em test-community-clubs-schema.cjs. Sem rede.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const React = require('../.expo/auth-test-tools/node_modules/react');
const { act, create } = require('../.expo/auth-test-tools/node_modules/react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const A = '00000000-0000-4000-8000-00000000000a', B = '00000000-0000-4000-8000-00000000000b';
const CLUB = '10000000-0000-4000-8000-000000000001', THREAD = '20000000-0000-4000-8000-000000000001', POST = '30000000-0000-4000-8000-000000000001', COMMENT = '40000000-0000-4000-8000-000000000001';
const iso = '2026-11-16T10:00:00+00:00';
const domainLoad = require('./community-test-loader.cjs')();
const clubs = domainLoad('src/community/domain/clubs');
const { SupabaseCommunityGateway } = domainLoad('src/community/data/SupabaseCommunityGateway');
const name = (id, username, display = null) => ({ user_id: id, username, display_name: display });
const detailRow = (extra = {}) => ({ club: { id: CLUB, name: 'Clube de teste', description: 'Leitura combinada', book_title: 'Livro de teste', milestones: ['Parte 1', 'Parte 2', 'Parte 3'], owner_id: A, invite_code: 'ABCDE12345', ...extra.club },
  me: { role: 'owner', reached_milestone: 1, ...extra.me }, members: extra.members ?? [{ ...name(A, 'alice', 'Alice'), role: 'owner', reached_milestone: 1 }, { ...name(B, 'bob'), role: 'member', reached_milestone: 2 }] });

(async () => {
  // 1. Domínio.
  const detail = clubs.parseClubDetail(detailRow());
  assert.deepEqual(detail.club.milestones, ['Parte 1', 'Parte 2', 'Parte 3']); assert.equal(detail.members[1].displayName, null);
  assert.throws(() => clubs.parseClubDetail(detailRow({ club: { invite_code: null } })), e => e.kind === 'contract', 'dono sem código é contrato quebrado');
  assert.equal(clubs.parseClubDetail(detailRow({ club: { invite_code: null }, me: { role: 'member' } })).club.inviteCode, null);
  for (const bad of [detailRow({ club: { milestones: ['só um'] } }), detailRow({ me: { reached_milestone: 9 } }), detailRow({ club: { invite_code: 'curto' } }), { club: null }])
    assert.throws(() => clubs.parseClubDetail(bad), e => e.kind === 'contract');
  assert.deepEqual(clubs.parseMilestoneLines(' Parte 1 \n\n Parte 2\r\n'), ['Parte 1', 'Parte 2']);
  assert.throws(() => clubs.parseMilestoneLines('só uma'), e => e.kind === 'text');
  assert.throws(() => clubs.parseMilestoneLines(Array.from({ length: 13 }, (_, i) => `M${i}`).join('\n')), e => e.kind === 'text');
  assert.equal(clubs.normalizeInviteCode(' abcde-12345 '), 'ABCDE12345');
  assert.equal(clubs.publicLabel({ username: 'bob', displayName: null }), '@bob'); assert.equal(clubs.publicLabel({ username: 'alice', displayName: 'Alice' }), 'Alice · @alice');
  const comment = (id, milestone) => clubs.parseClubComment({ id, milestone, body: 'texto', created_at: iso, author: name(B, 'bob'), mine: false });
  assert.deepEqual(clubs.commentsByMilestone([comment(COMMENT, 2), comment('40000000-0000-4000-8000-000000000002', 1)], ['P1', 'P2', 'P3']).map(g => [g.milestone, g.label, g.comments.length]), [[1, 'P1', 1], [2, 'P2', 1]]);
  assert.match(clubs.CLUB_DRM_NOTICE, /própria cópia.*DRM/);

  // 2. Gateway: nomes de RPC, parâmetros, erros novos, sessão da conta.
  const calls = []; let next = { data: null, error: null }; let session = { user: { id: A } };
  const client = { auth: { getSession: async () => ({ data: { session }, error: null }) }, rpc: (fn, params) => { calls.push([fn, params]); return Promise.resolve(next); }, from: () => { throw new Error('sem tabela direta'); } };
  const gateway = new SupabaseCommunityGateway(client, A);
  next = { data: [{ club_id: CLUB, invite_code: 'ABCDE12345' }], error: null };
  assert.deepEqual(await gateway.createClub('Clube', '', 'Livro', ['P1', 'P2']), { clubId: CLUB, inviteCode: 'ABCDE12345' });
  assert.deepEqual(calls.at(-1), ['community_create_club', { p_name: 'Clube', p_description: '', p_book_title: 'Livro', p_milestones: ['P1', 'P2'] }]);
  next = { data: CLUB, error: null }; assert.equal(await gateway.joinClub('abcde 12345'), CLUB); assert.deepEqual(calls.at(-1), ['community_join_club', { p_invite_code: 'ABCDE12345' }]);
  const before = calls.length; await assert.rejects(gateway.joinClub('curto'), e => e.kind === 'target'); assert.equal(calls.length, before, 'código inválido nem chega ao servidor');
  next = { data: detailRow(), error: null }; assert.equal((await gateway.clubDetail(CLUB)).club.name, 'Clube de teste');
  next = { data: detailRow({ club: { id: '10000000-0000-4000-8000-000000000009' } }), error: null }; await assert.rejects(gateway.clubDetail(CLUB), e => e.kind === 'contract', 'servidor devolveu outro clube');
  await assert.rejects(gateway.clubDetail('nao-e-uuid'), e => e.kind === 'target');
  await assert.rejects(gateway.addClubComment(CLUB, 1, '   '), e => e.kind === 'text');
  next = { data: null, error: null }; await gateway.reportContent('post', POST, 'spam', '  algo  ');
  assert.deepEqual(calls.at(-1), ['community_report_content', { p_kind: 'post', p_id: POST, p_reason: 'spam', p_details: 'algo' }]);
  await assert.rejects(gateway.reportContent('livro', POST, 'spam', ''), e => e.kind === 'report');
  for (const [message, kind] of [['community:milestone', 'milestone'], ['community:text', 'text'], ['community:owner', 'owner'], ['community:report', 'report'], ['community:limit', 'limit']]) {
    next = { data: null, error: { code: 'P0001', message } }; await assert.rejects(gateway.setClubMilestone(CLUB, 1), e => e.kind === kind, message);
  }
  next = { data: { code: 'PGRST202' }, error: { code: 'PGRST202', message: 'Could not find the function public.community_list_threads in the schema cache' } };
  await assert.rejects(gateway.listThreads(''), e => e.kind === 'unavailable', 'servidor sem a migration');
  session = { user: { id: B } }; const guarded = calls.length; await assert.rejects(gateway.listMyClubs(), e => e.kind === 'session'); assert.equal(calls.length, guarded);

  // 3. Telas com gateway falso.
  const navigations = []; let params = { id: CLUB }; const shares = [];
  const palette = { background: '#f5f5f3', surface: '#fff', surfaceSecondary: '#f0f1f0', text: '#171a1d', secondaryText: '#5f6a70', border: '#d9ded9', accent: '#d97757', input: '#f8f9f8' };
  const fake = () => {
    const state = { log: [], clubs: [], detail: clubs.parseClubDetail(detailRow()), comments: [comment(COMMENT, 1)], threads: [], thread: null };
    return { state, gateway: {
      listMyClubs: async () => state.clubs,
      joinClub: async code => { state.log.push(['join', code]); return CLUB; },
      createClub: async (n, d, b, m) => { state.log.push(['create', n, b, m]); return { clubId: CLUB, inviteCode: 'ABCDE12345' }; },
      clubDetail: async () => state.detail, listClubComments: async () => state.comments,
      setClubMilestone: async (id, n) => { state.log.push(['milestone', n]); state.detail = { ...state.detail, me: { ...state.detail.me, reachedMilestone: n } }; },
      addClubComment: async (id, m, body) => { state.log.push(['comment', m, body]); return COMMENT; },
      removeClubComment: async id => { state.log.push(['remove-comment', id]); state.comments = []; },
      removeClubMember: async (id, user) => { state.log.push(['remove-member', user]); },
      regenerateInvite: async () => { state.log.push(['regenerate']); return 'ZZZZZ99999'; },
      deleteClub: async () => { state.log.push(['delete']); }, leaveClub: async () => { state.log.push(['leave']); },
      reportContent: async (kind, id, reason, details) => { state.log.push(['report', kind, id, reason, details]); },
      listThreads: async query => { state.log.push(['list-threads', query]); return state.threads; },
      createThread: async (t, b, s) => { state.log.push(['thread', t, b, s]); return THREAD; },
      threadDetail: async () => state.thread, addPost: async (id, body, s) => { state.log.push(['post', body, s]); return POST; },
      removeThread: async () => { state.log.push(['remove-thread']); }, removePost: async id => { state.log.push(['remove-post', id]); },
    } };
  };
  let net = fake();
  const context = { loading: false, error: null, refresh: async () => {}, service: {}, get social() { return net.gateway; }, view: {} };
  const load = require('./community-test-loader.cjs')({
    react: React, 'react/jsx-runtime': require('../.expo/auth-test-tools/node_modules/react/jsx-runtime'),
    'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView', Image: 'Image', TextInput: 'TextInput', Switch: 'Switch', ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: x => x }, Share: { share: async value => { shares.push(value); } } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 28, bottom: 24 }) },
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    'expo-router': { router: { push: p => navigations.push(p), replace: p => navigations.push(p), back: () => navigations.push('back'), canGoBack: () => true }, useLocalSearchParams: () => params },
    '@/src/presentation/contexts/AppThemeContext': { useAppTheme: () => ({ palette }) },
    './CommunityProvider': { useCommunity: () => context, useCommunityFocus: () => {} },
  });
  let renderer;
  const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  const render = async Component => { if (renderer) await act(async () => renderer.unmount()); await act(async () => { renderer = create(React.createElement(Component)); }); await flush(); };
  const text = () => renderer.root.findAllByType('Text').map(n => [n.props.children].flat().join('')).join('\n');
  const button = label => renderer.root.findAllByType('Pressable').find(n => n.props.accessibilityLabel === label);
  const press = async label => { const b = button(label); assert(b, `Botão ${label}\n${text()}`); await act(async () => b.props.onPress()); await flush(); };
  const type = async (label, value) => { const input = renderer.root.findAllByType('TextInput').find(n => n.props.accessibilityLabel === label); assert(input, label); await act(async () => input.props.onChangeText(value)); };
  const { CommunityClubsScreen } = load('src/community/presentation/CommunityClubsScreen');
  const { CommunityClubScreen } = load('src/community/presentation/CommunityClubScreen');
  const { CommunityForumsScreen } = load('src/community/presentation/CommunityForumsScreen');
  const { CommunityThreadScreen } = load('src/community/presentation/CommunityThreadScreen');

  // Clubes: vazio, entrar com código, criar com marcos.
  await render(CommunityClubsScreen);
  assert.match(text(), /ainda não participa de nenhum clube/); assert.match(text(), /própria cópia do livro/);
  assert.equal(button('Entrar no clube').props.accessibilityState.disabled, true, 'sem código completo');
  await type('Código do convite', 'abcde-12345'); await press('Entrar no clube');
  assert.deepEqual(net.state.log.at(-1), ['join', 'abcde-12345']); assert.equal(navigations.at(-1), `/community/club/${CLUB}`);
  await press('Criar um clube'); await type('Nome do clube', 'Clube novo'); await type('Livro (só o título)', 'Livro de teste'); await type('Marcos de leitura, um por linha (de 2 a 12)', 'Início\nFim');
  await press('Salvar clube'); assert.deepEqual(net.state.log.at(-1), ['create', 'Clube novo', 'Livro de teste', ['Início', 'Fim']]);
  await press('Criar um clube'); await type('Marcos de leitura, um por linha (de 2 a 12)', 'só um'); await press('Salvar clube');
  assert.match(text(), /Confira o texto/, 'marcos inválidos explicados');
  net.state.clubs = [clubs.parseClubSummary({ club_id: CLUB, name: 'Clube de teste', book_title: 'Livro de teste', role: 'owner', reached_milestone: 1, milestone_count: 3 })];
  await render(CommunityClubsScreen); assert.ok(button('Clube de teste · Livro de teste · criado por você')); assert.ok(!/\d+ membros|\d+ de \d+/.test(text()), 'sem contagens');

  // Clube (dono): marcos, comentário só até o marco, código, remover membro e excluir com confirmação, denúncia.
  await render(CommunityClubScreen);
  assert.ok(button('Você está aqui: Parte 1')); assert.match(text(), /Bob|@bob/); assert.match(text(), /Código: ABCDE12345/);
  assert.ok(button('Selecionado: comentar sobre Parte 1')); assert.ok(!button('comentar sobre Parte 2'), 'não comenta marco ainda não alcançado');
  await type('Seu comentário', 'Gostei desta parte'); await press('Publicar comentário'); assert.deepEqual(net.state.log.at(-1), ['comment', 1, 'Gostei desta parte']);
  await press('Parte 2'); assert.deepEqual(net.state.log.at(-1), ['milestone', 2]); assert.ok(button('Você está aqui: Parte 2'));
  await press('Compartilhar código'); assert.match(shares.at(-1).message, /código ABCDE12345/); assert.match(shares.at(-1).message, /própria cópia/);
  await press('Gerar novo código'); assert.deepEqual(net.state.log.at(-1), ['regenerate']);
  await press('Remover @bob do clube'); assert.notDeepEqual(net.state.log.at(-1), ['remove-member', B], 'pede confirmação'); await press('Confirmar: remover @bob'); assert.deepEqual(net.state.log.at(-1), ['remove-member', B]);
  await press('Denunciar comentário'); await press('Assédio ou ofensa'); await press('Enviar denúncia'); assert.deepEqual(net.state.log.at(-1), ['report', 'club_comment', COMMENT, 'harassment', '']);
  await press('Remover comentário'); assert.deepEqual(net.state.log.at(-1), ['remove-comment', COMMENT]);
  await press('Excluir o clube'); assert.ok(!net.state.log.some(l => l[0] === 'delete'), 'excluir pede confirmação'); await press('Confirmar: excluir o clube');
  assert.deepEqual(net.state.log.at(-1), ['delete']); assert.equal(navigations.at(-1), '/community/clubs');
  // Membro: sem código, sai com confirmação; sem marco não vê comentários.
  net = fake(); net.state.detail = clubs.parseClubDetail(detailRow({ club: { invite_code: null }, me: { role: 'member', reached_milestone: 0 } })); net.state.comments = [];
  await render(CommunityClubScreen); assert.ok(!/Código:/.test(text())); assert.match(text(), /Marque um marco para ler e escrever/);
  assert.ok(!button('Remover @bob do clube')); await press('Sair do clube'); await press('Confirmar: sair do clube'); assert.deepEqual(net.state.log.at(-1), ['leave']);

  // Fóruns: novo tópico com spoiler, busca, lista.
  net = fake(); await render(CommunityForumsScreen); assert.match(text(), /Ainda não há tópicos/);
  await press('Escrever um tópico'); await type('Título', 'Um tópico'); await type('Texto', 'Conteúdo'); await act(async () => renderer.root.findAllByType('Switch')[0].props.onValueChange(true));
  await press('Publicar tópico'); assert.deepEqual(net.state.log.at(-1), ['thread', 'Um tópico', 'Conteúdo', true]); assert.equal(navigations.at(-1), `/community/thread/${THREAD}`);
  net.state.threads = [clubs.parseThreadSummary({ id: THREAD, title: 'Um tópico', contains_spoilers: true, created_at: iso, author: name(B, 'bob'), mine: false })];
  await type('Buscar pelo título', 'tópico'); await press('Buscar'); assert.deepEqual(net.state.log.at(-1), ['list-threads', 'tópico']);
  assert.ok(button('Um tópico · contém spoiler · @bob'));

  // Tópico: spoiler escondido até pedir, resposta, remover a própria, denunciar a alheia.
  net.state.thread = clubs.parseThreadDetail({ thread: { id: THREAD, title: 'Um tópico', body: 'O segredo do fim', contains_spoilers: true, created_at: iso, author: name(B, 'bob'), mine: false },
    posts: [{ id: POST, body: 'Minha resposta', contains_spoilers: false, created_at: iso, author: name(A, 'alice'), mine: true }] });
  params = { id: THREAD }; await render(CommunityThreadScreen);
  assert.ok(!text().includes('O segredo do fim'), 'spoiler escondido'); await press('Contém spoiler · mostrar'); assert.match(text(), /O segredo do fim/);
  await press('Denunciar tópico'); assert.equal(button('Enviar denúncia').props.accessibilityState.disabled, true, 'sem motivo não envia'); await press('Spam ou propaganda'); await press('Enviar denúncia'); assert.deepEqual(net.state.log.at(-1), ['report', 'thread', THREAD, 'spam', '']);
  await press('Remover resposta'); assert.deepEqual(net.state.log.at(-1), ['remove-post', POST]);
  await type('Sua resposta', 'Nova resposta'); await press('Responder'); assert.deepEqual(net.state.log.at(-1), ['post', 'Nova resposta', false]);
  for (const b of renderer.root.findAllByType('Pressable')) assert.ok(b.props.accessibilityLabel, 'todo botão tem rótulo');
  await act(async () => renderer.unmount());

  // Rotas e início da Comunidade.
  const layout = fs.readFileSync('app/community/_layout.tsx', 'utf8');
  for (const route of ['clubs', 'club/[id]', 'forums', 'thread/[id]']) { assert.ok(layout.includes(`name="${route}"`), route); assert.ok(fs.existsSync(`app/community/${route}.tsx`), route); }
  const home = fs.readFileSync('src/community/presentation/CommunityHomeScreen.tsx', 'utf8');
  assert.match(home, /label="Abrir clubes"/); assert.match(home, /label="Abrir fóruns"/); assert.doesNotMatch(home, /Em construção/);
  console.log('PASS community clubs/forums app: contrato validado, gateway com RPCs e erros novos, sessão da conta; telas de clubes (criar, entrar, marcos, comentários até o marco, código, moderação com confirmação) e fóruns (spoiler escondido, responder, remover, denunciar). Sem rede.');
})().catch(error => { console.error(error); process.exit(1); });
