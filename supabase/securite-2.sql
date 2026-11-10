-- Fiitday · correctifs du Security Advisor de Supabase (V1.36)
-- À exécuter une fois dans Supabase › SQL Editor (rôle « postgres »), puis cliquer sur « Refresh » dans le Security Advisor.
-- Sans risque : à relancer autant de fois que nécessaire.

-- 1. « Public Can Execute SECURITY DEFINER Function » sur get_share :
--    l'import d'une séance partagée se fait toujours une fois connecté (l'appli affiche d'abord la connexion),
--    donc les visiteurs non connectés (rôle anon) n'ont plus le droit d'appeler cette fonction.
revoke execute on function public.get_share(text) from public, anon;
grant execute on function public.get_share(text) to authenticated;

-- 2. delete_my_account : réservée aux personnes connectées (rappel, au cas où un ancien script l'aurait rouverte)
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Les deux avertissements « Signed-In Users Can Execute SECURITY DEFINER Function » restants sont voulus :
--   * get_share ne renvoie qu'UNE séance partagée, à partir de son code exact (impossible de lister les partages) ;
--   * delete_my_account ne supprime que le compte de la personne qui l'appelle (auth.uid()).
-- Ces deux fonctions ont besoin de droits élevés pour faire leur travail ; elles restent protégées par leur propre code.
