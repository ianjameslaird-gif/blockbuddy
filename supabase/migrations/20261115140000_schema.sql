-- BlockBuddy schema, row level security, and review functions.
-- Apply this file first, then 20261115140100_storage.sql.
-- Safe to re-run. It does not grant the service role to the browser,
-- and it does not mark anyone as an admin. See the README for that one-off.

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

comment on schema private is
  'BlockBuddy helpers. Do not add this schema to the Data API exposed schemas.';

do $$
begin
  create type public.verification_status as enum (
    'not_submitted',
    'submitted',
    'under_review',
    'verified',
    'action_needed'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.listing_type as enum ('sell', 'wanted', 'giveaway', 'trade');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.listing_status as enum ('active', 'taken', 'hidden');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.report_target as enum ('listing', 'member', 'general');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.report_status as enum ('open', 'resolved');
exception
  when duplicate_object then null;
end $$;

-- Mirrors js/privacy.js. Dollar amounts such as S$10-20 are allowed.
create or replace function public.contains_unit_number(source text)
returns boolean
language plpgsql
immutable
as $$
declare
  value text := translate(coalesce(source, ''), '–—', '--');
begin
  if value = '' then
    return false;
  end if;
  if value ~ '#[[:space:]]*[[:digit:]]{1,4}[[:space:]]*-[[:space:]]*[[:digit:]]{2,5}' then
    return true;
  end if;
  if value ~* '\y(unit|apt|apartment)[[:space:]]*#?[[:space:]]*[[:digit:]]{1,4}([[:space:]]*-[[:space:]]*[[:digit:]]{2,5})?\y' then
    return true;
  end if;
  if value ~* '\y(blk|block)[[:space:]]*[[:digit:]]{1,4}[[:space:]]*#[[:space:]]*[[:digit:]]{1,4}[[:space:]]*-[[:space:]]*[[:digit:]]{2,5}\y' then
    return true;
  end if;
  if value ~ '(^|[^$[:digit:]])[[:digit:]]{1,2}[[:space:]]*-[[:space:]]*[[:digit:]]{3,4}([^[:digit:]]|$)' then
    return true;
  end if;
  return false;
end;
$$;

create or replace function public.no_unit_number(source text)
returns boolean
language sql
immutable
as $$
  select not public.contains_unit_number(source);
$$;

revoke all on function public.contains_unit_number(text) from public;
revoke all on function public.no_unit_number(text) from public;
grant execute on function public.contains_unit_number(text) to authenticated;
grant execute on function public.no_unit_number(text) to authenticated;

create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  resident_label text not null,
  created_at timestamptz not null default now()
);

insert into public.communities (id, name, slug, resident_label)
values (
  'b7c1a0e2-4d55-4a1e-9c3f-2a6e8f0d4b11',
  'SkyPeak @ Bukit Batok',
  'skypeak-bukit-batok',
  'SkyPeak @ Bukit Batok resident'
)
on conflict (slug) do update
set name = excluded.name,
    resident_label = excluded.resident_label;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  bio text not null default '',
  community_id uuid not null references public.communities (id),
  verification_status public.verification_status not null default 'not_submitted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_len check (char_length(btrim(display_name)) between 2 and 60),
  constraint profiles_bio_len check (char_length(bio) <= 240),
  constraint profiles_display_name_no_unit check (public.no_unit_number(display_name)),
  constraint profiles_bio_no_unit check (public.no_unit_number(bio))
);

-- is_admin and reviewer notes live here so neighbours who can read a profile
-- cannot select these columns. There is no unit-number column anywhere.
create table if not exists public.profile_private (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  is_admin boolean not null default false,
  reviewer_note text,
  constraint profile_private_note_len check (reviewer_note is null or char_length(reviewer_note) <= 800),
  constraint profile_private_note_no_unit check (public.no_unit_number(coalesce(reviewer_note, '')))
);

create table if not exists public.verification_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  community_id uuid not null references public.communities (id),
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  status public.verification_status not null default 'submitted',
  reviewer_note text,
  decided_by uuid,
  decided_at timestamptz,
  submitted_at timestamptz not null default now(),
  document_deleted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint verification_submissions_user_id_fkey
    foreign key (user_id) references public.profiles (id) on delete cascade,
  constraint verification_submissions_decided_by_fkey
    foreign key (decided_by) references public.profiles (id) on delete set null,
  constraint verification_submissions_open_status check (status <> 'not_submitted'),
  constraint verification_submissions_mime check (mime_type = 'image/jpeg'),
  constraint verification_submissions_path check (
    storage_path ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
  ),
  constraint verification_submissions_name_len check (char_length(file_name) between 1 and 180),
  constraint verification_submissions_note_len check (reviewer_note is null or char_length(reviewer_note) <= 800),
  constraint verification_submissions_note_no_unit check (public.no_unit_number(coalesce(reviewer_note, '')))
);

create unique index if not exists verification_one_open
  on public.verification_submissions (user_id)
  where status in ('submitted', 'under_review');

create index if not exists verification_submissions_status_idx
  on public.verification_submissions (status, submitted_at);

create index if not exists verification_submissions_retention_idx
  on public.verification_submissions (decided_at)
  where document_deleted_at is null and decided_at is not null;

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  community_id uuid not null references public.communities (id),
  type public.listing_type not null,
  title text not null,
  description text not null,
  category text not null,
  condition text not null default 'Good',
  price numeric(10, 2),
  photo_path text,
  status public.listing_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A')
    || setweight(to_tsvector('simple', coalesce(description, '')), 'B')
    || setweight(to_tsvector('simple', coalesce(category, '')), 'C')
  ) stored,
  constraint listings_owner_id_fkey
    foreign key (owner_id) references public.profiles (id) on delete cascade,
  constraint listings_title_len check (char_length(btrim(title)) between 4 and 80),
  constraint listings_description_len check (char_length(btrim(description)) between 10 and 800),
  constraint listings_category_ok check (category in (
    'furniture', 'kitchen', 'kids', 'electronics', 'sports',
    'plants', 'books', 'home', 'games', 'other'
  )),
  constraint listings_condition_ok check (condition in ('Like new', 'Good', 'Fair', 'Well loved', 'Any')),
  constraint listings_price_range check (price is null or (price >= 0 and price <= 100000)),
  constraint listings_sell_price check (type <> 'sell' or price is not null),
  constraint listings_giveaway_free check (type <> 'giveaway' or price = 0),
  constraint listings_no_unit check (
    public.no_unit_number(title) and public.no_unit_number(description)
  ),
  constraint listings_photo_path check (
    photo_path is null
    or photo_path ~* '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$'
  )
);

create index if not exists listings_feed_idx
  on public.listings (community_id, status, created_at desc);

create index if not exists listings_owner_idx
  on public.listings (owner_id, created_at desc);

create index if not exists listings_search_idx
  on public.listings using gin (search_vector);

create table if not exists public.blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint blocks_not_self check (blocker_id <> blocked_id),
  constraint blocks_pair unique (blocker_id, blocked_id)
);

create index if not exists blocks_blocked_idx on public.blocks (blocked_id);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id),
  listing_id uuid references public.listings (id) on delete set null,
  user_low uuid not null,
  user_high uuid not null,
  created_at timestamptz not null default now(),
  constraint conversations_user_low_fkey
    foreign key (user_low) references public.profiles (id) on delete cascade,
  constraint conversations_user_high_fkey
    foreign key (user_high) references public.profiles (id) on delete cascade,
  constraint conversations_ordered check (user_low < user_high),
  constraint conversations_pair unique (user_low, user_high)
);

create index if not exists conversations_low_idx on public.conversations (user_low);
create index if not exists conversations_high_idx on public.conversations (user_high);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint messages_body_len check (char_length(btrim(body)) between 1 and 1000),
  constraint messages_no_unit check (public.no_unit_number(body))
);

create index if not exists messages_conversation_idx
  on public.messages (conversation_id, created_at);

create table if not exists public.conversation_reads (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null,
  community_id uuid not null references public.communities (id),
  target_type public.report_target not null,
  target_id uuid,
  target_label text not null default '',
  reason text not null,
  details text not null default '',
  status public.report_status not null default 'open',
  created_at timestamptz not null default now(),
  resolved_by uuid,
  resolved_at timestamptz,
  resolution_note text,
  constraint reports_reporter_id_fkey
    foreign key (reporter_id) references public.profiles (id) on delete cascade,
  constraint reports_resolved_by_fkey
    foreign key (resolved_by) references public.profiles (id) on delete set null,
  constraint reports_reason_len check (char_length(btrim(reason)) between 1 and 120),
  constraint reports_details_len check (char_length(details) <= 800),
  constraint reports_label_len check (char_length(target_label) <= 120),
  constraint reports_no_unit check (
    public.no_unit_number(details)
    and public.no_unit_number(target_label)
    and public.no_unit_number(coalesce(resolution_note, ''))
  ),
  constraint reports_target_shape check (
    (target_type = 'general' and target_id is null)
    or (target_type in ('listing', 'member') and target_id is not null)
  )
);

create index if not exists reports_queue_idx
  on public.reports (community_id, status, created_at desc);

create index if not exists reports_reporter_idx on public.reports (reporter_id, created_at desc);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid,
  action text not null,
  target_type text not null,
  target_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_log_admin_id_fkey
    foreign key (admin_id) references public.profiles (id) on delete set null,
  constraint audit_log_action_len check (char_length(action) between 1 and 80),
  constraint audit_log_target_len check (char_length(target_type) between 1 and 80)
);

create index if not exists audit_log_created_idx on public.audit_log (created_at desc);

-- Helpers. security definer so policies can read flags without recursive RLS.
-- search_path is empty and every reference is schema-qualified.

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select p.is_admin
      from public.profile_private p
      where p.user_id = (select auth.uid())
    ),
    false
  );
$$;

create or replace function private.is_verified_member(target_community uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.community_id = target_community
      and p.verification_status = 'verified'
  );
$$;

create or replace function private.pair_blocked(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select a is not null and b is not null and exists (
    select 1
    from public.blocks
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;

create or replace function private.blocked_with(other_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.pair_blocked((select auth.uid()), other_id);
$$;

create or replace function private.same_verified_pair(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select a is not null and b is not null and a <> b and exists (
    select 1
    from public.profiles pa
    join public.profiles pb on pb.community_id = pa.community_id
    where pa.id = a
      and pb.id = b
      and pa.verification_status = 'verified'
      and pb.verification_status = 'verified'
  );
$$;

create or replace function private.can_message(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.same_verified_pair(a, b)
    and not private.pair_blocked(a, b)
    and (select auth.uid()) in (a, b);
$$;

create or replace function private.uuid_folder(object_name text, idx int)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  part text;
begin
  part := split_part(coalesce(object_name, ''), '/', idx);
  if part !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;
  return part::uuid;
exception
  when others then
    return null;
end;
$$;

revoke all on function private.is_admin() from public;
revoke all on function private.is_verified_member(uuid) from public;
revoke all on function private.pair_blocked(uuid, uuid) from public;
revoke all on function private.blocked_with(uuid) from public;
revoke all on function private.same_verified_pair(uuid, uuid) from public;
revoke all on function private.can_message(uuid, uuid) from public;
revoke all on function private.uuid_folder(text, int) from public;

grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_verified_member(uuid) to authenticated;
grant execute on function private.blocked_with(uuid) to authenticated;
grant execute on function private.can_message(uuid, uuid) to authenticated;
grant execute on function private.uuid_folder(text, int) to authenticated;

create or replace function private.guard_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if current_setting('bb.privileged', true) is distinct from 'on' then
      raise exception 'Profiles are created at sign-up.';
    end if;
    return new;
  end if;

  if new.id is distinct from old.id then
    raise exception 'This field cannot be changed.';
  end if;

  if new.verification_status is distinct from old.verification_status
     and current_setting('bb.privileged', true) is distinct from 'on' then
    raise exception 'This field cannot be changed.';
  end if;

  if new.community_id is distinct from old.community_id
     and old.verification_status is distinct from 'not_submitted'
     and current_setting('bb.privileged', true) is distinct from 'on' then
    raise exception 'Community cannot be changed after verification starts.';
  end if;

  if public.contains_unit_number(new.display_name) or public.contains_unit_number(new.bio) then
    raise exception 'Unit numbers are not allowed.';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.guard_profile_private()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('bb.privileged', true) is distinct from 'on' then
    raise exception 'This field cannot be changed.';
  end if;
  if new.reviewer_note is not null and public.contains_unit_number(new.reviewer_note) then
    raise exception 'Unit numbers are not allowed.';
  end if;
  return new;
end;
$$;

create or replace function private.guard_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_status public.verification_status;
  profile_community uuid;
begin
  if tg_op = 'UPDATE' then
    if current_setting('bb.privileged', true) is distinct from 'on' then
      raise exception 'Submissions are reviewed by an admin.';
    end if;
    return new;
  end if;

  if new.user_id is distinct from (select auth.uid()) then
    raise exception 'not allowed';
  end if;

  select p.verification_status, p.community_id
    into profile_status, profile_community
  from public.profiles p
  where p.id = new.user_id;

  if profile_status is null or profile_status not in ('not_submitted', 'action_needed') then
    raise exception 'verification is not open';
  end if;

  new.community_id := profile_community;
  new.status := 'submitted';
  new.reviewer_note := null;
  new.decided_by := null;
  new.decided_at := null;
  new.document_deleted_at := null;
  new.submitted_at := now();

  if split_part(new.storage_path, '/', 1) is distinct from new.user_id::text then
    raise exception 'invalid document path';
  end if;

  perform set_config('bb.privileged', 'on', true);

  update public.profiles
  set verification_status = 'submitted',
      updated_at = now()
  where id = new.user_id;

  update public.profile_private
  set reviewer_note = null
  where user_id = new.user_id;

  return new;
end;
$$;

create or replace function private.guard_listing()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  mine uuid;
begin
  mine := (select auth.uid());

  if tg_op = 'INSERT' then
    if new.owner_id is distinct from mine then
      raise exception 'not allowed';
    end if;
    if not private.is_verified_member(new.community_id) then
      raise exception 'not allowed';
    end if;
    if new.status is distinct from 'active' then
      raise exception 'not allowed';
    end if;
  else
    if new.owner_id is distinct from old.owner_id
       or new.community_id is distinct from old.community_id
       or new.id is distinct from old.id then
      raise exception 'This field cannot be changed.';
    end if;
    if new.status is distinct from old.status
       and (new.status = 'hidden' or old.status = 'hidden')
       and current_setting('bb.privileged', true) is distinct from 'on' then
      raise exception 'This listing is held by a reviewer.';
    end if;
    if old.owner_id is distinct from mine
       and current_setting('bb.privileged', true) is distinct from 'on' then
      raise exception 'not allowed';
    end if;
  end if;

  if public.contains_unit_number(new.title) or public.contains_unit_number(new.description) then
    raise exception 'Unit numbers are not allowed.';
  end if;

  if new.photo_path is not null
     and new.photo_path !~* (
       '^' || new.community_id::text || '/' || new.owner_id::text || '/' || new.id::text || '\.jpg$'
     ) then
    raise exception 'invalid photo path';
  end if;

  if new.type = 'giveaway' then
    new.price := 0;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.guard_message()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  convo public.conversations%rowtype;
begin
  if new.sender_id is distinct from (select auth.uid()) then
    raise exception 'not allowed';
  end if;
  select * into convo from public.conversations where id = new.conversation_id;
  if convo.id is null or (select auth.uid()) not in (convo.user_low, convo.user_high) then
    raise exception 'not allowed';
  end if;
  if not private.can_message(convo.user_low, convo.user_high) then
    raise exception 'Messaging is not available.';
  end if;
  if public.contains_unit_number(new.body) then
    raise exception 'Unit numbers are not allowed.';
  end if;
  return new;
end;
$$;

create or replace function private.guard_report()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  profile public.profiles%rowtype;
begin
  if tg_op = 'UPDATE' then
    if current_setting('bb.privileged', true) is distinct from 'on' then
      raise exception 'Reports are resolved by an admin.';
    end if;
    return new;
  end if;

  if new.reporter_id is distinct from (select auth.uid()) then
    raise exception 'not allowed';
  end if;

  select * into profile from public.profiles where id = new.reporter_id;
  if profile.id is null then
    raise exception 'not allowed';
  end if;

  new.community_id := profile.community_id;
  new.status := 'open';
  new.resolved_by := null;
  new.resolved_at := null;
  new.resolution_note := null;

  if public.contains_unit_number(coalesce(new.details, ''))
     or public.contains_unit_number(coalesce(new.target_label, '')) then
    raise exception 'Unit numbers are not allowed.';
  end if;

  return new;
end;
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  comm uuid;
  chosen text;
begin
  select id into comm
  from public.communities
  where slug = 'skypeak-bukit-batok';

  if comm is null then
    raise exception 'SkyPeak community is not seeded';
  end if;

  chosen := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  if char_length(chosen) < 2 or public.contains_unit_number(chosen) then
    chosen := 'Neighbour';
  end if;
  if char_length(chosen) > 60 then
    chosen := left(chosen, 60);
  end if;

  perform set_config('bb.privileged', 'on', true);

  insert into public.profiles (id, display_name, community_id)
  values (new.id, chosen, comm);

  insert into public.profile_private (user_id, is_admin)
  values (new.id, false);

  return new;
end;
$$;

create or replace function private.guard_conversation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.user_low is distinct from old.user_low
       or new.user_high is distinct from old.user_high
       or new.community_id is distinct from old.community_id
       or new.id is distinct from old.id then
      raise exception 'This field cannot be changed.';
    end if;
  end if;

  if not private.can_message(new.user_low, new.user_high) then
    raise exception 'Messaging is not available.';
  end if;

  if new.listing_id is not null and not exists (
    select 1
    from public.listings l
    where l.id = new.listing_id
      and l.community_id = new.community_id
  ) then
    raise exception 'not allowed';
  end if;

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;
revoke all on function private.guard_profile() from public;
revoke all on function private.guard_conversation() from public;
revoke all on function private.guard_profile_private() from public;
revoke all on function private.guard_submission() from public;
revoke all on function private.guard_listing() from public;
revoke all on function private.guard_message() from public;
revoke all on function private.guard_report() from public;

grant execute on function private.guard_profile() to authenticated;
grant execute on function private.guard_profile_private() to authenticated;
grant execute on function private.guard_submission() to authenticated;
grant execute on function private.guard_listing() to authenticated;
grant execute on function private.guard_message() to authenticated;
grant execute on function private.guard_report() to authenticated;
grant execute on function private.guard_conversation() to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant usage on schema private to supabase_auth_admin;
    grant execute on function private.handle_new_user() to supabase_auth_admin;
  end if;
end $$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard
  before insert or update on public.profiles
  for each row execute function private.guard_profile();

drop trigger if exists profile_private_guard on public.profile_private;
create trigger profile_private_guard
  before insert or update on public.profile_private
  for each row execute function private.guard_profile_private();

drop trigger if exists verification_submissions_guard on public.verification_submissions;
create trigger verification_submissions_guard
  before insert or update on public.verification_submissions
  for each row execute function private.guard_submission();

drop trigger if exists listings_guard on public.listings;
create trigger listings_guard
  before insert or update on public.listings
  for each row execute function private.guard_listing();

drop trigger if exists messages_guard on public.messages;
create trigger messages_guard
  before insert or update on public.messages
  for each row execute function private.guard_message();

drop trigger if exists reports_guard on public.reports;
create trigger reports_guard
  before insert or update on public.reports
  for each row execute function private.guard_report();

drop trigger if exists conversations_guard on public.conversations;
create trigger conversations_guard
  before insert or update on public.conversations
  for each row execute function private.guard_conversation();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

alter table public.communities enable row level security;
alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;
alter table public.verification_submissions enable row level security;
alter table public.listings enable row level security;
alter table public.blocks enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.conversation_reads enable row level security;
alter table public.reports enable row level security;
alter table public.audit_log enable row level security;

drop policy if exists communities_select on public.communities;
create policy communities_select on public.communities
  for select to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or (select private.is_admin())
    or (
      verification_status = 'verified'
      and (select private.is_verified_member(community_id))
    )
  );

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists profile_private_select on public.profile_private;
create policy profile_private_select on public.profile_private
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.is_admin())
  );

drop policy if exists verification_select on public.verification_submissions;
create policy verification_select on public.verification_submissions
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.is_admin())
  );

drop policy if exists verification_insert on public.verification_submissions;
create policy verification_insert on public.verification_submissions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'submitted'
    and split_part(storage_path, '/', 1) = (select auth.uid())::text
  );

drop policy if exists listings_select on public.listings;
create policy listings_select on public.listings
  for select to authenticated
  using (
    owner_id = (select auth.uid())
    or (select private.is_admin())
    or (
      status = 'active'
      and (select private.is_verified_member(community_id))
      and not (select private.blocked_with(owner_id))
    )
  );

drop policy if exists listings_insert on public.listings;
create policy listings_insert on public.listings
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and status = 'active'
    and (select private.is_verified_member(community_id))
  );

drop policy if exists listings_update on public.listings;
create policy listings_update on public.listings
  for update to authenticated
  using (owner_id = (select auth.uid()) or (select private.is_admin()))
  with check (owner_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists listings_delete on public.listings;
create policy listings_delete on public.listings
  for delete to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists blocks_select on public.blocks;
create policy blocks_select on public.blocks
  for select to authenticated
  using (blocker_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists blocks_insert on public.blocks;
create policy blocks_insert on public.blocks
  for insert to authenticated
  with check (
    blocker_id = (select auth.uid())
    and blocked_id <> (select auth.uid())
    and exists (
      select 1
      from public.profiles mine
      join public.profiles other on other.community_id = mine.community_id
      where mine.id = (select auth.uid())
        and other.id = blocked_id
    )
  );

drop policy if exists blocks_delete on public.blocks;
create policy blocks_delete on public.blocks
  for delete to authenticated
  using (blocker_id = (select auth.uid()));

drop policy if exists conversations_select on public.conversations;
create policy conversations_select on public.conversations
  for select to authenticated
  using (
    (select auth.uid()) in (user_low, user_high)
    and (select private.can_message(user_low, user_high))
  );

drop policy if exists conversations_insert on public.conversations;
create policy conversations_insert on public.conversations
  for insert to authenticated
  with check (
    (select auth.uid()) in (user_low, user_high)
    and user_low < user_high
    and (select private.can_message(user_low, user_high))
    and community_id = (
      select p.community_id from public.profiles p where p.id = (select auth.uid())
    )
  );

drop policy if exists conversations_update on public.conversations;
create policy conversations_update on public.conversations
  for update to authenticated
  using ((select auth.uid()) in (user_low, user_high))
  with check (
    (select auth.uid()) in (user_low, user_high)
    and (select private.can_message(user_low, user_high))
  );

drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select to authenticated
  using (
    exists (
      select 1
      from public.conversations c
      where c.id = conversation_id
        and (select auth.uid()) in (c.user_low, c.user_high)
        and (select private.can_message(c.user_low, c.user_high))
    )
  );

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert to authenticated
  with check (sender_id = (select auth.uid()));

drop policy if exists reads_select on public.conversation_reads;
create policy reads_select on public.conversation_reads
  for select to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (select auth.uid()) in (c.user_low, c.user_high)
    )
  );

drop policy if exists reads_write on public.conversation_reads;
create policy reads_write on public.conversation_reads
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (select auth.uid()) in (c.user_low, c.user_high)
    )
  );

drop policy if exists reads_update on public.conversation_reads;
create policy reads_update on public.conversation_reads
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists reports_select on public.reports;
create policy reports_select on public.reports
  for select to authenticated
  using (
    reporter_id = (select auth.uid())
    or (select private.is_admin())
  );

drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports
  for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and status = 'open'
  );

drop policy if exists audit_select on public.audit_log;
create policy audit_select on public.audit_log
  for select to authenticated
  using ((select private.is_admin()));

-- Column privileges are the backstop. Status, community and is_admin are not
-- in the update grant. Admin changes go through security definer functions.
revoke all on table public.communities from public, anon, authenticated;
revoke all on table public.profiles from public, anon, authenticated;
revoke all on table public.profile_private from public, anon, authenticated;
revoke all on table public.verification_submissions from public, anon, authenticated;
revoke all on table public.listings from public, anon, authenticated;
revoke all on table public.blocks from public, anon, authenticated;
revoke all on table public.conversations from public, anon, authenticated;
revoke all on table public.messages from public, anon, authenticated;
revoke all on table public.conversation_reads from public, anon, authenticated;
revoke all on table public.reports from public, anon, authenticated;
revoke all on table public.audit_log from public, anon, authenticated;

grant select on public.communities to authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, bio) on public.profiles to authenticated;
grant select on public.profile_private to authenticated;
grant select, insert on public.verification_submissions to authenticated;
grant select, insert, delete on public.listings to authenticated;
grant update (type, title, description, category, condition, price, photo_path, status)
  on public.listings to authenticated;
grant select, insert, delete on public.blocks to authenticated;
grant select, insert on public.conversations to authenticated;
grant update (listing_id) on public.conversations to authenticated;
grant select, insert on public.messages to authenticated;
grant select, insert, update on public.conversation_reads to authenticated;
grant select, insert on public.reports to authenticated;
grant select on public.audit_log to authenticated;

create or replace function private.review_submission(
  p_id uuid,
  p_status public.verification_status,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  sub public.verification_submissions%rowtype;
  note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not private.is_admin() then
    raise exception 'not allowed';
  end if;
  if p_status not in ('under_review', 'verified', 'action_needed') then
    raise exception 'unsupported decision';
  end if;
  if p_status = 'action_needed' and note is null then
    raise exception 'a note is required';
  end if;
  if note is not null and public.contains_unit_number(note) then
    raise exception 'notes cannot include a unit number';
  end if;

  select * into sub
  from public.verification_submissions
  where id = p_id
  for update;

  if sub.id is null then
    raise exception 'submission not found';
  end if;

  if exists (
    select 1
    from public.verification_submissions newer
    where newer.user_id = sub.user_id
      and newer.submitted_at > sub.submitted_at
  ) then
    raise exception 'a newer submission exists';
  end if;

  perform set_config('bb.privileged', 'on', true);

  update public.verification_submissions
  set status = p_status,
      reviewer_note = case when p_status = 'action_needed' then note else null end,
      decided_by = case when p_status = 'under_review' then null else (select auth.uid()) end,
      decided_at = case when p_status = 'under_review' then null else now() end
  where id = p_id;

  update public.profiles
  set verification_status = p_status
  where id = sub.user_id;

  update public.profile_private
  set reviewer_note = case when p_status = 'action_needed' then note else null end
  where user_id = sub.user_id;

  insert into public.audit_log (admin_id, action, target_type, target_id, detail)
  values (
    (select auth.uid()),
    'review_submission',
    'verification_submission',
    p_id,
    jsonb_build_object('status', p_status, 'user_id', sub.user_id)
  );
end;
$$;

create or replace function private.audit_document_open(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  path text;
  deleted timestamptz;
begin
  if not private.is_admin() then
    raise exception 'not allowed';
  end if;

  select storage_path, document_deleted_at
    into path, deleted
  from public.verification_submissions
  where id = p_id;

  if path is null then
    raise exception 'submission not found';
  end if;

  insert into public.audit_log (admin_id, action, target_type, target_id, detail)
  values (
    (select auth.uid()),
    'opened_document',
    'verification_submission',
    p_id,
    jsonb_build_object('deleted', deleted is not null)
  );

  if deleted is not null then
    return null;
  end if;
  return path;
end;
$$;

create or replace function private.resolve_report(p_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not private.is_admin() then
    raise exception 'not allowed';
  end if;
  if note is not null and public.contains_unit_number(note) then
    raise exception 'notes cannot include a unit number';
  end if;

  perform set_config('bb.privileged', 'on', true);

  update public.reports
  set status = 'resolved',
      resolved_by = (select auth.uid()),
      resolved_at = now(),
      resolution_note = note
  where id = p_id
    and status = 'open';

  if not found then
    raise exception 'report not found';
  end if;

  insert into public.audit_log (admin_id, action, target_type, target_id, detail)
  values (
    (select auth.uid()),
    'resolve_report',
    'report',
    p_id,
    '{}'::jsonb
  );
end;
$$;

create or replace function private.hide_listing(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'not allowed';
  end if;

  perform set_config('bb.privileged', 'on', true);

  update public.listings
  set status = 'hidden'
  where id = p_id
    and status is distinct from 'hidden';

  if not found then
    raise exception 'listing not found';
  end if;

  insert into public.audit_log (admin_id, action, target_type, target_id, detail)
  values (
    (select auth.uid()),
    'hide_listing',
    'listing',
    p_id,
    '{}'::jsonb
  );
end;
$$;

revoke all on function private.review_submission(uuid, public.verification_status, text) from public;
revoke all on function private.audit_document_open(uuid) from public;
revoke all on function private.resolve_report(uuid, text) from public;
revoke all on function private.hide_listing(uuid) from public;
grant execute on function private.review_submission(uuid, public.verification_status, text) to authenticated;
grant execute on function private.audit_document_open(uuid) to authenticated;
grant execute on function private.resolve_report(uuid, text) to authenticated;
grant execute on function private.hide_listing(uuid) to authenticated;

create or replace function public.admin_review_submission(
  p_id uuid,
  p_status public.verification_status,
  p_note text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform private.review_submission(p_id, p_status, p_note);
end;
$$;

create or replace function public.admin_open_submission(p_id uuid)
returns text
language plpgsql
security invoker
set search_path = public
as $$
begin
  return private.audit_document_open(p_id);
end;
$$;

create or replace function public.admin_resolve_report(p_id uuid, p_note text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform private.resolve_report(p_id, p_note);
end;
$$;

create or replace function public.admin_hide_listing(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform private.hide_listing(p_id);
end;
$$;

create or replace function public.search_listings(
  p_q text default null,
  p_category text default null,
  p_type text default null,
  p_min numeric default null,
  p_max numeric default null,
  p_free boolean default false,
  p_owner uuid default null,
  p_include_closed boolean default false
)
returns setof public.listings
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  needle text := left(btrim(coalesce(p_q, '')), 80);
  escaped text;
begin
  if public.contains_unit_number(needle) then
    return;
  end if;
  if p_category is not null and p_category <> '' and p_category not in (
    'furniture', 'kitchen', 'kids', 'electronics', 'sports',
    'plants', 'books', 'home', 'games', 'other'
  ) then
    return;
  end if;
  if p_type is not null and p_type <> '' and p_type not in ('sell', 'wanted', 'giveaway', 'trade') then
    return;
  end if;

  escaped := replace(replace(replace(needle, '\', '\\'), '%', '\%'), '_', '\_');

  return query
  select l.*
  from public.listings l
  where (p_owner is null or l.owner_id = p_owner)
    and (
      l.status = 'active'
      or (p_include_closed and l.owner_id = (select auth.uid()))
    )
    and (p_category is null or p_category = '' or l.category = p_category)
    and (p_type is null or p_type = '' or l.type = p_type::public.listing_type)
    and (not coalesce(p_free, false) or l.type = 'giveaway' or l.price = 0)
    and (p_min is null or (l.price is not null and l.price >= p_min))
    and (p_max is null or (l.price is not null and l.price <= p_max))
    and (
      escaped = ''
      or l.title ilike '%' || escaped || '%' escape '\'
      or l.description ilike '%' || escaped || '%' escape '\'
      or l.category ilike '%' || escaped || '%' escape '\'
      or l.search_vector @@ plainto_tsquery('simple', needle)
    )
  order by l.created_at desc
  limit 100;
end;
$$;

create or replace function public.inbox()
returns table (
  id uuid,
  other_id uuid,
  listing_id uuid,
  last_body text,
  last_at timestamptz,
  unread boolean,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.id,
    case
      when c.user_low = (select auth.uid()) then c.user_high
      else c.user_low
    end as other_id,
    c.listing_id,
    m.body as last_body,
    coalesce(m.created_at, c.created_at) as last_at,
    exists (
      select 1
      from public.messages unread_message
      where unread_message.conversation_id = c.id
        and unread_message.sender_id <> (select auth.uid())
        and unread_message.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)
    ) as unread,
    c.created_at
  from public.conversations c
  left join lateral (
    select body, created_at
    from public.messages
    where conversation_id = c.id
    order by created_at desc
    limit 1
  ) m on true
  left join public.conversation_reads r
    on r.conversation_id = c.id
   and r.user_id = (select auth.uid())
  order by coalesce(m.created_at, c.created_at) desc;
$$;

revoke all on function public.admin_review_submission(uuid, public.verification_status, text) from public;
revoke all on function public.admin_open_submission(uuid) from public;
revoke all on function public.admin_resolve_report(uuid, text) from public;
revoke all on function public.admin_hide_listing(uuid) from public;
revoke all on function public.search_listings(text, text, text, numeric, numeric, boolean, uuid, boolean) from public;
revoke all on function public.inbox() from public;

grant execute on function public.admin_review_submission(uuid, public.verification_status, text) to authenticated;
grant execute on function public.admin_open_submission(uuid) to authenticated;
grant execute on function public.admin_resolve_report(uuid, text) to authenticated;
grant execute on function public.admin_hide_listing(uuid) to authenticated;
grant execute on function public.search_listings(text, text, text, numeric, numeric, boolean, uuid, boolean) to authenticated;
grant execute on function public.inbox() to authenticated;

alter table public.messages replica identity full;
