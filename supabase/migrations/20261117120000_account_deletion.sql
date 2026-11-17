-- Account deletion (owner's request, 17/11/2026). The Edge Function account-delete removes the Auth user; every account row then
-- leaves by cascade. Upload reservations referenced the profile without cascade, which would block the deletion of anyone with a
-- pending or past reservation: they now go with the profile. Administration members keep the restrictive reference on purpose
-- (the function refuses those accounts). Local only until the owner authorizes applying it.
begin;

do $$
declare constraint_name text;
begin
  select c.conname into constraint_name
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'saas_private' and t.relname = 'upload_reservations' and c.contype = 'f'
    and c.confrelid = 'public.profiles'::regclass;
  if constraint_name is null then raise exception 'upload_reservations profile reference not found'; end if;
  execute format('alter table saas_private.upload_reservations drop constraint %I', constraint_name);
end $$;

alter table saas_private.upload_reservations
  add constraint upload_reservations_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;

commit;
