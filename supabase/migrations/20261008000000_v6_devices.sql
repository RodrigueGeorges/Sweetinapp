-- Sweetin · v6 : plusieurs appareils par compte
-- La clé primaire était user_id : un second téléphone écrasait le jeton du premier.
-- Le jeton Expo identifie un appareil : la clé passe sur `token`, ainsi chaque appareil
-- est notifié, et si un autre compte se connecte sur le même appareil le jeton le suit.

alter table public.push_tokens drop constraint push_tokens_pkey;
alter table public.push_tokens add primary key (token);

-- La réassignation (un autre compte sur le même appareil) doit pouvoir changer user_id,
-- ce que la RLS interdit à un upsert direct : on passe par une fonction.
create function public.register_push_token(p_token text, p_platform text, p_lang text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  if char_length(p_token) not between 10 and 200 then raise exception 'TOKEN_INVALID' using errcode = 'P0001'; end if;
  insert into public.push_tokens (user_id, token, platform, lang, updated_at)
  values (auth.uid(), p_token, p_platform, case when p_lang = 'en' then 'en' else 'fr' end, now())
  on conflict (token) do update
    set user_id = auth.uid(), platform = excluded.platform, lang = excluded.lang, updated_at = now();
end $$;
grant execute on function public.register_push_token(text, text, text) to authenticated;

-- ---------- séries en un seul aller-retour ----------
-- Même logique que record_streak, appliquée à une liste (envoi groupé).
create function public.record_streaks(p_sender uuid, p_recipients uuid[])
returns table (recipient uuid, days integer)
language plpgsql security definer set search_path = '' as $$
declare
  r uuid;
  a uuid;
  b uuid;
  today date := public.paris_today();
  s public.streaks;
begin
  foreach r in array p_recipients loop
    a := least(p_sender, r);
    b := greatest(p_sender, r);
    insert into public.streaks (user_a, user_b) values (a, b) on conflict do nothing;
    select * into s from public.streaks where user_a = a and user_b = b for update;
    if p_sender = a then s.a_sent := today; else s.b_sent := today; end if;
    if s.a_sent = today and s.b_sent = today and s.last_day is distinct from today then
      s.days := case when s.last_day = today - 1 then s.days + 1 else 1 end;
      s.last_day := today;
    end if;
    update public.streaks set days = s.days, last_day = s.last_day, a_sent = s.a_sent, b_sent = s.b_sent
     where user_a = a and user_b = b;
    recipient := r;
    days := s.days;
    return next;
  end loop;
end $$;
revoke execute on function public.record_streaks(uuid, uuid[]) from public, anon, authenticated;
