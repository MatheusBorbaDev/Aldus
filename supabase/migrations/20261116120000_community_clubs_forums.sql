-- Community Etapa 3: clubes de leitura por convite (comentários presos a marcos, sem spoiler) e fóruns, com moderação.
-- CRIADA E TESTADA SÓ LOCALMENTE (PGlite, scripts/test-community-clubs-schema.cjs). NÃO APLICAR sem autorização do dono.
-- Depende de 202610060001_profiles_and_features, 202610130001_community_foundation e 20261112120000_community_social_graph.
-- Regras (docs/context/community-estudo.md §13.1): cada pessoa lê a própria cópia (o servidor nunca guarda arquivo de livro);
-- clubes só por convite; um comentário de clube só aparece para quem já chegou ao marco dele; bloqueio esconde os dois lados;
-- denúncias só de escrita; sem contagens de membros, respostas ou curtidas, sem ranking. Escrita só por RPC.
begin;

create table public.community_clubs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  description text not null default '' check (char_length(description) <= 600),
  book_title text not null check (char_length(btrim(book_title)) between 1 and 200),
  milestones text[] not null check (cardinality(milestones) between 2 and 12),
  invite_code text not null unique check (invite_code ~ '^[A-Z0-9]{10}$'),
  created_at timestamptz not null default now()
);
create index community_clubs_owner_idx on public.community_clubs (owner_id);

create table public.community_club_members (
  club_id uuid not null references public.community_clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','member')),
  reached_milestone integer not null default 0 check (reached_milestone >= 0),
  joined_at timestamptz not null default now(),
  primary key (club_id, user_id)
);
create index community_club_members_user_idx on public.community_club_members (user_id);

create table public.community_club_comments (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.community_clubs(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  milestone integer not null check (milestone >= 1),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by uuid references auth.users(id) on delete set null
);
create index community_club_comments_club_idx on public.community_club_comments (club_id, milestone, created_at);

create table public.community_threads (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 140),
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  contains_spoilers boolean not null default false,
  created_at timestamptz not null default now(),
  removed_at timestamptz
);
create index community_threads_recent_idx on public.community_threads (created_at desc);

create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.community_threads(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  contains_spoilers boolean not null default false,
  created_at timestamptz not null default now(),
  removed_at timestamptz
);
create index community_posts_thread_idx on public.community_posts (thread_id, created_at);

-- Denúncia de conteúdo: só escrita pelo cliente; leitura e tratamento pela administração (service role).
create table public.community_content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('club_comment','thread','post')),
  content_id uuid not null,
  reason text not null check (reason in ('spam','harassment','impersonation','illegal_content','other')),
  details text not null default '' check (char_length(details) <= 1000),
  created_at timestamptz not null default now(),
  unique (reporter_id, kind, content_id)
);

alter table public.community_clubs enable row level security;
alter table public.community_club_members enable row level security;
alter table public.community_club_comments enable row level security;
alter table public.community_threads enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_content_reports enable row level security;
revoke all on public.community_clubs, public.community_club_members, public.community_club_comments, public.community_threads,
  public.community_posts, public.community_content_reports from public, anon, authenticated;

-- Nome mostrado para os outros: o do perfil publicado não privado; senão só o @usuario da conta.
create function public.community_public_name(p_user uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('user_id', a.id, 'username', a.username,
    'display_name', (select p.display_name from public.community_profiles p where p.user_id = a.id and p.privacy <> 'PRIVATE'))
  from public.profiles a where a.id = p_user;
$$;
revoke all on function public.community_public_name(uuid) from public, anon, authenticated;

create function public.community_rate(p_count bigint, p_limit integer) returns void
language plpgsql immutable set search_path = '' as $$
begin
  if p_count >= p_limit then raise exception 'community:limit' using errcode = 'P0001'; end if;
end; $$;
revoke all on function public.community_rate(bigint, integer) from public, anon, authenticated;

create function public.community_clean_text(p_value text, p_min integer, p_max integer) returns text
language plpgsql immutable set search_path = '' as $$
declare value text := pg_catalog.btrim(coalesce(p_value, ''));
begin
  if pg_catalog.char_length(value) < p_min or pg_catalog.char_length(value) > p_max then
    raise exception 'community:text' using errcode = 'P0001';
  end if;
  return value;
end; $$;
revoke all on function public.community_clean_text(text, integer, integer) from public, anon, authenticated;

-- ===== Clubes =====
create function public.community_create_club(p_name text, p_description text, p_book_title text, p_milestones text[])
returns table (club_id uuid, invite_code text)
language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.community_actor();
  marks text[] := '{}'; mark text; code text; created uuid;
begin
  perform public.community_rate((select pg_catalog.count(*) from public.community_clubs c where c.owner_id = actor), 20);
  if p_milestones is null or pg_catalog.cardinality(p_milestones) not between 2 and 12 then raise exception 'community:text' using errcode = 'P0001'; end if;
  foreach mark in array p_milestones loop marks := marks || public.community_clean_text(mark, 1, 120); end loop;
  code := pg_catalog.upper(pg_catalog.substr(pg_catalog.replace(gen_random_uuid()::text, '-', ''), 1, 10));
  insert into public.community_clubs (owner_id, name, description, book_title, milestones, invite_code)
  values (actor, public.community_clean_text(p_name, 2, 80), public.community_clean_text(coalesce(p_description, ''), 0, 600),
    public.community_clean_text(p_book_title, 1, 200), marks, code)
  returning id into created;
  insert into public.community_club_members (club_id, user_id, role) values (created, actor, 'owner');
  return query select created, code;
end; $$;

create function public.community_join_club(p_invite_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.community_actor(); club public.community_clubs%rowtype;
begin
  select * into club from public.community_clubs c where c.invite_code = pg_catalog.upper(pg_catalog.btrim(coalesce(p_invite_code, '')));
  if not found or public.community_blocked_between(actor, club.owner_id) then raise exception 'community:target' using errcode = 'P0001'; end if;
  if exists (select 1 from public.community_club_members m where m.club_id = club.id and m.user_id = actor) then return club.id; end if;
  perform public.community_rate((select pg_catalog.count(*) from public.community_club_members m where m.club_id = club.id), 50);
  perform public.community_rate((select pg_catalog.count(*) from public.community_club_members m where m.user_id = actor), 50);
  insert into public.community_club_members (club_id, user_id, role) values (club.id, actor, 'member');
  return club.id;
end; $$;

create function public.community_club_role(p_club uuid, p_user uuid) returns text
language sql stable security definer set search_path = '' as $$
  select m.role from public.community_club_members m where m.club_id = p_club and m.user_id = p_user;
$$;
revoke all on function public.community_club_role(uuid, uuid) from public, anon, authenticated;

create function public.community_leave_club(p_club uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.community_actor();
begin
  if public.community_club_role(p_club, actor) = 'owner' then raise exception 'community:owner' using errcode = 'P0001'; end if;
  delete from public.community_club_members where club_id = p_club and user_id = actor;
end; $$;

create function public.community_delete_club(p_club uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.community_actor();
begin
  if coalesce(public.community_club_role(p_club, actor), '') <> 'owner' then raise exception 'community:target' using errcode = 'P0001'; end if;
  delete from public.community_clubs where id = p_club;
end; $$;

create function public.community_list_my_clubs()
returns table (club_id uuid, name text, book_title text, role text, reached_milestone integer, milestone_count integer)
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := public.community_actor();
begin
  return query select c.id, c.name, c.book_title, m.role, m.reached_milestone, pg_catalog.cardinality(c.milestones)
  from public.community_club_members m join public.community_clubs c on c.id = m.club_id
  where m.user_id = actor order by c.name limit 100;
end; $$;

create function public.community_club_detail(p_club uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := public.community_actor(); club public.community_clubs%rowtype; me public.community_club_members%rowtype;
begin
  select * into me from public.community_club_members m where m.club_id = p_club and m.user_id = actor;
  if not found then raise exception 'community:target' using errcode = 'P0001'; end if;
  select * into club from public.community_clubs c where c.id = p_club;
  return jsonb_build_object(
    'club', jsonb_build_object('id', club.id, 'name', club.name, 'description', club.description, 'book_title', club.book_title,
      'milestones', to_jsonb(club.milestones), 'owner_id', club.owner_id,
      'invite_code', case when me.role = 'owner' then club.invite_code end),
    'me', jsonb_build_object('role', me.role, 'reached_milestone', me.reached_milestone),
    'members', coalesce((select jsonb_agg(public.community_public_name(m.user_id) || jsonb_build_object('role', m.role, 'reached_milestone', m.reached_milestone) order by m.joined_at)
      from public.community_club_members m where m.club_id = p_club and not public.community_blocked_between(actor, m.user_id)), '[]'::jsonb));
end; $$;

create function public.community_set_club_milestone(p_club uuid, p_milestone integer) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.community_actor(); total integer;
begin
  if public.community_club_role(p_club, actor) is null then raise exception 'community:target' using errcode = 'P0001'; end if;
  select pg_catalog.cardinality(c.milestones) into total from public.community_clubs c where c.id = p_club;
  if p_milestone is null or p_milestone < 0 or p_milestone > total then raise exception 'community:text' using errcode = 'P0001'; end if;
  update public.community_club_members set reached_milestone = p_milestone where club_id = p_club and user_id = actor;
end; $$;

create function public.community_add_club_comment(p_club uuid, p_milestone integer, p_body text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.community_actor(); me public.community_club_members%rowtype; total integer; created uuid;
begin
  select * into me from public.community_club_members m where m.club_id = p_club and m.user_id = actor;
  if not found then raise exception 'community:target' using errcode = 'P0001'; end if;
  select pg_catalog.cardinality(c.milestones) into total from public.community_clubs c where c.id = p_club;
  -- Só se comenta um marco já alcançado: o comentário nunca adianta o que vem depois.
  if p_milestone is null or p_milestone < 1 or p_milestone > total or p_milestone > me.reached_milestone then
    raise exception 'community:milestone' using errcode = 'P0001';
  end if;
  perform public.community_rate((select pg_catalog.count(*) from public.community_club_comments k
    where k.author_id = actor and k.created_at > pg_catalog.now() - interval '1 hour'), 30);
  insert into public.community_club_comments (club_id, author_id, milestone, body)
  values (p_club, actor, p_milestone, public.community_clean_text(p_body, 1, 2000)) returning id into created;
  return created;
end; $$;

-- Comentários até o marco de quem consulta; removidos e de pessoas bloqueadas (nos dois sentidos) não aparecem.
create function public.community_list_club_comments(p_club uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := public.community_actor(); me public.community_club_members%rowtype;
begin
  select * into me from public.community_club_members m where m.club_id = p_club and m.user_id = actor;
  if not found then raise exception 'community:target' using errcode = 'P0001'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'milestone', k.milestone, 'body', k.body, 'created_at', k.created_at,
      'author', public.community_public_name(k.author_id), 'mine', k.author_id = actor) order by k.milestone, k.created_at)
    from (select * from public.community_club_comments k where k.club_id = p_club and k.removed_at is null and k.milestone <= me.reached_milestone
      and not public.community_blocked_between(actor, k.author_id) order by k.milestone, k.created_at limit 500) k), '[]'::jsonb);
end; $$;

create function public.community_remove_club_comment(p_comment uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.community_actor(); comment public.community_club_comments%rowtype;
begin
  select * into comment from public.community_club_comments k where k.id = p_comment and k.removed_at is null;
  if not found or (comment.author_id <> actor and coalesce(public.community_club_role(comment.club_id, actor), '') <> 'owner') then
    raise exception 'community:target' using errcode = 'P0001';
  end if;
  update public.community_club_comments set removed_at = pg_catalog.now(), removed_by = actor where id = p_comment;
end; $$;

create function public.community_remove_club_member(p_club uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.community_actor();
begin
  if coalesce(public.community_club_role(p_club, actor), '') <> 'owner' or p_user = actor then raise exception 'community:target' using errcode = 'P0001'; end if;
  delete from public.community_club_members where club_id = p_club and user_id = p_user;
end; $$;

create function public.community_regenerate_invite(p_club uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.community_actor(); code text;
begin
  if coalesce(public.community_club_role(p_club, actor), '') <> 'owner' then raise exception 'community:target' using errcode = 'P0001'; end if;
  code := pg_catalog.upper(pg_catalog.substr(pg_catalog.replace(gen_random_uuid()::text, '-', ''), 1, 10));
  update public.community_clubs set invite_code = code where id = p_club;
  return code;
end; $$;

-- ===== Fóruns =====
create function public.community_create_thread(p_title text, p_body text, p_spoilers boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.community_actor(); created uuid;
begin
  perform public.community_rate((select pg_catalog.count(*) from public.community_threads t
    where t.author_id = actor and t.created_at > pg_catalog.now() - interval '1 day'), 10);
  insert into public.community_threads (author_id, title, body, contains_spoilers)
  values (actor, public.community_clean_text(p_title, 3, 140), public.community_clean_text(p_body, 1, 4000), coalesce(p_spoilers, false))
  returning id into created;
  return created;
end; $$;

create function public.community_list_threads(p_query text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := public.community_actor(); needle text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_query, '')));
begin
  if pg_catalog.char_length(needle) > 80 then raise exception 'community:query' using errcode = 'P0001'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'contains_spoilers', t.contains_spoilers,
      'created_at', t.created_at, 'author', public.community_public_name(t.author_id), 'mine', t.author_id = actor) order by t.created_at desc)
    from (select * from public.community_threads t where t.removed_at is null and not public.community_blocked_between(actor, t.author_id)
      and (needle = '' or pg_catalog.strpos(pg_catalog.lower(t.title), needle) > 0) order by t.created_at desc limit 50) t), '[]'::jsonb);
end; $$;

create function public.community_thread_detail(p_thread uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := public.community_actor(); thread public.community_threads%rowtype;
begin
  select * into thread from public.community_threads t where t.id = p_thread and t.removed_at is null;
  if not found or public.community_blocked_between(actor, thread.author_id) then raise exception 'community:target' using errcode = 'P0001'; end if;
  return jsonb_build_object(
    'thread', jsonb_build_object('id', thread.id, 'title', thread.title, 'body', thread.body, 'contains_spoilers', thread.contains_spoilers,
      'created_at', thread.created_at, 'author', public.community_public_name(thread.author_id), 'mine', thread.author_id = actor),
    'posts', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'body', p.body, 'contains_spoilers', p.contains_spoilers, 'created_at', p.created_at,
        'author', public.community_public_name(p.author_id), 'mine', p.author_id = actor) order by p.created_at)
      from (select * from public.community_posts p where p.thread_id = p_thread and p.removed_at is null
        and not public.community_blocked_between(actor, p.author_id) order by p.created_at limit 500) p), '[]'::jsonb));
end; $$;

create function public.community_add_post(p_thread uuid, p_body text, p_spoilers boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.community_actor(); author uuid; created uuid;
begin
  select t.author_id into author from public.community_threads t where t.id = p_thread and t.removed_at is null;
  if author is null or public.community_blocked_between(actor, author) then raise exception 'community:target' using errcode = 'P0001'; end if;
  perform public.community_rate((select pg_catalog.count(*) from public.community_posts p
    where p.author_id = actor and p.created_at > pg_catalog.now() - interval '1 hour'), 60);
  insert into public.community_posts (thread_id, author_id, body, contains_spoilers)
  values (p_thread, actor, public.community_clean_text(p_body, 1, 4000), coalesce(p_spoilers, false)) returning id into created;
  return created;
end; $$;

-- Autor remove o próprio tópico; autor da resposta ou do tópico remove a resposta. Remoção esconde, não apaga (moderação).
create function public.community_remove_thread(p_thread uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.community_actor();
begin
  update public.community_threads set removed_at = pg_catalog.now() where id = p_thread and author_id = actor and removed_at is null;
  if not found then raise exception 'community:target' using errcode = 'P0001'; end if;
end; $$;

create function public.community_remove_post(p_post uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.community_actor();
begin
  update public.community_posts p set removed_at = pg_catalog.now()
  where p.id = p_post and p.removed_at is null
    and (p.author_id = actor or exists (select 1 from public.community_threads t where t.id = p.thread_id and t.author_id = actor));
  if not found then raise exception 'community:target' using errcode = 'P0001'; end if;
end; $$;

create function public.community_report_content(p_kind text, p_id uuid, p_reason text, p_details text) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.community_actor(); details text := pg_catalog.btrim(coalesce(p_details, ''));
begin
  if p_kind not in ('club_comment','thread','post') or p_reason not in ('spam','harassment','impersonation','illegal_content','other')
    or pg_catalog.char_length(details) > 1000 then raise exception 'community:report' using errcode = 'P0001'; end if;
  if not ((p_kind = 'thread' and exists (select 1 from public.community_threads where id = p_id))
    or (p_kind = 'post' and exists (select 1 from public.community_posts where id = p_id))
    or (p_kind = 'club_comment' and exists (select 1 from public.community_club_comments k
      join public.community_club_members m on m.club_id = k.club_id and m.user_id = actor where k.id = p_id))) then
    raise exception 'community:target' using errcode = 'P0001';
  end if;
  perform public.community_rate((select pg_catalog.count(*) from public.community_content_reports r
    where r.reporter_id = actor and r.created_at > pg_catalog.now() - interval '1 day'), 20);
  insert into public.community_content_reports (reporter_id, kind, content_id, reason, details) values (actor, p_kind, p_id, p_reason, details)
  on conflict (reporter_id, kind, content_id) do update set reason = excluded.reason, details = excluded.details, created_at = pg_catalog.now();
end; $$;

revoke all on function public.community_create_club(text, text, text, text[]), public.community_join_club(text), public.community_leave_club(uuid),
  public.community_delete_club(uuid), public.community_list_my_clubs(), public.community_club_detail(uuid), public.community_set_club_milestone(uuid, integer),
  public.community_add_club_comment(uuid, integer, text), public.community_list_club_comments(uuid), public.community_remove_club_comment(uuid),
  public.community_remove_club_member(uuid, uuid), public.community_regenerate_invite(uuid), public.community_create_thread(text, text, boolean),
  public.community_list_threads(text), public.community_thread_detail(uuid), public.community_add_post(uuid, text, boolean),
  public.community_remove_thread(uuid), public.community_remove_post(uuid), public.community_report_content(text, uuid, text, text) from public, anon;
grant execute on function public.community_create_club(text, text, text, text[]), public.community_join_club(text), public.community_leave_club(uuid),
  public.community_delete_club(uuid), public.community_list_my_clubs(), public.community_club_detail(uuid), public.community_set_club_milestone(uuid, integer),
  public.community_add_club_comment(uuid, integer, text), public.community_list_club_comments(uuid), public.community_remove_club_comment(uuid),
  public.community_remove_club_member(uuid, uuid), public.community_regenerate_invite(uuid), public.community_create_thread(text, text, boolean),
  public.community_list_threads(text), public.community_thread_detail(uuid), public.community_add_post(uuid, text, boolean),
  public.community_remove_thread(uuid), public.community_remove_post(uuid), public.community_report_content(text, uuid, text, text) to authenticated;

comment on table public.community_clubs is 'Clubes por convite; nenhum arquivo de livro no servidor. Escrita só por RPC.';
comment on table public.community_content_reports is 'Denúncias de conteúdo; sem leitura pelo cliente.';
commit;
