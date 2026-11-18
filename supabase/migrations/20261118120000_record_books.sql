-- Livro sem arquivo (catálogo do Aldus, 18/11/2026; pedido do dono "Fazer 1 a 6"). Incremental: requires every earlier migration.
-- Do NOT replay earlier migrations or rewrite their ledger.
-- A book kept from the catalog (physical, other store e-book or audiobook) is a row kind='book' with payload format 'record':
-- no file, no remotePath, id 'record-<id>'. Owner's decision: books without a file do not count in the synced-book quota.
-- Every function below is the deployed body with only the marked change.
begin;

-- 1. library_apply (moved to library_private by 20261015160539): accept format 'record' without a file.
create or replace function library_private.library_apply(
  p_operation_id uuid, p_book_id text, p_kind text, p_entity_id text,
  p_expected_revision bigint, p_payload jsonb, p_deleted boolean
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  previous public.user_library_items;
  result public.user_library_items;
  receipt public.user_library_operations;
  request jsonb := jsonb_build_object('book',p_book_id,'kind',p_kind,'id',p_entity_id,'base',p_expected_revision,'payload',p_payload,'deleted',p_deleted);
  answer jsonb;
begin
  if actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  if p_operation_id is null or p_deleted is null or p_expected_revision is null or p_expected_revision < 0 then raise exception 'invalid operation' using errcode='22023'; end if;
  -- Serialize all mutations of a book, including delete vs child mutation/receipt races.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text || '/' || p_book_id,0));
  select * into receipt from public.user_library_operations where user_id=actor and operation_id=p_operation_id;
  if found then
    if receipt.request <> request then raise exception 'operation identity reused' using errcode='22023'; end if;
    return receipt.response;
  end if;
  select * into previous from public.user_library_items where user_id=actor and kind=p_kind and id=p_entity_id;
  if found and (previous.book_id <> p_book_id or previous.revision <> p_expected_revision or previous.deleted_at is not null) then
    return jsonb_build_object('accepted',false,'row',to_jsonb(previous));
  end if;
  if previous.id is null and p_expected_revision <> 0 then raise exception 'unknown revision' using errcode='22023'; end if;
  if p_kind <> 'book' and not exists(select 1 from public.user_library_items where user_id=actor and kind='book' and id=p_book_id and deleted_at is null) then
    raise exception 'book unavailable' using errcode='42501';
  end if;
  if p_kind='book' then
    -- CHANGED (18/11/2026): 'record' joins 'epub' and 'pdf'.
    if p_payload->>'format' is null or p_payload->>'format' not in ('epub','pdf','record') or p_payload->>'title' is null or p_entity_id <> p_book_id then raise exception 'invalid book' using errcode='22023'; end if;
    -- NEW (18/11/2026): a book without a file never has a private path and always uses the 'record-' identity.
    if p_payload->>'format'='record' and (p_book_id !~ '^record-[A-Za-z0-9_-]{8,64}$' or (p_payload ? 'remotePath' and p_payload->>'remotePath' is not null)) then
      raise exception 'invalid book' using errcode='22023';
    end if;
    if p_payload ? 'remotePath' and p_payload->>'remotePath' is not null and
      (split_part(p_payload->>'remotePath','/',1) <> actor::text or split_part(p_payload->>'remotePath','/',2) <> p_book_id
       or p_payload->>'remotePath' !~ '^[a-f0-9-]{36}/[^/\\]{1,200}/[a-f0-9]{64}\.(epub|pdf)$') then
      raise exception 'invalid private path' using errcode='22023';
    end if;
  end if;
  insert into public.user_library_items(user_id,kind,id,book_id,payload,deleted_at)
    values(actor,p_kind,p_entity_id,p_book_id,p_payload,case when p_deleted then now() else null end)
  on conflict(user_id,kind,id) do update set payload=excluded.payload,deleted_at=excluded.deleted_at,
    revision=nextval('public.user_library_revision_seq'),updated_at=now()
  returning * into result;
  answer := jsonb_build_object('accepted',true,'row',to_jsonb(result));
  insert into public.user_library_operations(user_id,operation_id,request,response) values(actor,p_operation_id,request,answer);
  return answer;
end $$;
revoke all on function library_private.library_apply(uuid,text,text,text,bigint,jsonb,boolean) from public, anon, authenticated;

-- 2. Book quota trigger (last defined by 20261015215745): books without a file are neither checked nor counted.
create or replace function saas_private.enforce_book_quota() returns trigger language plpgsql security definer set search_path='' as $$
declare cap bigint; used bigint;
begin
 -- CHANGED (18/11/2026): a record row never grows the quota.
 if new.kind<>'book' or new.deleted_at is not null or new.payload->>'format'='record' then return new; end if;
 if tg_op='UPDATE' then if old.kind='book' and old.deleted_at is null and old.user_id=new.user_id then return new; end if; end if;
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'quota growth requires read committed' using errcode='25001'; end if;
 perform 1 from public.profiles where id=new.user_id and account_status='active' for update;
 if not found then raise exception 'active account required' using errcode='42501'; end if;
 select synced_books into cap from public.saas_plans where id=saas_private.effective_plan(new.user_id);
 -- CHANGED (18/11/2026): records excluded from the count.
 select count(*) into used from public.user_library_items where user_id=new.user_id and kind='book' and deleted_at is null and coalesce(payload->>'format','')<>'record';
 if used>cap then raise exception 'synced book quota exceeded' using errcode='PQL01'; end if;
 return new;
end $$;

-- 3. Quota usage (20261015215745): syncedBooks excludes books without a file.
create or replace function saas_private.quota_usage(p_user uuid) returns jsonb language sql stable security definer set search_path='' as $$
 with objects as (
  select name,metadata from storage.objects where bucket_id='aldus-private-library' and split_part(name,'/',1)=p_user::text
 ), reservations as (
  select r.bytes from saas_private.upload_reservations r where r.user_id=p_user and r.state='reserved'
  and r.expires_at>clock_timestamp() and not exists(select 1 from objects o where o.name=r.path)
 ) select jsonb_build_object(
  'syncedBooks',(select count(*) from public.user_library_items where user_id=p_user and kind='book' and deleted_at is null and coalesce(payload->>'format','')<>'record'),
  'storageBytes',(select case when count(*) filter(where metadata->>'size' is null or metadata->>'size' !~ '^[0-9]{1,15}$')=0
    then coalesce(sum(case when metadata->>'size' ~ '^[0-9]{1,15}$' then (metadata->>'size')::bigint else 0 end),0) else null end from objects),
  'objects',(select count(*) from objects),'reservedBytes',(select coalesce(sum(bytes),0) from reservations),
  'reservedUploads',(select count(*) from reservations));
$$;
revoke all on function saas_private.quota_usage(uuid) from public,anon,authenticated;

-- 4. Account snapshot for "Meu Plano" (20261015190705): the same count without books without a file.
create or replace function public.saas_account_snapshot() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
  actor uuid := auth.uid(); p public.saas_plans; s public.saas_account_subscriptions;
  books bigint; bytes bigint; unknown_sizes bigint; features jsonb;
begin
  if not public.library_account_active() then raise exception 'active account required' using errcode='42501'; end if;
  select * into p from public.saas_plans where id=saas_private.effective_plan(actor);
  select * into s from public.saas_account_subscriptions where user_id=actor;
  -- CHANGED (18/11/2026): records excluded.
  select count(*) into books from public.user_library_items where user_id=actor and kind='book' and deleted_at is null and coalesce(payload->>'format','')<>'record';
  select coalesce(sum(case when metadata->>'size' ~ '^[0-9]{1,15}$' then (metadata->>'size')::bigint else 0 end),0),
    count(*) filter(where metadata->>'size' is null or metadata->>'size' !~ '^[0-9]{1,15}$')
    into bytes,unknown_sizes from storage.objects where bucket_id='aldus-private-library' and split_part(name,'/',1)=actor::text;
  select coalesce(jsonb_object_agg(feature,enabled),'{}') into features from (
    select feature,enabled from public.saas_plan_features where plan_id=p.id
    and feature not in (select feature from public.saas_account_entitlements where user_id=actor and (ends_at is null or ends_at>now()))
    union all select feature,enabled from public.saas_account_entitlements where user_id=actor and (ends_at is null or ends_at>now())
  ) f;
  -- Product baseline cannot be revoked by premium configuration or overrides.
  features := features || '{"local_reading":true,"book_import":true,"library_sync":true,"progress_sync":true,"study_sync":true,"organization_sync":true,"private_storage":true,"basic_study":true}'::jsonb;
  return jsonb_build_object('version',1,'userId',actor,'source','server_database','effectivePlan',p.id,
    'plan',jsonb_build_object('id',p.id,'name',p.name,'priceBrlCentavos',p.price_brl_centavos),
    'limits',jsonb_build_object('syncedBooks',p.synced_books,'storageBytes',p.storage_bytes),
    'usage',jsonb_build_object('syncedBooks',books,'storageBytes',case when unknown_sizes=0 then bytes else null end),
    'remaining',jsonb_build_object('syncedBooks',greatest(0,p.synced_books-books),'storageBytes',case when unknown_sizes=0 then greatest(0,p.storage_bytes-bytes) else null end),
    'features',features,'subscription',jsonb_build_object('planId',s.plan_id,'status',case
      when s.ends_at<=now() and s.status in ('active','trialing') then 'expired' else s.status end,
      'startsAt',s.starts_at,'endsAt',s.ends_at,'grantSource',s.grant_source));
end $$;
revoke all on function public.saas_account_snapshot() from public,anon,authenticated;
grant execute on function public.saas_account_snapshot() to authenticated;

notify pgrst, 'reload schema';
commit;
