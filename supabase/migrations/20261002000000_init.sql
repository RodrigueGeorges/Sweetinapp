-- Sweetin · schéma initial
-- Principe : la photo et le message ne sont lisibles que par le destinataire, via une fonction serveur.
-- Après grattage (ou expiration), la photo et le message sont supprimés. Seule la "trace" reste.

create extension if not exists citext with schema extensions;

-- ---------- profils ----------
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username extensions.citext unique not null check (username ~ '^[a-z0-9_.]{3,20}$'),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles lisibles par les connectés" on public.profiles for select to authenticated using (true);
create policy "chacun modifie son profil" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- crée le profil à l'inscription à partir du pseudo passé en metadata
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, username)
  values (new.id, lower(coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8))));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- disponibilité d'un pseudo, appelable avant inscription
create function public.username_available(p_username text) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.profiles where username = lower(p_username)::extensions.citext);
$$;
grant execute on function public.username_available(text) to anon, authenticated;

-- ---------- jetons de notification ----------
create table public.push_tokens (
  user_id uuid primary key references auth.users on delete cascade,
  token text not null,
  platform text,
  updated_at timestamptz not null default now()
);
alter table public.push_tokens enable row level security;
create policy "jeton : lecture perso" on public.push_tokens for select to authenticated using (user_id = auth.uid());
create policy "jeton : écriture perso" on public.push_tokens for insert to authenticated with check (user_id = auth.uid());
create policy "jeton : mise à jour perso" on public.push_tokens for update to authenticated using (user_id = auth.uid());
create policy "jeton : suppression perso" on public.push_tokens for delete to authenticated using (user_id = auth.uid());

-- ---------- amis et blocages ----------
create table public.friendships (
  user_id uuid not null references public.profiles on delete cascade,
  friend_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);
alter table public.friendships enable row level security;
create policy "mes amis" on public.friendships for select to authenticated using (user_id = auth.uid());

create table public.blocks (
  blocker_id uuid not null references public.profiles on delete cascade,
  blocked_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
alter table public.blocks enable row level security;
create policy "mes blocages" on public.blocks for select to authenticated using (blocker_id = auth.uid());

create function public.add_friend(p_username text) returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare target public.profiles;
begin
  select * into target from public.profiles where username = lower(p_username)::extensions.citext;
  if target.id is null then raise exception 'Pseudo introuvable' using errcode = 'P0002'; end if;
  if target.id = auth.uid() then raise exception 'C''est toi' using errcode = '22023'; end if;
  if exists (select 1 from public.blocks where blocker_id = target.id and blocked_id = auth.uid()) then
    raise exception 'Pseudo introuvable' using errcode = 'P0002';
  end if;
  insert into public.friendships (user_id, friend_id) values (auth.uid(), target.id), (target.id, auth.uid())
  on conflict do nothing;
  return target;
end $$;

create function public.remove_friend(p_friend uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.friendships
  where (user_id = auth.uid() and friend_id = p_friend) or (user_id = p_friend and friend_id = auth.uid());
$$;

create function public.block_user(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), p_user) on conflict do nothing;
  delete from public.friendships
  where (user_id = auth.uid() and friend_id = p_user) or (user_id = p_user and friend_id = auth.uid());
end $$;

-- ---------- flips ----------
create table public.flips (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles on delete cascade,
  photo_path text,                       -- vidé quand la photo est supprimée
  mode text not null default 'free' check (mode in ('free', 'once')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days'
);
alter table public.flips enable row level security;

-- le message n'est JAMAIS lisible côté client : aucune policy, seul le service role y accède
create table public.flip_secrets (
  flip_id uuid primary key references public.flips on delete cascade,
  message text not null check (char_length(message) between 1 and 90)
);
alter table public.flip_secrets enable row level security;

create table public.flip_recipients (
  flip_id uuid not null references public.flips on delete cascade,
  recipient_id uuid not null references public.profiles on delete cascade,
  opened_at timestamptz,
  scratched_at timestamptz,
  percent smallint check (percent between 0 and 100),
  duration_ms integer,
  reaction text check (char_length(reaction) <= 8),
  primary key (flip_id, recipient_id)
);
alter table public.flip_recipients enable row level security;
create index on public.flip_recipients (recipient_id, scratched_at);

-- fonctions "security definer" pour éviter la récursion entre les deux policies
create function public.is_flip_recipient(p_flip uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.flip_recipients where flip_id = p_flip and recipient_id = auth.uid());
$$;
create function public.is_flip_sender(p_flip uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.flips where id = p_flip and sender_id = auth.uid());
$$;

create policy "flip : expéditeur ou destinataire" on public.flips for select to authenticated
  using (sender_id = auth.uid() or public.is_flip_recipient(id));
create policy "réception : destinataire ou expéditeur" on public.flip_recipients for select to authenticated
  using (recipient_id = auth.uid() or public.is_flip_sender(flip_id));

-- ---------- signalements ----------
create table public.reports (
  id bigint generated always as identity primary key,
  reporter_id uuid not null references public.profiles on delete cascade,
  reported_id uuid references public.profiles on delete set null,
  flip_id uuid references public.flips on delete set null,
  reason text not null check (char_length(reason) <= 200),
  kept_message text,                      -- copie du message conservée pour modération
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;

-- ---------- stockage ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('flips', 'flips', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

-- chacun ne peut déposer que dans son dossier ; personne ne peut lire en direct (URL signée via fonction)
create policy "dépôt dans son dossier" on storage.objects for insert to authenticated
  with check (bucket_id = 'flips' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- temps réel pour la boîte de réception ----------
alter publication supabase_realtime add table public.flip_recipients;
