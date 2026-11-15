-- Local stand-in for the pieces of Supabase this migration touches.
-- Not applied to the hosted project.

create schema if not exists auth;
create schema if not exists storage;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;

grant anon to postgres;
grant authenticated to postgres;
grant usage on schema public to anon, authenticated;
grant usage on schema auth to anon, authenticated;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets (id),
  name text not null,
  owner uuid,
  owner_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_accessed_at timestamptz,
  metadata jsonb,
  user_metadata jsonb,
  version text,
  unique (bucket_id, name)
);

alter table storage.objects enable row level security;

create or replace function storage.foldername(name text)
returns text[]
language plpgsql
immutable
as $$
declare
  parts text[];
begin
  parts := string_to_array(name, '/');
  if array_length(parts, 1) is null or array_length(parts, 1) < 2 then
    return array[]::text[];
  end if;
  return parts[1:array_length(parts, 1) - 1];
end;
$$;

create or replace function storage.extension(name text)
returns text
language sql
immutable
as $$
  select reverse(split_part(reverse(coalesce(name, '')), '.', 1));
$$;

grant usage on schema storage to authenticated, anon;
grant select on storage.buckets to authenticated, anon;
grant select, insert, update, delete on storage.objects to authenticated;
