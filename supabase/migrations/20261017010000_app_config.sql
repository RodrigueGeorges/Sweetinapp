-- Réglages de l'app modifiables à distance, sans nouvelle version (lus par l'app au démarrage).
create table if not exists public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_config enable row level security;
-- lecture pour tout le monde (rien de sensible), écriture réservée au tableau de bord Supabase (service role)
drop policy if exists "app_config lisible" on public.app_config;
create policy "app_config lisible" on public.app_config for select using (true);

-- Durée de lecture avant la fonte, en test A/B.
--   a : la règle actuelle (10 s pour tous les mots)
--   b : selon la longueur du mot, de min (mot court, 12 caractères ou moins) à max (90 caractères)
--   split : part des comptes dans le groupe b (0 = test arrêté, tout le monde en a ; 0.5 = moitié-moitié ; 1 = tout le monde en b)
insert into public.app_config (key, value) values
  ('melt', '{"test": "melt_v1", "split": 0, "a": {"min": 10, "max": 10}, "b": {"min": 6, "max": 10}}')
on conflict (key) do nothing;
