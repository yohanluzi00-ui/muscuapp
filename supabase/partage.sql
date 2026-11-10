-- Liens de partage courts (https://fiitday.com/#/s/CODE) — à exécuter une fois dans Supabase › SQL Editor.
-- Une séance partagée est enregistrée avec un code. Seul quelqu'un qui connaît le code peut la lire
-- (fonction get_share) : personne ne peut lister les séances partagées.

create table if not exists public.shares (
  code       text primary key check (code ~ '^[A-Za-z0-9]{6,12}$'),
  data       jsonb not null check (octet_length(data::text) < 60000),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.shares enable row level security;

drop policy if exists shares_insert_own on public.shares;
drop policy if exists shares_delete_own on public.shares;
create policy shares_insert_own on public.shares for insert to authenticated with check (auth.uid() = user_id);
create policy shares_delete_own on public.shares for delete to authenticated using (auth.uid() = user_id);

revoke all on public.shares from anon, authenticated;
grant insert, delete on public.shares to authenticated;

-- lecture d'une séance partagée, uniquement par son code
create or replace function public.get_share(p_code text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select s.data from public.shares s where s.code = p_code
$$;
revoke all on function public.get_share(text) from public;
revoke execute on function public.get_share(text) from anon;
grant execute on function public.get_share(text) to authenticated; -- import une fois connecté
