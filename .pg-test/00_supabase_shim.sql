-- Simule l'environnement Supabase sur un PostgreSQL nu, pour valider les migrations.
-- NE PAS déployer : uniquement pour la base de test locale.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

do $$ begin
  create role anon nologin;
exception when duplicate_object then null; end $$;
do $$ begin
  create role authenticated nologin;
exception when duplicate_object then null; end $$;
do $$ begin
  create role service_role nologin;
exception when duplicate_object then null; end $$;
grant usage on schema public to anon, authenticated, service_role;

create schema if not exists auth;
create table auth.users (
  id uuid primary key default extensions.uuid_generate_v4(),
  email text,
  phone text,
  phone_confirmed_at timestamptz,
  raw_user_meta_data jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create or replace function auth.role() returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claim.role', true), '')
$$;

create schema if not exists storage;
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default extensions.uuid_generate_v4(),
  bucket_id text references storage.buckets,
  name text,
  owner uuid,
  created_at timestamptz not null default now()
);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$
  select string_to_array(name, '/')
$$;

-- publication realtime de la plateforme Supabase
create publication supabase_realtime;
