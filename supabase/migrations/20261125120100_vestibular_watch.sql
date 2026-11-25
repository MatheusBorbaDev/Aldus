-- Robô das leituras de vestibular (25/11/2026, dono: "Admin + robô avisa"). Uma vez por dia o banco busca a página oficial de cada
-- vestibular (watch_url) e guarda a "impressão" dela: o conjunto de links para PDF. Quando esse conjunto muda (edital novo), o Admin
-- recebe um aviso para conferir e publicar. O robô nunca publica lista: editais em PDF mudam de formato e um erro chegaria a estudantes.
-- Requer 20261125120000_vestibular_readings.sql. Usa pg_net (requisição assíncrona) e pg_cron (agendamento).
begin;
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Impressão da página: links .pdf distintos, ordenados. Página dinâmica (data, token) não gera aviso falso; PDF novo gera.
create function aldus_admin_private.vestibular_fingerprint(p_content text) returns text
language sql immutable set search_path = '' as $$
 select md5(coalesce(string_agg(link, '|' order by link), ''))
 from (select distinct lower(m[1]) as link from regexp_matches(coalesce(p_content, ''), 'href\s*=\s*["'']([^"'']+\.pdf)', 'gi') as m) links;
$$;

create function aldus_admin_private.vestibular_watch_send() returns integer
language plpgsql security definer set search_path = '' as $$
declare v record; sent integer := 0;
begin
 for v in select id, watch_url from public.vestibulares where active and watch_url is not null loop
  insert into aldus_admin_private.vestibular_watch (vestibular_id, pending_request)
  values (v.id, net.http_get(url := v.watch_url, timeout_milliseconds := 20000))
  on conflict (vestibular_id) do update set pending_request = excluded.pending_request;
  sent := sent + 1;
 end loop;
 return sent;
end $$;

create function aldus_admin_private.vestibular_watch_collect() returns integer
language plpgsql security definer set search_path = '' as $$
declare w record; response record; fingerprint text; collected integer := 0;
begin
 for w in select * from aldus_admin_private.vestibular_watch where pending_request is not null loop
  select status_code, content into response from net._http_response where id = w.pending_request;
  if not found then continue; end if;
  fingerprint := case when response.status_code = 200 then aldus_admin_private.vestibular_fingerprint(response.content) end;
  update aldus_admin_private.vestibular_watch set
   checked_at = now(), last_status = response.status_code, pending_request = null,
   -- Primeira leitura só registra a base; aviso só quando uma página lida antes mudou de fato.
   changed_at = case when fingerprint is not null and w.last_fingerprint is not null and fingerprint <> w.last_fingerprint then now() else changed_at end,
   last_fingerprint = coalesce(fingerprint, last_fingerprint)
  where vestibular_id = w.vestibular_id;
  collected := collected + 1;
 end loop;
 return collected;
end $$;

revoke all on function aldus_admin_private.vestibular_fingerprint(text), aldus_admin_private.vestibular_watch_send(), aldus_admin_private.vestibular_watch_collect() from public, anon, authenticated;

-- 9h e 9h15 em Brasília (12h e 12h15 UTC): envia as requisições e, depois, lê as respostas.
select cron.schedule('aldus-vestibular-watch-send', '0 12 * * *', 'select aldus_admin_private.vestibular_watch_send()');
select cron.schedule('aldus-vestibular-watch-collect', '15 12 * * *', 'select aldus_admin_private.vestibular_watch_collect()');
commit;
