-- Le mot au verso peut être déplacé/redimensionné (glisser/pincer) : on garde son placement.
alter table public.flip_secrets add column if not exists word_style jsonb;
