-- Renforcement de la sécurité (audit de novembre 2026) — à exécuter une fois dans Supabase › SQL Editor,
-- avec le rôle « postgres », après schema.sql, partage.sql et suppression-compte.sql.
-- Peut être relancé sans risque. Ne supprime aucune donnée.

-- 1. Fonctions avec un chemin de recherche vide (avertissement « Function Search Path Mutable »
--    du conseiller de sécurité Supabase) : une fonction ne peut pas être détournée vers une autre table.
create or replace function public.items_touch_server_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.server_at := pg_catalog.clock_timestamp();
  return new;
end $$;

create or replace function public.get_share(p_code text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select s.data from public.shares s where s.code = p_code
$$;
revoke all on function public.get_share(text) from public;
revoke execute on function public.get_share(text) from anon;
grant execute on function public.get_share(text) to authenticated; -- import une fois connecté

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'non connecté';
  end if;
  delete from auth.users where id = uid;
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- 2. Taille maximale d'un élément enregistré (identifiant court, contenu < 500 Ko) :
--    empêche de remplir la base avec un énorme contenu. « not valid » : les lignes existantes ne sont pas vérifiées.
alter table public.items drop constraint if exists items_limits;
alter table public.items add constraint items_limits
  check (char_length(id) between 1 and 64 and char_length(kind) <= 20 and octet_length(data::text) < 500000) not valid;

-- 3. Séances partagées : 200 au maximum par compte (au-delà, l'appli donne un lien long à la place).
create index if not exists shares_user_id on public.shares (user_id);

create or replace function public.shares_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.shares s where s.user_id = new.user_id) >= 200 then
    raise exception 'trop de séances partagées';
  end if;
  return new;
end $$;
revoke all on function public.shares_limit() from public, anon, authenticated;

drop trigger if exists shares_limit on public.shares;
create trigger shares_limit before insert on public.shares
for each row execute function public.shares_limit();
