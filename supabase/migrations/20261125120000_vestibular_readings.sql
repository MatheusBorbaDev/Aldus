-- Leituras obrigatórias de vestibulares (25/11/2026, pedido do dono). Aditiva; requer Aldus Admin 1.5.
-- Leitura pública (também sem conta: é informação de edital). Escrita só por RPC do Admin com MFA recente e auditoria.
-- Sugestões de quem usa o app vão para o Admin e nunca são publicadas sozinhas.
begin;

create table public.vestibulares (
 id text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
 name text not null check (length(trim(name)) between 1 and 60),
 institution text not null check (length(trim(institution)) between 1 and 120),
 official_url text check (official_url is null or (official_url ~ '^https://[^[:space:]]{3,}$' and length(official_url) <= 500)),
 -- Página oficial que o robô confere em busca de edital novo (ver 20261125120100_vestibular_watch.sql).
 watch_url text check (watch_url is null or (watch_url ~ '^https://[^[:space:]]{3,}$' and length(watch_url) <= 500)),
 sort smallint not null default 100,
 active boolean not null default true
);

create table public.vestibular_reading_lists (
 vestibular_id text not null references public.vestibulares(id),
 exam_year integer not null check (exam_year between 1990 and 2100),
 source_url text not null check (source_url ~ '^https://[^[:space:]]{3,}$' and length(source_url) <= 500),
 books jsonb not null check (jsonb_typeof(books) = 'array' and jsonb_array_length(books) between 1 and 60 and octet_length(books::text) <= 32768),
 updated_at timestamptz not null default now(),
 updated_by uuid,
 primary key (vestibular_id, exam_year)
);

create table public.vestibular_suggestions (
 id bigint generated always as identity primary key,
 user_id uuid not null default auth.uid(),
 vestibular_id text references public.vestibulares(id),
 message text not null check (length(trim(message)) between 5 and 600),
 created_at timestamptz not null default now(),
 handled_at timestamptz
);

alter table public.vestibulares enable row level security;
alter table public.vestibular_reading_lists enable row level security;
alter table public.vestibular_suggestions enable row level security;
create policy vestibulares_public_read on public.vestibulares for select to anon, authenticated using (active);
create policy vestibular_lists_public_read on public.vestibular_reading_lists for select to anon, authenticated
 using (exists (select 1 from public.vestibulares v where v.id = vestibular_id and v.active));
-- Sugestões: nenhuma leitura ou escrita direta; só pela função abaixo (com limite) e pelo Admin.
create policy vestibular_suggestions_rpc_only on public.vestibular_suggestions as restrictive for all to public using (false) with check (false);
revoke all on public.vestibulares, public.vestibular_reading_lists, public.vestibular_suggestions from anon, authenticated;
grant select (id, name, institution, official_url, sort, active) on public.vestibulares to anon, authenticated;
grant select (vestibular_id, exam_year, source_url, books, updated_at) on public.vestibular_reading_lists to anon, authenticated;

-- Quem usa o app: até 5 sugestões por dia, só com conta ativa.
create function public.vestibular_suggest(p_vestibular text, p_message text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null or not exists (select 1 from public.profiles where id = auth.uid() and account_status = 'active') then
  return jsonb_build_object('ok', false, 'code', 'account');
 end if;
 if p_message is null or length(trim(p_message)) not between 5 and 600 then return jsonb_build_object('ok', false, 'code', 'message'); end if;
 if p_vestibular is not null and not exists (select 1 from public.vestibulares where id = p_vestibular and active) then
  return jsonb_build_object('ok', false, 'code', 'vestibular');
 end if;
 if (select count(*) from public.vestibular_suggestions where user_id = auth.uid() and created_at > now() - interval '1 day') >= 5 then
  return jsonb_build_object('ok', false, 'code', 'rate');
 end if;
 insert into public.vestibular_suggestions (user_id, vestibular_id, message) values (auth.uid(), p_vestibular, trim(p_message));
 return jsonb_build_object('ok', true);
end $$;

-- Admin: quem tem acesso ao painel lê listas, sugestões e avisos do robô.
create function public.vestibular_admin_read() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
 perform aldus_admin_private.require_permission('access');
 return jsonb_build_object(
  'vestibulares', coalesce((select jsonb_agg(to_jsonb(v) order by v.sort, v.id) from public.vestibulares v), '[]'),
  'lists', coalesce((select jsonb_agg(jsonb_build_object('vestibular_id', l.vestibular_id, 'exam_year', l.exam_year, 'source_url', l.source_url, 'books', l.books, 'updated_at', l.updated_at)
    order by l.vestibular_id, l.exam_year desc) from public.vestibular_reading_lists l), '[]'),
  'suggestions', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'vestibular_id', s.vestibular_id, 'message', s.message, 'created_at', s.created_at) order by s.created_at desc)
    from (select * from public.vestibular_suggestions where handled_at is null order by created_at desc limit 200) s), '[]'),
  'alerts', coalesce((select jsonb_agg(jsonb_build_object('vestibular_id', w.vestibular_id, 'changed_at', w.changed_at, 'checked_at', w.checked_at, 'status', w.last_status) order by w.changed_at desc)
    from aldus_admin_private.vestibular_watch w where w.changed_at is not null and (w.acknowledged_at is null or w.acknowledged_at < w.changed_at)), '[]'));
end $$;

-- Admin: publicar/corrigir/remover uma lista, marcar sugestão ou aviso como visto. OWNER ou permissão content.manage, MFA recente.
create function public.vestibular_admin_change(p_action text, p_vestibular text, p_year integer, p_payload jsonb, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare item jsonb; n integer := 0;
begin
 perform aldus_admin_private.require_permission('content.manage');
 if not aldus_admin_private.recent_mfa() then raise exception 'recent TOTP MFA required' using errcode = '42501'; end if;
 if length(trim(coalesce(p_reason, ''))) not between 8 and 500 then raise exception 'reason required' using errcode = '22023'; end if;
 if p_action = 'publish' then
  if p_payload is null or jsonb_typeof(p_payload->'books') <> 'array' or (p_payload->>'source_url') !~ '^https://[^[:space:]]{3,}$' or length(p_payload->>'source_url') > 500 then
   raise exception 'invalid list' using errcode = '22023'; end if;
  for item in select value from jsonb_array_elements(p_payload->'books') loop
   n := n + 1;
   if jsonb_typeof(item) <> 'object' or length(trim(coalesce(item->>'title', ''))) not between 1 and 200
    or length(trim(coalesce(item->>'author', ''))) not between 1 and 160 or length(coalesce(item->>'note', '')) > 300
    or exists (select 1 from jsonb_object_keys(item) k where k not in ('position', 'title', 'author', 'note')) then
    raise exception 'invalid book %', n using errcode = '22023'; end if;
  end loop;
  insert into public.vestibular_reading_lists (vestibular_id, exam_year, source_url, books, updated_at, updated_by)
  values (p_vestibular, p_year, p_payload->>'source_url', p_payload->'books', now(), auth.uid())
  on conflict (vestibular_id, exam_year) do update set source_url = excluded.source_url, books = excluded.books, updated_at = now(), updated_by = auth.uid();
 elsif p_action = 'remove' then
  delete from public.vestibular_reading_lists where vestibular_id = p_vestibular and exam_year = p_year;
  if not found then raise exception 'list not found' using errcode = '22023'; end if;
 elsif p_action = 'suggestion_done' then
  update public.vestibular_suggestions set handled_at = now() where id = (p_payload->>'id')::bigint and handled_at is null;
  if not found then raise exception 'suggestion not found' using errcode = '22023'; end if;
 elsif p_action = 'alert_seen' then
  update aldus_admin_private.vestibular_watch set acknowledged_at = now() where vestibular_id = p_vestibular;
 else raise exception 'unknown command' using errcode = '22023';
 end if;
 insert into public.aldus_admin_audit (actor, resource, action, outcome, reason, changes)
 values (auth.uid(), 'vestibular:' || coalesce(p_vestibular, '-') || ':' || coalesce(p_year::text, '-'), p_action, 'success', trim(p_reason),
  jsonb_build_object('books', case when p_action = 'publish' then jsonb_array_length(p_payload->'books') end));
 return jsonb_build_object('ok', true);
end $$;

-- Estado do robô (preenchido pela migration seguinte); só o Admin lê, pela função acima.
create table aldus_admin_private.vestibular_watch (
 vestibular_id text primary key references public.vestibulares(id),
 last_fingerprint text, last_status integer, checked_at timestamptz, changed_at timestamptz, acknowledged_at timestamptz, pending_request bigint
);

revoke all on function public.vestibular_suggest(text, text), public.vestibular_admin_read(), public.vestibular_admin_change(text, text, integer, jsonb, text) from public, anon, authenticated;
grant execute on function public.vestibular_suggest(text, text), public.vestibular_admin_read(), public.vestibular_admin_change(text, text, integer, jsonb, text) to authenticated;

insert into public.vestibulares (id, name, institution, official_url, watch_url, sort) values
 ('fuvest', 'Fuvest', 'Universidade de São Paulo (USP)', 'https://www.fuvest.br', null, 10),
 ('unicamp', 'Unicamp', 'Universidade Estadual de Campinas', 'https://www.comvest.unicamp.br', null, 20),
 ('ufrgs', 'UFRGS', 'Universidade Federal do Rio Grande do Sul', 'https://www.ufrgs.br/coperse', null, 30),
 ('uel', 'UEL', 'Universidade Estadual de Londrina', 'https://www.cops.uel.br', null, 40),
 ('ufpr', 'UFPR', 'Universidade Federal do Paraná', 'https://www.nc.ufpr.br', null, 50);
commit;
