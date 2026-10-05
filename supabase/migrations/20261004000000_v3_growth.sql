-- Sweetin · v3 : croissance
-- flips par lien (privé ou story), aperçu flouté, séries, contacts, parrainage, mesures.

create extension if not exists pgcrypto with schema extensions;

-- ---------- correctif de sécurité ----------
-- La policy de mise à jour du profil laissait un utilisateur passer `onboarded` à true lui-même,
-- donc contourner l'âge minimum. Plus aucune colonne n'est modifiable directement : tout passe par des fonctions.
drop policy if exists "chacun modifie son profil" on public.profiles;
revoke update on public.profiles from anon, authenticated;

-- ---------- aperçu minuscule et flou (vignette de la boîte, widget) ----------
-- JPEG en base64 d'environ 24 px de large, effacé avec la photo.
alter table public.flips add column preview text check (preview is null or char_length(preview) <= 6000);

-- ---------- flips par lien ----------
-- single : un lien privé, ouvrable une seule fois, par quelqu'un qui n'a pas forcément l'app.
-- story  : un lien public pendant 24 h (« gratte mon secret » en story), ouvrable par tous.
create table public.flip_links (
  token text primary key check (char_length(token) between 16 and 64),
  flip_id uuid not null references public.flips on delete cascade,
  kind text not null check (kind in ('single', 'story')),
  opened_at timestamptz,
  scratched_at timestamptz,
  percent smallint check (percent between 0 and 100),
  duration_ms integer,
  opens integer not null default 0,
  scratches integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.flip_links enable row level security;
create index on public.flip_links (flip_id);
create policy "lien : visible par l'expéditeur" on public.flip_links for select to authenticated using (public.is_flip_sender(flip_id));

-- ouverture ou grattage d'une story : compteur atomique (fonctions serveur seulement)
create function public.bump_story(p_token text, p_scratch boolean) returns integer
language sql security definer set search_path = '' as $$
  update public.flip_links
     set opens = opens + case when p_scratch then 0 else 1 end,
         scratches = scratches + case when p_scratch then 1 else 0 end
   where token = p_token and kind = 'story'
  returning case when p_scratch then scratches else opens end;
$$;
revoke execute on function public.bump_story(text, boolean) from public, anon, authenticated;

-- le contenu d'un flip peut-il être effacé ? (tous les destinataires ont gratté, plus de lien en attente)
create function public.flip_consumed(p_flip uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.flip_recipients where flip_id = p_flip and scratched_at is null)
     and not exists (select 1 from public.flip_links where flip_id = p_flip and kind = 'story')
     and not exists (
       select 1 from public.flip_links
        where flip_id = p_flip and kind = 'single' and scratched_at is null
          and (opened_at is null or opened_at > now() - interval '10 minutes'));
$$;
revoke execute on function public.flip_consumed(uuid) from public, anon, authenticated;

create function public.consumed_flips(p_limit integer default 500) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select f.id from public.flips f
   where f.photo_path is not null and public.flip_consumed(f.id)
     and (exists (select 1 from public.flip_recipients r where r.flip_id = f.id)
          or exists (select 1 from public.flip_links l where l.flip_id = f.id))
   limit p_limit;
$$;
revoke execute on function public.consumed_flips(integer) from public, anon, authenticated;

-- ---------- séries (« Sweet streak ») ----------
-- Un jour compte quand les deux amis se sont envoyé au moins un flip ce jour-là (heure de Paris).
create table public.streaks (
  user_a uuid not null references public.profiles on delete cascade,
  user_b uuid not null references public.profiles on delete cascade,
  days integer not null default 0,
  last_day date,
  a_sent date,
  b_sent date,
  primary key (user_a, user_b),
  check (user_a < user_b)
);
alter table public.streaks enable row level security;
create policy "séries : les deux amis" on public.streaks for select to authenticated using (auth.uid() in (user_a, user_b));

create function public.paris_today() returns date language sql stable as $$ select (now() at time zone 'Europe/Paris')::date $$;

create function public.record_streak(p_sender uuid, p_recipient uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  a uuid := least(p_sender, p_recipient);
  b uuid := greatest(p_sender, p_recipient);
  today date := public.paris_today();
  s public.streaks;
begin
  insert into public.streaks (user_a, user_b) values (a, b) on conflict do nothing;
  select * into s from public.streaks where user_a = a and user_b = b for update;
  if p_sender = a then s.a_sent := today; else s.b_sent := today; end if;
  if s.a_sent = today and s.b_sent = today and s.last_day is distinct from today then
    s.days := case when s.last_day = today - 1 then s.days + 1 else 1 end;
    s.last_day := today;
  end if;
  update public.streaks set days = s.days, last_day = s.last_day, a_sent = s.a_sent, b_sent = s.b_sent
   where user_a = a and user_b = b;
  return s.days;
end $$;
revoke execute on function public.record_streak(uuid, uuid) from public, anon, authenticated;

-- mes séries en cours ; at_risk = pas encore entretenue aujourd'hui, s'éteint à minuit
create function public.my_streaks() returns table (friend_id uuid, days integer, at_risk boolean)
language sql stable security definer set search_path = '' as $$
  select case when s.user_a = auth.uid() then s.user_b else s.user_a end, s.days, s.last_day < public.paris_today()
    from public.streaks s
   where auth.uid() in (s.user_a, s.user_b) and s.days > 0 and s.last_day >= public.paris_today() - 1;
$$;
grant execute on function public.my_streaks() to authenticated;

-- ---------- retrouver ses amis par le carnet d'adresses ----------
-- Seuls les numéros VÉRIFIÉS (code SMS) sont indexés, sous forme d'empreinte SHA-256 des chiffres.
-- L'app envoie les empreintes de ses contacts ; rien n'est conservé de cet envoi.
create table public.phone_index (
  user_id uuid primary key references auth.users on delete cascade,
  phone_hash text not null
);
alter table public.phone_index enable row level security;
create index on public.phone_index (phone_hash);

create function public.sync_phone_index() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(new.phone, '') <> '' and new.phone_confirmed_at is not null then
    insert into public.phone_index (user_id, phone_hash)
    values (new.id, encode(extensions.digest(regexp_replace(new.phone, '\D', '', 'g'), 'sha256'), 'hex'))
    on conflict (user_id) do update set phone_hash = excluded.phone_hash;
  else
    delete from public.phone_index where user_id = new.id;
  end if;
  return new;
end $$;
create trigger on_auth_phone after insert or update of phone, phone_confirmed_at on auth.users
  for each row execute function public.sync_phone_index();

-- préférences privées : être trouvable par son numéro (oui par défaut)
alter table public.profile_private add column discoverable boolean not null default true;

create function public.set_discoverable(p_on boolean) returns void
language sql security definer set search_path = '' as $$
  update public.profile_private set discoverable = p_on where id = auth.uid();
$$;
grant execute on function public.set_discoverable(boolean) to authenticated;

create function public.my_settings() returns table (discoverable boolean, has_phone boolean)
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.discoverable from public.profile_private p where p.id = auth.uid()), true),
         exists (select 1 from public.phone_index i where i.user_id = auth.uid());
$$;
grant execute on function public.my_settings() to authenticated;

-- limite anti-aspiration : 20 recherches par jour, 2 000 numéros par recherche
create table public.contact_lookups (
  user_id uuid not null references auth.users on delete cascade,
  day date not null,
  calls integer not null default 0,
  primary key (user_id, day)
);
alter table public.contact_lookups enable row level security;

create function public.match_contacts(p_hashes text[]) returns table (id uuid, username text)
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
  select p.id, p.username::text
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

-- ---------- parrainage ----------
-- qui a fait venir qui (jamais visible par les autres utilisateurs) : sert à mesurer la viralité
create table public.referrals (
  user_id uuid primary key references public.profiles on delete cascade,
  invited_by uuid references public.profiles on delete set null,
  source text check (source in ('link', 'flip', 'story', 'qr', 'contacts', 'username')),
  created_at timestamptz not null default now()
);
alter table public.referrals enable row level security;

-- ajoute l'ami de l'invitation ; si le compte a moins de 7 jours, l'invitation est comptée comme parrainage
create function public.accept_invite(p_username text, p_source text default 'link') returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare target public.profiles;
begin
  target := public.add_friend(p_username);
  if exists (select 1 from public.profiles where id = auth.uid() and created_at > now() - interval '7 days') then
    insert into public.referrals (user_id, invited_by, source)
    values (auth.uid(), target.id, case when p_source in ('link', 'flip', 'story', 'qr', 'contacts', 'username') then p_source else 'link' end)
    on conflict (user_id) do nothing;
  end if;
  return target;
end $$;
grant execute on function public.accept_invite(text, text) to authenticated;

-- ---------- tableau de bord de croissance (SQL editor seulement, jamais exposé à l'app) ----------
create view public.admin_growth as
with d as (
  select generate_series(public.paris_today() - 29, public.paris_today(), interval '1 day')::date as day
)
select
  d.day,
  (select count(*) from public.profiles p where (p.created_at at time zone 'Europe/Paris')::date = d.day) as signups,
  (select count(*) from public.referrals r where (r.created_at at time zone 'Europe/Paris')::date = d.day) as invited_signups,
  (select count(distinct f.sender_id) from public.flips f where (f.created_at at time zone 'Europe/Paris')::date = d.day) as active_senders,
  (select count(*) from public.flips f where (f.created_at at time zone 'Europe/Paris')::date = d.day) as flips,
  (select count(*) from public.flip_links l where l.kind = 'single' and (l.created_at at time zone 'Europe/Paris')::date = d.day) as private_links,
  (select count(*) from public.flip_links l where l.kind = 'single' and l.opened_at is not null and (l.created_at at time zone 'Europe/Paris')::date = d.day) as private_links_opened,
  (select count(*) from public.flip_links l where l.kind = 'story' and (l.created_at at time zone 'Europe/Paris')::date = d.day) as stories,
  (select coalesce(sum(l.opens), 0) from public.flip_links l where l.kind = 'story' and (l.created_at at time zone 'Europe/Paris')::date = d.day) as story_opens,
  round(
    (select count(*) from public.referrals r where (r.created_at at time zone 'Europe/Paris')::date = d.day)::numeric
    / nullif((select count(distinct f.sender_id) from public.flips f where (f.created_at at time zone 'Europe/Paris')::date = d.day), 0), 3
  ) as k_factor
from d
order by d.day desc;
revoke all on public.admin_growth from anon, authenticated;
