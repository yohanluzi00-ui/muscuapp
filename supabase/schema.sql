-- Base de données de MuscuApp (à exécuter une seule fois dans Supabase › SQL Editor).
-- Une seule table : chaque ligne est un élément (séance-type, séance réalisée, réglages)
-- appartenant à l'utilisateur connecté. Personne d'autre ne peut lire ni modifier ses lignes.

create table if not exists public.items (
  user_id    uuid    not null default auth.uid() references auth.users (id) on delete cascade,
  id         text    not null,
  kind       text    not null,
  data       jsonb   not null,
  updated_at bigint  not null,              -- horodatage de la modification, côté appareil (ms)
  deleted    boolean not null default false,
  server_at  timestamptz not null default clock_timestamp(),  -- horodatage côté serveur, pour la synchro
  primary key (user_id, id)
);

create index if not exists items_user_server_at on public.items (user_id, server_at);

-- server_at est toujours fixé par le serveur
create or replace function public.items_touch_server_at() returns trigger
language plpgsql as $$
begin
  new.server_at := clock_timestamp();
  return new;
end $$;

drop trigger if exists items_touch on public.items;
create trigger items_touch before insert or update on public.items
for each row execute function public.items_touch_server_at();

-- Sécurité : chacun ne voit que ses propres données
alter table public.items enable row level security;

drop policy if exists items_select_own on public.items;
drop policy if exists items_insert_own on public.items;
drop policy if exists items_update_own on public.items;
drop policy if exists items_delete_own on public.items;

create policy items_select_own on public.items for select to authenticated using (auth.uid() = user_id);
create policy items_insert_own on public.items for insert to authenticated with check (auth.uid() = user_id);
create policy items_update_own on public.items for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy items_delete_own on public.items for delete to authenticated using (auth.uid() = user_id);

revoke all on public.items from anon;
grant select, insert, update, delete on public.items to authenticated;
