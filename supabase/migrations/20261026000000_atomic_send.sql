create table public.send_receipts (
  sender_id uuid not null references public.profiles on delete cascade,
  request_id text not null check (char_length(request_id) between 1 and 200),
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (sender_id, request_id)
);
alter table public.send_receipts enable row level security;
revoke all on public.send_receipts from anon, authenticated;
grant all on public.send_receipts to service_role;

create function public.commit_flip(
  p_sender uuid, p_request text, p_path text, p_message text, p_mode text,
  p_recipients uuid[], p_link text, p_token text, p_preview text, p_style jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  previous jsonb;
  fid uuid;
  allowed uuid[];
  rid uuid;
  streak integer := 0;
  days integer;
  sweet boolean;
  result jsonb;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'NOT_AUTHORIZED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_sender::text, 0));
  select r.result into previous from public.send_receipts r where r.sender_id = p_sender and r.request_id = p_request;
  if found then return previous || jsonb_build_object('created', false); end if;
  if not exists (select 1 from public.profiles where id = p_sender and onboarded) then raise exception 'PROFILE_INCOMPLETE'; end if;
  if split_part(p_path, '/', 1) <> p_sender::text or p_path not like '%.jpg' then raise exception 'PHOTO_INVALID'; end if;
  if char_length(p_message) not between 1 and 90 then raise exception 'MESSAGE_LENGTH'; end if;
  if p_link is not null and p_link not in ('single', 'story') then raise exception 'NO_RECIPIENT'; end if;
  if (select count(*) from public.flips where sender_id = p_sender and created_at >= now() - interval '24 hours') >= 150 then raise exception 'RATE_LIMIT'; end if;
  select coalesce(array_agg(f.friend_id order by f.friend_id), '{}'::uuid[]) into allowed
    from public.friendships f
    where f.user_id = p_sender and f.friend_id = any(p_recipients)
      and exists (select 1 from public.friendships back where back.user_id = f.friend_id and back.friend_id = p_sender)
      and not exists (select 1 from public.blocks b where
        (b.blocker_id = p_sender and b.blocked_id = f.friend_id) or
        (b.blocked_id = p_sender and b.blocker_id = f.friend_id));
  if cardinality(allowed) <> cardinality(p_recipients) or (cardinality(allowed) = 0 and p_link is null) then raise exception 'NO_RECIPIENT'; end if;
  sweet := exists (select 1 from public.sweet_hours where starts_at <= now() and starts_at + interval '2 minutes' >= now());
  insert into public.flips(sender_id, photo_path, mode, sweet_hour, preview, expires_at)
    values (p_sender, p_path, p_mode, sweet, p_preview, now() + case when p_link = 'story' then interval '24 hours' else interval '7 days' end)
    returning id into fid;
  insert into public.flip_secrets(flip_id, message, word_style) values (fid, p_message, p_style);
  insert into public.flip_recipients(flip_id, recipient_id) select fid, unnest(allowed);
  if p_link is not null then
    insert into public.flip_links(token, flip_id, kind) values (p_token, fid, p_link);
  end if;
  foreach rid in array allowed loop
    days := public.record_streak(p_sender, rid);
    streak := greatest(streak, coalesce(days, 0));
  end loop;
  result := jsonb_build_object('id', fid, 'sent_to', cardinality(allowed), 'sweet_hour', sweet,
    'link', p_link, 'link_token', case when p_link is not null then p_token else null end,
    'streak', streak, 'recipients', to_jsonb(allowed));
  insert into public.send_receipts(sender_id, request_id, result) values (p_sender, p_request, result);
  return result || jsonb_build_object('created', true);
end $$;
revoke execute on function public.commit_flip(uuid,text,text,text,text,uuid[],text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.commit_flip(uuid,text,text,text,text,uuid[],text,text,text,jsonb) to service_role;
