-- Sweetin · v2 : profil complété (âge minimum), captures d'écran, Sweet Hour, anti-spam

-- ---------- profil complété après l'inscription ----------
alter table public.profiles add column onboarded boolean not null default false;

-- données privées, jamais lisibles depuis l'app (aucune policy)
create table public.profile_private (
  id uuid primary key references public.profiles on delete cascade,
  birth_date date not null,
  age_blocked boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.profile_private enable row level security;

-- âge minimum pour utiliser Sweetin (messagerie privée entre utilisateurs)
create function public.min_age() returns int language sql immutable as $$ select 16 $$;

/**
 * Finalise le profil : pseudo + date de naissance.
 * La première date donnée est conservée : on ne peut pas réessayer avec une autre.
 * Un refus pour âge doit survivre à l'appel : il n'est donc pas levé en exception (ce qui annulerait l'écriture)
 * mais renvoyé dans le résultat, { "error": "UNDERAGE" }.
 * Erreurs levées : NOT_AUTHENTICATED, USERNAME_INVALID, USERNAME_TAKEN, AGE_INVALID.
 * Résultat : { "profile": {...} } ou { "error": "UNDERAGE" }.
 */
create function public.complete_profile(p_username text, p_birth_date date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  name text := lower(trim(p_username));
  birth date;
  blocked boolean;
  result public.profiles;
begin
  if me is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  if exists (select 1 from public.profile_private where id = me and age_blocked) then
    return jsonb_build_object('error', 'UNDERAGE');
  end if;

  if name !~ '^[a-z0-9_.]{3,20}$' then raise exception 'USERNAME_INVALID' using errcode = 'P0001'; end if;
  if exists (select 1 from public.profiles where username = name::extensions.citext and id <> me) then
    raise exception 'USERNAME_TAKEN' using errcode = 'P0001';
  end if;
  if p_birth_date is null or p_birth_date > current_date or p_birth_date < date '1900-01-01' then
    raise exception 'AGE_INVALID' using errcode = 'P0001';
  end if;

  -- la première date enregistrée fait foi
  select coalesce((select birth_date from public.profile_private where id = me), p_birth_date) into birth;
  blocked := extract(year from age(current_date, birth))::int < public.min_age();

  insert into public.profile_private (id, birth_date, age_blocked) values (me, birth, blocked)
  on conflict (id) do update set age_blocked = excluded.age_blocked, updated_at = now();

  if blocked then return jsonb_build_object('error', 'UNDERAGE'); end if;

  update public.profiles set username = name, onboarded = true where id = me returning * into result;
  return jsonb_build_object('profile', to_jsonb(result));
end $$;
grant execute on function public.complete_profile(text, date) to authenticated;

-- on ne peut ajouter que des profils finalisés
create or replace function public.add_friend(p_username text) returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare target public.profiles;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and onboarded) then
    raise exception 'PROFILE_INCOMPLETE' using errcode = 'P0001';
  end if;
  select * into target from public.profiles where username = lower(ltrim(trim(p_username), '@'))::extensions.citext and onboarded;
  if target.id is null then raise exception 'USER_NOT_FOUND' using errcode = 'P0002'; end if;
  if target.id = auth.uid() then raise exception 'SELF' using errcode = '22023'; end if;
  if exists (select 1 from public.blocks where blocker_id = target.id and blocked_id = auth.uid()) then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;
  insert into public.friendships (user_id, friend_id) values (auth.uid(), target.id), (target.id, auth.uid())
  on conflict do nothing;
  return target;
end $$;

-- ---------- captures d'écran ----------
alter table public.flip_recipients add column screenshot_at timestamptz;

-- ---------- Sweet Hour : un moment surprise par jour ----------
create table public.sweet_hours (
  day date primary key,
  starts_at timestamptz not null,
  notified boolean not null default false
);
alter table public.sweet_hours enable row level security;

alter table public.flips add column sweet_hour boolean not null default false;

-- tire au hasard l'heure du jour, entre 10 h et 21 h (heure de Paris)
create function public.pick_sweet_hour(p_day date default (now() at time zone 'Europe/Paris')::date) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare t timestamptz;
begin
  t := (p_day::timestamp + time '10:00' + (random() * interval '11 hours')) at time zone 'Europe/Paris';
  insert into public.sweet_hours (day, starts_at) values (p_day, date_trunc('minute', t)) on conflict (day) do nothing;
  select starts_at into t from public.sweet_hours where day = p_day;
  return t;
end $$;
revoke execute on function public.pick_sweet_hour(date) from public, anon, authenticated;

-- l'app ne voit l'heure du jour qu'une fois qu'elle a commencé
create function public.current_sweet_hour() returns table (starts_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select s.starts_at, s.starts_at + interval '2 minutes'
  from public.sweet_hours s
  where s.day = (now() at time zone 'Europe/Paris')::date and s.starts_at <= now()
$$;
grant execute on function public.current_sweet_hour() to authenticated;
