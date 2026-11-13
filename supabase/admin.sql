-- Fiitday : tableau de bord de l'administration (Réglages › Administration).
-- Une seule fonction, en lecture seule : elle renvoie des totaux (aucun e-mail, prénom ni contenu de séance)
-- et refuse de répondre à tout autre compte que celui de l'administrateur.

create or replace function public.admin_kpis()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
  d bigint := 86400000;
  res jsonb;
begin
  if auth.uid() is distinct from '8d8a867f-e766-41ca-b197-7694f5f5e1c4'::uuid then
    raise exception 'Réservé à l''administrateur' using errcode = '42501';
  end if;

  with fin as ( -- séances terminées : compte et date de début (en millisecondes)
    select user_id, (data->>'startedAt')::bigint as s
    from public.items
    where kind = 'workout' and not deleted
      and data->>'endedAt' is not null
      and data->>'startedAt' ~ '^[0-9]{10,14}$'
  )
  select jsonb_build_object(
    'users',       (select count(*) from auth.users),
    'users7',      (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'users30',     (select count(*) from auth.users where created_at > now() - interval '30 days'),
    'active7',     (select count(distinct user_id) from fin where s > now_ms - 7 * d),
    'active30',    (select count(distinct user_id) from fin where s > now_ms - 30 * d),
    'workouts',    (select count(*) from fin),
    'workouts7',   (select count(*) from fin where s > now_ms - 7 * d),
    'shares',      (select count(*) from public.shares),
    'shares30',    (select count(*) from public.shares where created_at > now() - interval '30 days'),
    'transfers30', (select count(*) from public.transfers where created_at > now() - interval '30 days'),
    -- 8 dernières semaines (lundi) : séances, utilisateurs actifs, inscriptions
    'weeks', (
      select coalesce(jsonb_agg(jsonb_build_object('w', to_char(wk, 'YYYY-MM-DD'), 'n', n, 'u', u, 'i', i) order by wk), '[]'::jsonb)
      from (
        select g.wk,
          (select count(*) from fin where to_timestamp(fin.s / 1000.0) >= g.wk and to_timestamp(fin.s / 1000.0) < g.wk + interval '7 days') as n,
          (select count(distinct user_id) from fin where to_timestamp(fin.s / 1000.0) >= g.wk and to_timestamp(fin.s / 1000.0) < g.wk + interval '7 days') as u,
          (select count(*) from auth.users au where au.created_at >= g.wk and au.created_at < g.wk + interval '7 days') as i
        from generate_series(date_trunc('week', now()) - interval '7 weeks', date_trunc('week', now()), interval '1 week') as g(wk)
      ) x
    ),
    'at', now()
  ) into res;
  return res;
end $$;

revoke all on function public.admin_kpis() from public, anon;
grant execute on function public.admin_kpis() to authenticated;
