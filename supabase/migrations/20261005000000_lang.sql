-- Langue de l'app de chaque appareil, pour écrire les notifications en français ou en anglais.
alter table public.push_tokens add column if not exists lang text not null default 'fr';
alter table public.push_tokens drop constraint if exists push_tokens_lang_check;
alter table public.push_tokens add constraint push_tokens_lang_check check (lang in ('fr', 'en'));
