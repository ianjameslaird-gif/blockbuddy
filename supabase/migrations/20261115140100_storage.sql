-- Private buckets, storage policies, 90-day document purge, and realtime.
-- Apply after 20261115140000_schema.sql.
-- The purge job is scheduled only when pg_cron is already enabled.
-- If it is not, this file still creates the function and continues.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'verification-docs',
    'verification-docs',
    false,
    8388608,
    array['image/jpeg']::text[]
  ),
  (
    'listing-photos',
    'listing-photos',
    false,
    5242880,
    array['image/jpeg']::text[]
  )
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table storage.objects enable row level security;

drop policy if exists verification_docs_read on storage.objects;
create policy verification_docs_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'verification-docs'
    and (
      (select private.uuid_folder(name, 1)) = (select auth.uid())
      or (select private.is_admin())
    )
  );

drop policy if exists verification_docs_insert on storage.objects;
create policy verification_docs_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'verification-docs'
    and (select private.uuid_folder(name, 1)) = (select auth.uid())
    and coalesce(storage.extension(name), '') = 'jpg'
  );

drop policy if exists verification_docs_delete on storage.objects;
create policy verification_docs_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'verification-docs'
    and (
      (select private.uuid_folder(name, 1)) = (select auth.uid())
      or (select private.is_admin())
    )
  );

drop policy if exists listing_photos_read on storage.objects;
create policy listing_photos_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'listing-photos'
    and (select private.is_verified_member((select private.uuid_folder(name, 1))))
    and not (select private.blocked_with((select private.uuid_folder(name, 2))))
  );

drop policy if exists listing_photos_insert on storage.objects;
create policy listing_photos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'listing-photos'
    and (select private.uuid_folder(name, 2)) = (select auth.uid())
    and (select private.is_verified_member((select private.uuid_folder(name, 1))))
    and coalesce(storage.extension(name), '') = 'jpg'
  );

drop policy if exists listing_photos_update on storage.objects;
create policy listing_photos_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'listing-photos'
    and (select private.uuid_folder(name, 2)) = (select auth.uid())
  )
  with check (
    bucket_id = 'listing-photos'
    and (select private.uuid_folder(name, 2)) = (select auth.uid())
    and (select private.is_verified_member((select private.uuid_folder(name, 1))))
    and coalesce(storage.extension(name), '') = 'jpg'
  );

drop policy if exists listing_photos_delete on storage.objects;
create policy listing_photos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'listing-photos'
    and (select private.uuid_folder(name, 2)) = (select auth.uid())
  );

-- Deletes proof-of-address files 90 days after a decision (verified or action needed).
-- Under review is not a decision, so those files stay until a decision is recorded.
create or replace function private.purge_expired_verification_docs()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec record;
  removed integer := 0;
begin
  perform set_config('bb.privileged', 'on', true);

  for rec in
    select id, storage_path
    from public.verification_submissions
    where decided_at is not null
      and decided_at < now() - interval '90 days'
      and document_deleted_at is null
      and status in ('verified', 'action_needed')
  loop
    delete from storage.objects
    where bucket_id = 'verification-docs'
      and name = rec.storage_path;

    update public.verification_submissions
    set document_deleted_at = now()
    where id = rec.id
      and document_deleted_at is null;

    removed := removed + 1;
  end loop;

  return removed;
end;
$$;

revoke all on function private.purge_expired_verification_docs() from public;

comment on function private.purge_expired_verification_docs() is
  'Deletes verification documents 90 days after a decision. Run daily, or via pg_cron.';

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'purge-verification-docs',
      '15 3 * * *',
      'select private.purge_expired_verification_docs()'
    );
  else
    raise notice 'pg_cron is not enabled. The purge function exists; schedule it after enabling the extension. See the README.';
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'messages'
     ) then
    alter publication supabase_realtime add table public.messages;
  elsif not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'supabase_realtime publication is missing. In the dashboard, enable Realtime for public.messages.';
  end if;
end $$;
