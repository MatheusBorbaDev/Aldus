-- Community Etapa 2: grafo social (perfil publicado, seguir com pedido, bloqueio e denúncia).
-- CRIADA E TESTADA SÓ LOCALMENTE (PGlite, scripts/test-community-social-schema.cjs). NÃO APLICAR sem autorização do dono.
-- Depende de 202610060001_profiles_and_features e 202610130001_community_foundation (também ainda não aplicada).
-- Regras: nenhuma escrita direta do cliente em follows/blocks/reports (só RPC); quem vê o quê é decidido aqui, não no app;
-- sem contagens públicas, ranking ou comparação entre leitores; atividades e XP continuam derivados só pelo servidor.
begin;

-- 1. Identidade autoritativa: @usuario e avatar do perfil publicado vêm sempre da conta (public.profiles), nunca do cliente.
create function public.community_profile_identity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare account public.profiles%rowtype;
begin
  select * into account from public.profiles where id = NEW.user_id;
  if not found or account.username is null or account.account_status <> 'active' then
    raise exception 'community:account' using errcode = 'P0001';
  end if;
  NEW.username := account.username;
  NEW.avatar_url := case when account.avatar_url ~ '^https://' and pg_catalog.char_length(account.avatar_url) <= 2048 then account.avatar_url else null end;
  return NEW;
end; $$;
create trigger community_profile_identity before insert or update on public.community_profiles
for each row execute function public.community_profile_identity();
revoke all on function public.community_profile_identity() from public, anon, authenticated;

-- Mudança de @usuario/avatar na conta reflete no perfil publicado; conta sem @usuario ou desativada sai da rede.
create function public.community_account_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if NEW.username is null or NEW.account_status <> 'active' then
    delete from public.community_profiles where user_id = NEW.id;
  elsif NEW.username is distinct from OLD.username or NEW.avatar_url is distinct from OLD.avatar_url then
    update public.community_profiles set updated_at = pg_catalog.now() where user_id = NEW.id;
  end if;
  return NEW;
end; $$;
create trigger community_account_changed after update on public.profiles
for each row execute function public.community_account_changed();
revoke all on function public.community_account_changed() from public, anon, authenticated;

-- 2. Relações. Sem grants de escrita: só as funções abaixo alteram estas tabelas.
create table public.community_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (follower_id, following_id),
  check (follower_id <> following_id),
  check ((status = 'accepted') = (accepted_at is not null))
);
create index community_follows_following_idx on public.community_follows (following_id, status);

create table public.community_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index community_blocks_blocked_idx on public.community_blocks (blocked_id);

-- Denúncias: o cliente só cria (via RPC); leitura e tratamento ficam com a administração (service role).
create table public.community_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('spam','harassment','impersonation','illegal_content','other')),
  details text not null default '' check (char_length(details) <= 1000),
  created_at timestamptz not null default now(),
  unique (reporter_id, target_user_id, reason),
  check (reporter_id <> target_user_id)
);

alter table public.community_follows enable row level security;
alter table public.community_blocks enable row level security;
alter table public.community_reports enable row level security;
revoke all on public.community_follows, public.community_blocks, public.community_reports from public, anon, authenticated;
grant select on public.community_follows, public.community_blocks to authenticated;
create policy community_follows_own_read on public.community_follows for select to authenticated
  using ((select auth.uid()) in (follower_id, following_id));
create policy community_blocks_own_read on public.community_blocks for select to authenticated
  using ((select auth.uid()) = blocker_id);

-- 3. Visibilidade. A função só responde sobre quem está consultando (auth.uid()); não revela relações de terceiros.
create function public.community_can_view(p_owner uuid, p_privacy text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when p_owner = (select auth.uid()) then true
    when not exists (select 1 from public.profiles a where a.id = p_owner and a.account_status = 'active' and a.username is not null) then false
    when (select auth.uid()) is not null and exists (
      select 1 from public.community_blocks b
      where (b.blocker_id = p_owner and b.blocked_id = (select auth.uid())) or (b.blocker_id = (select auth.uid()) and b.blocked_id = p_owner)) then false
    when p_privacy = 'PUBLIC' then true
    when p_privacy = 'FOLLOWERS' then (select auth.uid()) is not null and exists (
      select 1 from public.community_follows f
      where f.follower_id = (select auth.uid()) and f.following_id = p_owner and f.status = 'accepted')
    else false
  end;
$$;
revoke all on function public.community_can_view(uuid, text) from public;
grant execute on function public.community_can_view(uuid, text) to anon, authenticated;

drop policy community_profiles_read on public.community_profiles;
create policy community_profiles_read on public.community_profiles for select to anon, authenticated
  using (public.community_can_view(user_id, privacy));
drop policy community_activities_read on public.community_activities;
create policy community_activities_read on public.community_activities for select to anon, authenticated
  using ((select auth.uid()) = user_id or (public.community_can_view(user_id, privacy) and exists (
    select 1 from public.community_profiles p where p.user_id = community_activities.user_id)));

-- Perfil que deixa de aceitar seguidores os perde; perfil que vira público aceita os pedidos pendentes.
create function public.community_profile_privacy_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if TG_OP = 'DELETE' then
    delete from public.community_follows where following_id = OLD.user_id;
    return OLD;
  end if;
  if NEW.privacy = 'PRIVATE' and OLD.privacy <> 'PRIVATE' then
    delete from public.community_follows where following_id = NEW.user_id;
  elsif NEW.privacy = 'PUBLIC' and OLD.privacy <> 'PUBLIC' then
    update public.community_follows set status = 'accepted', accepted_at = pg_catalog.now()
    where following_id = NEW.user_id and status = 'pending';
  end if;
  return NEW;
end; $$;
create trigger community_profile_privacy_changed after update of privacy or delete on public.community_profiles
for each row execute function public.community_profile_privacy_changed();
revoke all on function public.community_profile_privacy_changed() from public, anon, authenticated;

-- 4. RPCs. Todas exigem sessão; erros usam mensagens 'community:<motivo>' para o app traduzir.
create function public.community_actor() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := (select auth.uid());
begin
  if actor is null or not exists (select 1 from public.profiles a where a.id = actor and a.account_status = 'active' and a.username is not null) then
    raise exception 'community:account' using errcode = 'P0001';
  end if;
  return actor;
end; $$;
revoke all on function public.community_actor() from public, anon, authenticated;

create function public.community_blocked_between(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.community_blocks b
    where (b.blocker_id = p_a and b.blocked_id = p_b) or (b.blocker_id = p_b and b.blocked_id = p_a));
$$;
revoke all on function public.community_blocked_between(uuid, uuid) from public, anon, authenticated;

-- Cartão mínimo de um leitor pelo @usuario exato. Perfis privados, bloqueados ou de contas inativas não aparecem.
create function public.community_find_reader(p_username text)
returns table (user_id uuid, username text, display_name text, avatar_url text, privacy text, relation text, follows_me boolean)
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := public.community_actor();
begin
  return query
  select p.user_id, p.username, p.display_name, p.avatar_url, p.privacy,
    case when p.user_id = actor then 'self'
      else coalesce((select case f.status when 'accepted' then 'following' else 'pending' end
        from public.community_follows f where f.follower_id = actor and f.following_id = p.user_id), 'none') end,
    exists (select 1 from public.community_follows f where f.follower_id = p.user_id and f.following_id = actor and f.status = 'accepted')
  from public.community_profiles p
  join public.profiles a on a.id = p.user_id and a.account_status = 'active'
  where p.username = pg_catalog.lower(pg_catalog.btrim(p_username))
    and (p.user_id = actor or (p.privacy <> 'PRIVATE' and not public.community_blocked_between(actor, p.user_id)));
end; $$;

-- Busca por prefixo de @usuario ou nome, só entre perfis públicos; no máximo 20, em ordem alfabética (sem ranking).
create function public.community_search_readers(p_query text)
returns table (user_id uuid, username text, display_name text, avatar_url text, privacy text)
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := public.community_actor();
  q text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_query, '')));
begin
  if pg_catalog.char_length(q) < 2 or pg_catalog.char_length(q) > 40 then
    raise exception 'community:query' using errcode = 'P0001';
  end if;
  return query
  select p.user_id, p.username, p.display_name, p.avatar_url, p.privacy
  from public.community_profiles p
  join public.profiles a on a.id = p.user_id and a.account_status = 'active'
  where p.privacy = 'PUBLIC' and p.user_id <> actor
    and (pg_catalog.left(p.username, pg_catalog.char_length(q)) = q or pg_catalog.lower(pg_catalog.left(p.display_name, pg_catalog.char_length(q))) = q)
    and not public.community_blocked_between(actor, p.user_id)
  order by p.username
  limit 20;
end; $$;

-- Seguir: público entra direto; "seguidores" vira pedido; privado, bloqueado ou inexistente é recusado do mesmo jeito.
create function public.community_follow(p_target uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.community_actor();
  target_privacy text;
  result text;
begin
  if p_target is null or p_target = actor then raise exception 'community:target' using errcode = 'P0001'; end if;
  select p.privacy into target_privacy from public.community_profiles p
    join public.profiles a on a.id = p.user_id and a.account_status = 'active'
    where p.user_id = p_target;
  if target_privacy is null or target_privacy = 'PRIVATE' or public.community_blocked_between(actor, p_target) then
    raise exception 'community:target' using errcode = 'P0001';
  end if;
  select f.status into result from public.community_follows f where f.follower_id = actor and f.following_id = p_target;
  if result is not null then return result; end if;
  if (select pg_catalog.count(*) from public.community_follows f where f.follower_id = actor) >= 2000 then
    raise exception 'community:limit' using errcode = 'P0001';
  end if;
  result := case when target_privacy = 'PUBLIC' then 'accepted' else 'pending' end;
  insert into public.community_follows (follower_id, following_id, status, accepted_at)
  values (actor, p_target, result, case when result = 'accepted' then pg_catalog.now() end)
  on conflict do nothing;
  return result;
end; $$;

-- Deixar de seguir ou cancelar o pedido.
create function public.community_unfollow(p_target uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.community_actor();
begin
  delete from public.community_follows where follower_id = actor and following_id = p_target;
end; $$;

create function public.community_respond_follow(p_follower uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.community_actor();
begin
  if p_accept then
    update public.community_follows set status = 'accepted', accepted_at = pg_catalog.now()
    where follower_id = p_follower and following_id = actor and status = 'pending';
  else
    delete from public.community_follows where follower_id = p_follower and following_id = actor and status = 'pending';
  end if;
end; $$;

create function public.community_remove_follower(p_follower uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.community_actor();
begin
  delete from public.community_follows where follower_id = p_follower and following_id = actor;
end; $$;

-- Listas do próprio usuário. Quem segue alguém aparece para essa pessoa pelo @usuario da conta.
create function public.community_list_follows(p_kind text)
returns table (user_id uuid, username text, display_name text, avatar_url text, status text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := public.community_actor();
begin
  if p_kind not in ('following','followers','requests','sent') then
    raise exception 'community:kind' using errcode = 'P0001';
  end if;
  return query
  select other.id, other.username,
    (select p.display_name from public.community_profiles p where p.user_id = other.id and p.privacy <> 'PRIVATE'),
    (select p.avatar_url from public.community_profiles p where p.user_id = other.id and p.privacy <> 'PRIVATE'),
    f.status, f.created_at
  from public.community_follows f
  join public.profiles other on other.id = case when p_kind in ('following','sent') then f.following_id else f.follower_id end
  where other.account_status = 'active' and other.username is not null
    and case p_kind
      when 'following' then f.follower_id = actor and f.status = 'accepted'
      when 'sent' then f.follower_id = actor and f.status = 'pending'
      when 'followers' then f.following_id = actor and f.status = 'accepted'
      else f.following_id = actor and f.status = 'pending' end
  order by other.username
  limit 500;
end; $$;

-- Bloquear corta a relação nos dois sentidos e esconde os perfis um do outro.
create function public.community_block(p_target uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.community_actor();
begin
  if p_target is null or p_target = actor or not exists (select 1 from public.profiles a where a.id = p_target) then
    raise exception 'community:target' using errcode = 'P0001';
  end if;
  if (select pg_catalog.count(*) from public.community_blocks b where b.blocker_id = actor) >= 2000 then
    raise exception 'community:limit' using errcode = 'P0001';
  end if;
  insert into public.community_blocks (blocker_id, blocked_id) values (actor, p_target) on conflict do nothing;
  delete from public.community_follows
  where (follower_id = actor and following_id = p_target) or (follower_id = p_target and following_id = actor);
end; $$;

create function public.community_unblock(p_target uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.community_actor();
begin
  delete from public.community_blocks where blocker_id = actor and blocked_id = p_target;
end; $$;

create function public.community_list_blocked()
returns table (user_id uuid, username text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := public.community_actor();
begin
  return query
  select b.blocked_id, a.username, b.created_at
  from public.community_blocks b join public.profiles a on a.id = b.blocked_id
  where b.blocker_id = actor
  order by b.created_at desc
  limit 500;
end; $$;

-- Denúncia: uma por motivo e pessoa (repetir atualiza o texto); no máximo 20 por dia por denunciante.
create function public.community_report(p_target uuid, p_reason text, p_details text) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.community_actor();
  details text := pg_catalog.btrim(coalesce(p_details, ''));
begin
  if p_target is null or p_target = actor or not exists (select 1 from public.profiles a where a.id = p_target) then
    raise exception 'community:target' using errcode = 'P0001';
  end if;
  if p_reason is null or p_reason not in ('spam','harassment','impersonation','illegal_content','other') or pg_catalog.char_length(details) > 1000 then
    raise exception 'community:report' using errcode = 'P0001';
  end if;
  if (select pg_catalog.count(*) from public.community_reports r
      where r.reporter_id = actor and r.created_at > pg_catalog.now() - interval '1 day') >= 20 then
    raise exception 'community:limit' using errcode = 'P0001';
  end if;
  insert into public.community_reports (reporter_id, target_user_id, reason, details)
  values (actor, p_target, p_reason, details)
  on conflict (reporter_id, target_user_id, reason) do update set details = excluded.details, created_at = pg_catalog.now();
end; $$;

revoke all on function public.community_find_reader(text), public.community_search_readers(text), public.community_follow(uuid),
  public.community_unfollow(uuid), public.community_respond_follow(uuid, boolean), public.community_remove_follower(uuid),
  public.community_list_follows(text), public.community_block(uuid), public.community_unblock(uuid),
  public.community_list_blocked(), public.community_report(uuid, text, text) from public, anon;
grant execute on function public.community_find_reader(text), public.community_search_readers(text), public.community_follow(uuid),
  public.community_unfollow(uuid), public.community_respond_follow(uuid, boolean), public.community_remove_follower(uuid),
  public.community_list_follows(text), public.community_block(uuid), public.community_unblock(uuid),
  public.community_list_blocked(), public.community_report(uuid, text, text) to authenticated;

comment on table public.community_follows is 'Grafo social; escrita só por RPC. FOLLOWERS exige status accepted.';
comment on table public.community_reports is 'Denúncias; sem leitura pelo cliente.';
commit;
