-- Fiitday · codes de transfert (V1.39) — à exécuter une fois dans Supabase › SQL Editor (rôle « postgres »).
-- Sans risque : à relancer autant de fois que nécessaire.
--
-- Réglages › Données › « Créer un code » : la sauvegarde est rangée ici avec un code de 8 caractères
-- (lettres majuscules et chiffres, sans 0 / O / 1 / I pour éviter les confusions), valable 1 heure.
-- Dans l'autre compte, « J'ai un code » récupère la sauvegarde.
--   * le code est tiré au hasard par le serveur ; la clé primaire garantit qu'aucun code n'existe en double,
--     même si beaucoup de personnes créent un code au même moment (en cas de collision, un autre code est tiré) ;
--   * une personne n'a qu'un code actif : en créer un nouveau efface le précédent ;
--   * les codes expirés sont effacés ;
--   * personne ne peut lister les codes : la table n'est lisible que par les deux fonctions ci-dessous ;
--   * 20 codes faux par heure au maximum pour une même personne (contre les essais au hasard).

create table if not exists public.transfers (
  code       text primary key check (code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$'),
  user_id    uuid not null references auth.users (id) on delete cascade,
  payload    text not null check (length(payload) between 1 and 2000000),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists transfers_user_idx on public.transfers (user_id);
create index if not exists transfers_expires_idx on public.transfers (expires_at);
alter table public.transfers enable row level security;
revoke all on public.transfers from public, anon, authenticated;

create table if not exists public.transfer_tries (
  user_id uuid not null references auth.users (id) on delete cascade,
  at      timestamptz not null default now()
);
create index if not exists transfer_tries_idx on public.transfer_tries (user_id, at);
alter table public.transfer_tries enable row level security;
revoke all on public.transfer_tries from public, anon, authenticated;

-- créer un code (la sauvegarde compressée est envoyée par l'appli)
create or replace function public.create_transfer(p_payload text)
returns table (transfer_code text, valid_until timestamptz)
language plpgsql volatile security definer set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- 32 caractères
  me  uuid := auth.uid();
  exp timestamptz := now() + interval '1 hour';
  b   bytea;
  c   text;
  i   int;
begin
  if me is null then raise exception 'Connecte-toi pour créer un code' using errcode = '28000'; end if;
  if p_payload is null or length(p_payload) = 0 or length(p_payload) > 2000000 then
    raise exception 'Sauvegarde vide ou trop grande' using errcode = '22023';
  end if;
  delete from public.transfers t where t.expires_at <= now() or t.user_id = me;
  for attempt in 1..20 loop
    b := pg_catalog.uuid_send(pg_catalog.gen_random_uuid()); -- 16 octets tirés par un générateur sûr
    c := '';
    foreach i in array array[0, 1, 2, 3, 4, 5, 9, 10] loop -- octets entièrement aléatoires (hors bits de version)
      c := c || substr(alphabet, (get_byte(b, i) % 32) + 1, 1);
    end loop;
    begin
      insert into public.transfers (code, user_id, payload, expires_at) values (c, me, p_payload, exp);
      transfer_code := c; valid_until := exp;
      return next;
      return;
    exception when unique_violation then
      null; -- code déjà pris : on en tire un autre
    end;
  end loop;
  raise exception 'Impossible de créer un code, réessaie' using errcode = 'P0001';
end $$;

-- récupérer la sauvegarde d'un code encore valable (null si le code est faux ou expiré)
create or replace function public.use_transfer(p_code text)
returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  me  uuid := auth.uid();
  c   text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  n   int;
  res text;
begin
  if me is null then raise exception 'Connecte-toi pour utiliser un code' using errcode = '28000'; end if;
  select count(*) into n from public.transfer_tries t where t.user_id = me and t.at > now() - interval '1 hour';
  if n >= 20 then raise exception 'Trop de codes faux : réessaie dans une heure' using errcode = 'P0001'; end if;
  select t.payload into res from public.transfers t where t.code = c and t.expires_at > now();
  if res is null then
    insert into public.transfer_tries (user_id) values (me);
    delete from public.transfer_tries t where t.at < now() - interval '1 day';
  end if;
  return res;
end $$;

revoke all on function public.create_transfer(text) from public, anon;
grant execute on function public.create_transfer(text) to authenticated;
revoke all on function public.use_transfer(text) from public, anon;
grant execute on function public.use_transfer(text) to authenticated;

-- Security Advisor : deux nouveaux avertissements « Signed-In Users Can Execute SECURITY DEFINER Function »
-- (create_transfer, use_transfer) sont voulus, comme pour get_share : ces fonctions ne donnent accès qu'à un code exact.
-- « RLS Enabled No Policy » sur transfers et transfer_tries est voulu aussi : personne ne lit ces tables directement.
