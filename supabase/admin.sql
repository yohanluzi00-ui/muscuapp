-- Fiitday : tableau de bord de l'administration (Réglages › Administration).
-- Une fonction qui ne modifie aucune donnée de l'appli : elle renvoie des totaux (aucun e-mail, prénom ni contenu de séance)
-- et refuse de répondre à tout autre compte que celui de l'administrateur, et sans double authentification (code à 6 chiffres).
-- Chaque refus est noté dans admin_access_log (compte, raison, date ; gardé 12 mois) pour le bloc Sécurité.

create table if not exists public.admin_access_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  user_id uuid,
  reason text not null
);
create index if not exists admin_access_log_at on public.admin_access_log (at);
alter table public.admin_access_log enable row level security; -- aucune règle : personne ne lit ni n'écrit cette table directement
revoke all on public.admin_access_log from public, anon, authenticated;

create or replace function public.admin_kpis()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
  d bigint := 86400000;
  admin_id constant uuid := '8d8a867f-e766-41ca-b197-7694f5f5e1c4';
  me uuid := auth.uid();
  res jsonb;
begin
  -- refus : noté dans le journal (au plus 60 par compte et par heure, pour qu'on ne puisse pas le remplir), puis réponse vide
  if me is distinct from admin_id or coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    if (select count(*) from public.admin_access_log l where l.user_id is not distinct from me and l.at > now() - interval '1 hour') < 60 then
      insert into public.admin_access_log (user_id, reason)
      values (me, case when me is distinct from admin_id then 'autre compte' else 'sans code' end);
    end if;
    return jsonb_build_object('denied', true, 'mfa', coalesce(me = admin_id, false));
  end if;
  delete from public.admin_access_log l where l.at < now() - interval '12 months';

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
    -- bloc Sécurité : uniquement des nombres et des dates
    'sec', jsonb_build_object(
      'denied24',   (select count(*) from public.admin_access_log where at > now() - interval '1 day'),
      'other7',     (select count(*) from public.admin_access_log where at > now() - interval '7 days' and reason = 'autre compte'),
      'otherUsers7',(select count(distinct user_id) from public.admin_access_log where at > now() - interval '7 days' and reason = 'autre compte'),
      'nocode7',    (select count(*) from public.admin_access_log where at > now() - interval '7 days' and reason = 'sans code'),
      'mfaFail24',  (select count(*) from auth.mfa_challenges c join auth.mfa_factors f on f.id = c.factor_id
                      where f.user_id = admin_id and c.verified_at is null and c.created_at > now() - interval '1 day' and c.created_at < now() - interval '5 minutes'),
      'mfaFail7',   (select count(*) from auth.mfa_challenges c join auth.mfa_factors f on f.id = c.factor_id
                      where f.user_id = admin_id and c.verified_at is null and c.created_at > now() - interval '7 days' and c.created_at < now() - interval '5 minutes'),
      'factors',    (select count(*) from auth.mfa_factors where user_id = admin_id and status = 'verified'),
      'factorNew7', (select count(*) from auth.mfa_factors where user_id = admin_id and status = 'verified' and created_at > now() - interval '7 days'),
      'sessions7',  (select count(*) from auth.sessions where user_id = admin_id and created_at > now() - interval '7 days'),
      'devices7',   (select count(distinct coalesce(user_agent, '')) from auth.sessions where user_id = admin_id and created_at > now() - interval '7 days'),
      'lastLogin',  (select last_sign_in_at from auth.users where id = admin_id),
      'recovery24', (select count(*) from auth.users where recovery_sent_at > now() - interval '1 day'),
      'signups24',  (select count(*) from auth.users where created_at > now() - interval '1 day'),
      'xferFail24', (select count(*) from public.transfer_tries where at > now() - interval '1 day'),
      'banned',     (select count(*) from auth.users where banned_until > now())
    ),
    'at', now()
  ) into res;
  return res;
end $$;

revoke all on function public.admin_kpis() from public, anon;
grant execute on function public.admin_kpis() to authenticated;
