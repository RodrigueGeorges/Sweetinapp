-- match_contacts : renvoie aussi avatar_path pour que les amis trouvés dans le carnet
-- d'adresses affichent leur vraie photo (la photo est déjà publique, chemin aléatoire).
drop function public.match_contacts(text[]);

create function public.match_contacts(p_hashes text[]) returns table (id uuid, username text, avatar_path text)
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  n integer;
begin
  if me is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  insert into public.contact_lookups (user_id, day, calls) values (me, current_date, 1)
  on conflict (user_id, day) do update set calls = public.contact_lookups.calls + 1
  returning calls into n;
  if n > 20 then raise exception 'RATE_LIMIT' using errcode = 'P0001'; end if;

  return query
  select p.id, p.username::text, p.avatar_path
    from public.phone_index i
    join public.profiles p on p.id = i.user_id
    left join public.profile_private pp on pp.id = p.id
   where i.phone_hash = any (p_hashes[1:2000])
     and p.onboarded and coalesce(pp.discoverable, true) and p.id <> me
     and not exists (select 1 from public.blocks b where (b.blocker_id = p.id and b.blocked_id = me) or (b.blocker_id = me and b.blocked_id = p.id))
     and not exists (select 1 from public.friendships f where f.user_id = me and f.friend_id = p.id)
   order by p.username
   limit 200;
end $$;
grant execute on function public.match_contacts(text[]) to authenticated;
