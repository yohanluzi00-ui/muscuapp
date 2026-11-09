-- Suppression de compte depuis l'appli (Réglages › Supprimer mon compte) — à exécuter une fois dans
-- Supabase › SQL Editor, avec le rôle « postgres ».
-- Supprime le compte de la personne connectée ; ses données (items, shares) partent avec lui (on delete cascade).

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
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
