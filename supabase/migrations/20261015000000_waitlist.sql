-- Liste d'attente iPhone : pendant le lancement Android seul, les amis sur iPhone qui ouvrent un lien sweetin
-- (lecture /f/ ou invitation /u/) laissent leur email pour être prévenus de la sortie iOS.
create table if not exists public.waitlist (
  email text primary key check (char_length(email) between 5 and 254),
  platform text not null default 'ios' check (platform in ('ios', 'android', 'web')),
  src text check (src is null or char_length(src) <= 24),
  ref text check (ref is null or char_length(ref) <= 32), -- pseudo de l'ami qui a envoyé le lien
  lang text check (lang is null or lang in ('fr', 'en')),
  created_at timestamptz not null default now()
);
-- accès uniquement par la fonction « waitlist » (clé service) : aucune politique pour anon / authenticated
alter table public.waitlist enable row level security;
