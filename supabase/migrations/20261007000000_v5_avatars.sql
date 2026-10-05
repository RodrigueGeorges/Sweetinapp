-- v5 : photo de profil (selfie). URL aléatoire ; modérée puis rattachée au profil par la fonction serveur set-avatar.
alter table public.profiles add column if not exists avatar_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 524288, array['image/jpeg'])
on conflict (id) do nothing;

create policy "avatar : dépôt dans son dossier" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar : suppression dans son dossier" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- la photo est rattachée au profil par la fonction serveur set-avatar, après modération (jamais directement depuis l'app)
