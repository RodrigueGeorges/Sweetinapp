-- v4 : paliers et sauvetage des séries, Sweet Hour sur l'écran verrouillé (Live Activity iOS).

-- ---------- paliers de série (7, 30, 100, 365 jours) ----------
-- dernier palier déjà fêté, pour ne prévenir qu'une fois
alter table public.streaks add column if not exists celebrated integer not null default 0;

-- ---------- sauvetage : une série perdue hier peut être rallumée, une fois par mois et par personne ----------
create table if not exists public.streak_saves (
  user_id uuid primary key references public.profiles on delete cascade,
  saved_at timestamptz not null default now()
);
alter table public.streak_saves enable row level security;
-- aucune politique : seules les fonctions ci-dessous y touchent

-- séries de 3 jours ou plus qui se sont éteintes hier soir (aucun jour commun hier), et si je peux encore en sauver une
create or replace function public.my_lost_streaks() returns table (friend_id uuid, days integer, can_save boolean)
language sql stable security definer set search_path = '' as $$
  select case when s.user_a = auth.uid() then s.user_b else s.user_a end,
         s.days,
         not exists (select 1 from public.streak_saves v where v.user_id = auth.uid() and v.saved_at > now() - interval '30 days')
    from public.streaks s
   where auth.uid() in (s.user_a, s.user_b) and s.days >= 3 and s.last_day = public.paris_today() - 2;
$$;
grant execute on function public.my_lost_streaks() to authenticated;

-- rallume : la série redevient « à entretenir aujourd'hui », comme si hier avait compté
create or replace function public.restore_streak(p_friend uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  a uuid := least(me, p_friend);
  b uuid := greatest(me, p_friend);
  s public.streaks;
begin
  if me is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into s from public.streaks where user_a = a and user_b = b for update;
  if not found or s.days < 3 or s.last_day is distinct from public.paris_today() - 2 then raise exception 'SAVE_TOO_LATE'; end if;
  if exists (select 1 from public.streak_saves v where v.user_id = me and v.saved_at > now() - interval '30 days') then
    raise exception 'SAVE_USED';
  end if;
  update public.streaks set last_day = public.paris_today() - 1 where user_a = a and user_b = b;
  insert into public.streak_saves (user_id, saved_at) values (me, now())
    on conflict (user_id) do update set saved_at = excluded.saved_at;
  return s.days;
end $$;
grant execute on function public.restore_streak(uuid) to authenticated;

-- ---------- Live Activity iOS : jetons « push-to-start » ----------
-- Un jeton par appareil iOS 17.2+, qui permet d'afficher le compte à rebours du Sweet Hour sur l'écran verrouillé.
-- expo_token relie l'appareil à son jeton push habituel, pour ne pas le notifier deux fois.
create table if not exists public.live_tokens (
  token text primary key,
  user_id uuid not null references public.profiles on delete cascade,
  expo_token text,
  lang text not null default 'fr' check (lang in ('fr', 'en')),
  updated_at timestamptz not null default now()
);
alter table public.live_tokens enable row level security;
create policy "live : lecture perso" on public.live_tokens for select to authenticated using (user_id = auth.uid());
create policy "live : écriture perso" on public.live_tokens for insert to authenticated with check (user_id = auth.uid());
create policy "live : mise à jour perso" on public.live_tokens for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "live : suppression perso" on public.live_tokens for delete to authenticated using (user_id = auth.uid());
