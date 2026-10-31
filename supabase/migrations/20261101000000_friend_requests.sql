-- Sweetin · consentement entre amis : ajouter un pseudo envoie une demande,
-- l'amitié ne se crée que lorsqu'elle est acceptée (ou via une invitation explicite).

create table public.friend_requests (
  from_user uuid not null references public.profiles on delete cascade,
  to_user uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (from_user, to_user)
);
alter table public.friend_requests enable row level security;
create policy "friend_requests_read" on public.friend_requests for select to authenticated using (auth.uid() in (from_user, to_user));
create policy "friend_requests_send" on public.friend_requests for insert to authenticated with check (auth.uid() = from_user);
create policy "friend_requests_delete" on public.friend_requests for delete to authenticated using (auth.uid() in (from_user, to_user));

-- cherche le profil visé par un pseudo, avec les mêmes garde-fous qu'add_friend
create function public._friend_target(p_username text) returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare target public.profiles;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and onboarded) then
    raise exception 'PROFILE_INCOMPLETE' using errcode = 'P0001';
  end if;
  select * into target from public.profiles where username = lower(ltrim(trim(p_username), '@'))::extensions.citext and onboarded;
  if target.id is null then raise exception 'USER_NOT_FOUND' using errcode = 'P0002'; end if;
  if target.id = auth.uid() then raise exception 'SELF' using errcode = '22023'; end if;
  -- bloqué dans un sens ou dans l'autre : le profil n'existe pas pour nous
  if exists (select 1 from public.blocks where (blocker_id = target.id and blocked_id = auth.uid()) or (blocker_id = auth.uid() and blocked_id = target.id)) then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;
  return target;
end $$;
revoke execute on function public._friend_target(text) from public, anon, authenticated;

/**
 * Demande d'ami par pseudo. Ne crée jamais d'amitié unilatérale :
 *   - déjà amis                          → { "status": "friends" }
 *   - l'autre nous a déjà demandé        → acceptation mutuelle, { "status": "friends" }
 *   - sinon                              → demande en attente,  { "status": "sent" }
 * Résultat : { "profile": {...}, "status": "friends" | "sent" }
 */
create function public.request_friend(p_username text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  target public.profiles := public._friend_target(p_username);
begin
  if exists (select 1 from public.friendships where user_id = auth.uid() and friend_id = target.id) then
    return jsonb_build_object('profile', to_jsonb(target), 'status', 'friends');
  end if;

  -- l'autre nous attendait déjà : consentement mutuel, amitié créée
  if exists (select 1 from public.friend_requests where from_user = target.id and to_user = auth.uid()) then
    insert into public.friendships (user_id, friend_id) values (auth.uid(), target.id), (target.id, auth.uid())
    on conflict do nothing;
    delete from public.friend_requests where (from_user = target.id and to_user = auth.uid()) or (from_user = auth.uid() and to_user = target.id);
    return jsonb_build_object('profile', to_jsonb(target), 'status', 'friends');
  end if;

  insert into public.friend_requests (from_user, to_user) values (auth.uid(), target.id)
  on conflict do nothing;
  return jsonb_build_object('profile', to_jsonb(target), 'status', 'sent');
end $$;
grant execute on function public.request_friend(text) to authenticated;

-- demandes entrantes et sortantes, avec le profil de l'autre côté
create function public.list_friend_requests() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'incoming', coalesce((
      select jsonb_agg(to_jsonb(p) order by r.created_at desc)
      from public.friend_requests r join public.profiles p on p.id = r.from_user
      where r.to_user = auth.uid()
    ), '[]'::jsonb),
    'outgoing', coalesce((
      select jsonb_agg(to_jsonb(p) order by r.created_at desc)
      from public.friend_requests r join public.profiles p on p.id = r.to_user
      where r.from_user = auth.uid()
    ), '[]'::jsonb)
  )
$$;
grant execute on function public.list_friend_requests() to authenticated;

-- accepter une demande reçue : amitié réciproque, demandes purgées dans les deux sens
create function public.accept_friend(p_user uuid) returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare target public.profiles;
begin
  if not exists (select 1 from public.friend_requests where from_user = p_user and to_user = auth.uid()) then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;
  insert into public.friendships (user_id, friend_id) values (auth.uid(), p_user), (p_user, auth.uid())
  on conflict do nothing;
  delete from public.friend_requests where (from_user = p_user and to_user = auth.uid()) or (from_user = auth.uid() and to_user = p_user);
  select * into target from public.profiles where id = p_user;
  return target;
end $$;
grant execute on function public.accept_friend(uuid) to authenticated;

-- ignorer une demande reçue, ou annuler une demande envoyée
create function public.decline_friend(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.friend_requests where (from_user = p_user and to_user = auth.uid()) or (from_user = auth.uid() and to_user = p_user);
end $$;
grant execute on function public.decline_friend(uuid) to authenticated;

-- rétrocompatibilité : l'ancien nom d'appel devient une demande (profil renvoyé comme avant)
create or replace function public.add_friend(p_username text) returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  result := public.request_friend(p_username);
  return (result->'profile')::public.profiles;
end $$;
