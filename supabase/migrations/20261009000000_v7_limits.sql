-- Sweetin · v7 : limites de débit uniformes, reçus de push Expo, index manquants
--
-- 1) rate_limits / rate_hit : compteur atomique par acteur (uuid ou empreinte d'IP) et par fenêtre,
--    utilisé par les fonctions Edge (send-flip, open-flip, open-link) et les RPC sensibles.
-- 2) push_receipts : un reçu Expo est disponible ~15 min après le ticket ; le cron cleanup le vérifie
--    et supprime les appareils désinstallés (DeviceNotRegistered n'apparaît pas toujours dans le ticket).
-- 3) index : un par filtre fréquent (voir requêtes dans api.ts et les fonctions Edge).
-- 4) register_push_token : format exact du jeton Expo et plateforme contrôlée.

-- ---------- limites de débit ----------
create table public.rate_limits (
  actor text not null,
  action text not null,
  window_start timestamptz not null,
  count integer not null,
  primary key (actor, action, window_start)
);
alter table public.rate_limits enable row level security;
-- aucune policy : la table n'est accessible que via les fonctions ci-dessous (service)
revoke all on public.rate_limits from anon, authenticated;

create index on public.rate_limits (window_start);

-- Incrémente le compteur de l'acteur dans sa fenêtre ; renvoie false si la limite est dépassée.
-- Fenêtres alignées sur l'epoch : la remise à zéro est automatique, pas de job à prévoir.
create function public.rate_hit(p_actor text, p_action text, p_limit integer, p_window integer)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_start timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window) * p_window);
  v_count integer;
begin
  insert into public.rate_limits (actor, action, window_start, count)
  values (left(p_actor, 128), p_action, v_start, 1)
  on conflict (actor, action, window_start)
  do update set count = public.rate_limits.count + 1
  returning count into v_count;
  return v_count <= p_limit;
end $$;
revoke execute on function public.rate_hit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_hit(text, text, integer, integer) to service_role;

-- invitations : un compte ne peut pas en accepter des centaines (énumération de pseudos)
create or replace function public.accept_invite(p_username text, p_source text default 'link') returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare target public.profiles;
begin
  if not public.rate_hit(auth.uid()::text, 'accept_invite', 30, 3600) then
    raise exception 'RATE_LIMIT' using errcode = 'P0001';
  end if;
  target := public.add_friend(p_username);
  if exists (select 1 from public.profiles where id = auth.uid() and created_at > now() - interval '7 days') then
    insert into public.referrals (user_id, invited_by, source)
    values (auth.uid(), target.id, case when p_source in ('link', 'flip', 'story', 'qr', 'contacts', 'username') then p_source else 'link' end)
    on conflict (user_id) do nothing;
  end if;
  return target;
end $$;

-- ---------- reçus de notification Expo ----------
create table public.push_receipts (
  ticket_id text primary key,
  token text not null,
  created_at timestamptz not null default now(),
  checked_at timestamptz
);
alter table public.push_receipts enable row level security;
revoke all on public.push_receipts from anon, authenticated;
create index on public.push_receipts (created_at) where checked_at is null;

-- ---------- index audités ----------
-- sendPush filtre push_tokens par user_id à chaque envoi (la clé primaire est sur token depuis v6)
create index if not exists push_tokens_user_id_idx on public.push_tokens (user_id);
-- send-flip et add_friend testent « qui m'a bloqué » par blocked_id
create index if not exists blocks_blocked_id_idx on public.blocks (blocked_id);
-- my_streaks lit user_a = moi OR user_b = moi (le OR ne réutilise pas le préfixe de la PK)
create index if not exists streaks_user_b_idx on public.streaks (user_b);
-- cleanup horaire : flips expirés avec contenu à détruire
create index if not exists flips_expires_idx on public.flips (expires_at) where photo_path is not null;
-- cleanup des traces (90 j) et quota « flips du jour » dans send-flip
create index if not exists flips_created_idx on public.flips (created_at) where photo_path is null;
create index if not exists flips_sender_created_idx on public.flips (sender_id, created_at);
-- purge des signalements à 12 mois
create index if not exists reports_created_idx on public.reports (created_at);
-- sweet-hour lit les jetons de live par page entière, upserté par token : rien à ajouter.

-- ---------- validation stricte du jeton Expo ----------
create or replace function public.register_push_token(p_token text, p_platform text, p_lang text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  if p_token !~ '^ExponentPushToken\[[-A-Za-z0-9_]{8,}\]$' then raise exception 'TOKEN_INVALID' using errcode = 'P0001'; end if;
  if p_platform not in ('ios', 'android') then raise exception 'PLATFORM_INVALID' using errcode = 'P0001'; end if;
  insert into public.push_tokens (user_id, token, platform, lang, updated_at)
  values (auth.uid(), p_token, p_platform, case when p_lang = 'en' then 'en' else 'fr' end, now())
  on conflict (token) do update
    set user_id = auth.uid(), platform = excluded.platform, lang = excluded.lang, updated_at = now();
end $$;
