-- Rappel « le sweet de tom disparaît demain » : on note l'envoi pour ne prévenir qu'une fois par sweet.
alter table public.flip_recipients add column if not exists reminded_at timestamptz;
create index if not exists flip_recipients_unread_idx on public.flip_recipients (flip_id) where scratched_at is null and reminded_at is null;
