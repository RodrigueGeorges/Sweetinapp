-- Notifications par type : chaque appareil garde la liste des types coupés par la personne.
-- Types : flips (sweet reçu), reads (lu, réaction, capture, lien ouvert), streaks (séries), sweethour.
-- La personne écrit déjà ses propres lignes de push_tokens (upsert depuis l'app) : rien à changer côté RLS.
alter table public.push_tokens add column if not exists mute text[] not null default '{}';
