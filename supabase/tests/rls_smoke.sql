-- Asserts the local stub plus migrations enforce BlockBuddy's access rules.
-- Run as a superuser against the throwaway database. This file is not a migration.

\set ON_ERROR_STOP on

\set alex '11111111-1111-4111-8111-111111111111'
\set mei '22222222-2222-4222-8222-222222222222'
\set newbie '33333333-3333-4333-8333-333333333333'
\set admin '44444444-4444-4444-8444-444444444444'
\set farah '55555555-5555-4555-8555-555555555555'
\set other '66666666-6666-4666-8666-666666666666'
\set sky 'b7c1a0e2-4d55-4a1e-9c3f-2a6e8f0d4b11'

insert into auth.users (id, email, raw_user_meta_data) values
  (:'alex', 'alex@skypeak.example', '{"display_name":"Alex Tan"}'),
  (:'mei', 'mei@skypeak.example', '{"display_name":"Mei Lin"}'),
  (:'newbie', 'newbie@skypeak.example', '{"display_name":"#12-345"}'),
  (:'admin', 'admin@skypeak.example', '{"display_name":"Reviewer"}'),
  (:'farah', 'farah@example.com', '{"display_name":"Farah"}');

insert into public.communities (id, name, slug, resident_label)
values (:'other', 'Other Block', 'other-block', 'Other Block resident');

begin;
select set_config('bb.privileged', 'on', true);
update public.profiles
set community_id = :'other'
where id = :'farah';
update public.profiles
set verification_status = 'verified'
where id in (:'alex', :'mei', :'admin', :'farah');
update public.profile_private
set is_admin = true
where user_id = :'admin';
commit;

-- A rejected display name must not become the profile name.
do $$
begin
  if (select display_name from public.profiles where id = '33333333-3333-4333-8333-333333333333') <> 'Neighbour' then
    raise exception 'unit number in the sign-up name was stored';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and not c.relrowsecurity
  ) then
    raise exception 'a public table is missing row level security';
  end if;

  if exists (
    select 1
    from pg_policy pol
    where pg_get_expr(pol.polqual, pol.polrelid) = 'true'
       or pg_get_expr(pol.polwithcheck, pol.polrelid) = 'true'
  ) then
    raise exception 'a policy uses a permissive true expression';
  end if;
end $$;

do $$
declare
  rel text;
begin
  foreach rel in array array[
    'communities', 'profiles', 'profile_private', 'verification_submissions',
    'listings', 'blocks', 'conversations', 'messages', 'conversation_reads',
    'reports', 'audit_log'
  ]
  loop
    if has_table_privilege('anon', 'public.' || rel, 'SELECT')
       or has_table_privilege('anon', 'public.' || rel, 'INSERT')
       or has_table_privilege('anon', 'public.' || rel, 'UPDATE')
       or has_table_privilege('anon', 'public.' || rel, 'DELETE') then
      raise exception 'anon can access %', rel;
    end if;
  end loop;
end $$;

do $$
begin
  if public.contains_unit_number('#12-345') is not true then
    raise exception '#12-345 should match';
  end if;
  if public.contains_unit_number('S$10-20') then
    raise exception 'S$10-20 should not match';
  end if;
  if public.contains_unit_number('unit 12') is not true then
    raise exception 'unit 12 should match';
  end if;
  if public.contains_unit_number('block 123 #12-345') is not true then
    raise exception 'block pattern should match';
  end if;
  if public.contains_unit_number('8-112') is not true then
    raise exception '8-112 should match';
  end if;
  if public.contains_unit_number('Meet at the lobby') then
    raise exception 'lobby should not match';
  end if;
end $$;

select set_config('request.jwt.claim.sub', :'alex', false);
set role authenticated;

insert into public.listings (owner_id, community_id, type, title, description, category, condition, price)
values (
  :'alex',
  :'sky',
  'sell',
  'White cube shelf',
  'Two columns by four rows. Collect from the lobby.',
  'furniture',
  'Good',
  0
);

reset role;
select set_config('bb.privileged', 'off', false);
select set_config('request.jwt.claim.sub', :'mei', false);
set role authenticated;

insert into public.listings (owner_id, community_id, type, title, description, category, condition, price)
values (
  :'mei',
  :'sky',
  'sell',
  'Cordless stick vacuum',
  'Suction is still strong after a normal flat clean.',
  'electronics',
  'Good',
  85
);

reset role;
select set_config('request.jwt.claim.sub', :'farah', false);
set role authenticated;

insert into public.listings (owner_id, community_id, type, title, description, category, condition, price)
values (
  :'farah',
  :'other',
  'giveaway',
  'Spare fan',
  'Works quietly. Collect from the void deck.',
  'electronics',
  'Good',
  0
);

reset role;

-- Alex sees SkyPeak listings only, including Mei's.
select set_config('request.jwt.claim.sub', :'alex', false);
set role authenticated;

do $$
declare
  seen int;
begin
  select count(*) into seen from public.search_listings();
  if seen <> 2 then
    raise exception 'alex should see 2 listings, saw %', seen;
  end if;
  if exists (select 1 from public.listings where title = 'Spare fan') then
    raise exception 'alex can see another community';
  end if;
end $$;

do $$
begin
  begin
    insert into public.listings (owner_id, community_id, type, title, description, category, condition, price)
    values (
      '11111111-1111-4111-8111-111111111111',
      'b7c1a0e2-4d55-4a1e-9c3f-2a6e8f0d4b11',
      'sell',
      'Shelf #12-345',
      'This description is long enough to pass the length check.',
      'home',
      'Good',
      10
    );
    raise exception 'unit number listing was stored';
  exception
    when others then
      if sqlerrm = 'unit number listing was stored' then
        raise;
      end if;
  end;
end $$;

do $$
begin
  begin
    update public.profiles
    set verification_status = 'verified'
    where id = '11111111-1111-4111-8111-111111111111';
    raise exception 'member changed verification status';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlerrm !~ 'cannot be changed|permission denied' then
        raise;
      end if;
  end;

  begin
    update public.profile_private
    set is_admin = true
    where user_id = '11111111-1111-4111-8111-111111111111';
    raise exception 'member changed is_admin';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlerrm !~ 'cannot be changed|permission denied' then
        raise;
      end if;
  end;
end $$;

update public.profiles
set display_name = 'Alex T.'
where id = :'alex';

reset role;
select set_config('request.jwt.claim.sub', :'newbie', false);
set role authenticated;

do $$
declare
  seen int;
begin
  select count(*) into seen from public.listings;
  if seen <> 0 then
    raise exception 'unverified member can read listings';
  end if;
  begin
    insert into public.listings (owner_id, community_id, type, title, description, category, condition, price)
    values (
      '33333333-3333-4333-8333-333333333333',
      'b7c1a0e2-4d55-4a1e-9c3f-2a6e8f0d4b11',
      'sell',
      'Should not post',
      'This description is long enough to try the insert.',
      'home',
      'Good',
      5
    );
    raise exception 'unverified member posted';
  exception
    when others then
      if sqlerrm = 'unverified member posted' then
        raise;
      end if;
  end;
end $$;

reset role;
select set_config('request.jwt.claim.sub', :'alex', false);
set role authenticated;

insert into public.blocks (blocker_id, blocked_id)
values (:'alex', :'mei');

do $$
declare
  seen int;
begin
  select count(*) into seen from public.listings where title = 'Cordless stick vacuum';
  if seen <> 0 then
    raise exception 'blocker can still see the blocked listing';
  end if;
end $$;

reset role;
select set_config('request.jwt.claim.sub', :'mei', false);
set role authenticated;

do $$
declare
  seen int;
begin
  select count(*) into seen from public.listings where title = 'White cube shelf';
  if seen <> 0 then
    raise exception 'blocked member can still see the blocker listing';
  end if;
end $$;

reset role;
begin;
select set_config('bb.privileged', 'on', true);
update public.profiles
set verification_status = 'not_submitted'
where id = :'alex';
commit;

select set_config('bb.privileged', 'off', false);
select set_config('request.jwt.claim.sub', :'alex', false);
set role authenticated;

with doc as (
  select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid as id
)
insert into storage.objects (bucket_id, name, owner_id)
select 'verification-docs', :'alex' || '/' || id::text || '.jpg', :'alex'
from doc;

insert into public.verification_submissions (user_id, community_id, storage_path, file_name, mime_type)
values (
  :'alex',
  :'sky',
  :'alex' || '/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg',
  'bill.jpg',
  'image/jpeg'
);

do $$
begin
  if (select verification_status::text from public.profiles where id = '11111111-1111-4111-8111-111111111111') <> 'submitted' then
    raise exception 'submission did not move the profile to submitted';
  end if;
end $$;

reset role;
select set_config('request.jwt.claim.sub', :'mei', false);
set role authenticated;

do $$
declare
  seen int;
begin
  select count(*) into seen from public.verification_submissions;
  if seen <> 0 then
    raise exception 'another member can read a verification file record';
  end if;
  select count(*) into seen from storage.objects where bucket_id = 'verification-docs';
  if seen <> 0 then
    raise exception 'another member can read a verification object';
  end if;
end $$;

do $$
begin
  begin
    perform public.admin_review_submission(
      (select id from public.verification_submissions limit 1),
      'verified',
      null
    );
    raise exception 'non-admin reviewed a submission';
  exception
    when others then
      if sqlerrm = 'non-admin reviewed a submission' then
        raise;
      end if;
  end;
end $$;

reset role;
select set_config('request.jwt.claim.sub', :'admin', false);
set role authenticated;

do $$
declare
  path text;
  sub uuid;
begin
  select id into sub from public.verification_submissions limit 1;
  if sub is null then
    raise exception 'admin cannot see the submission';
  end if;
  path := public.admin_open_submission(sub);
  if path is null or path !~ '11111111' then
    raise exception 'admin open did not return the owner path';
  end if;
  if not exists (select 1 from public.audit_log where action = 'opened_document') then
    raise exception 'opening a document was not audited';
  end if;
  perform public.admin_review_submission(sub, 'action_needed', null);
  raise exception 'action needed without a note succeeded';
exception
  when others then
    if sqlerrm <> 'a note is required' and sqlerrm <> 'action needed without a note succeeded' then
      -- The perform raises inside the block and we want that specific error.
      if sqlerrm <> 'a note is required' then
        raise;
      end if;
    end if;
end $$;

do $$
declare
  sub uuid;
begin
  select id into sub from public.verification_submissions limit 1;
  perform public.admin_review_submission(sub, 'verified', null);
  if (select verification_status::text from public.profiles where id = '11111111-1111-4111-8111-111111111111') <> 'verified' then
    raise exception 'approve did not verify the member';
  end if;
  if not exists (select 1 from public.audit_log where action = 'review_submission') then
    raise exception 'review was not audited';
  end if;
end $$;

reset role;

-- Retention: a decision older than 90 days loses its object. A fresh one stays.
begin;
select set_config('bb.privileged', 'on', true);
update public.profiles
set verification_status = 'not_submitted'
where id = :'mei';
commit;

select set_config('bb.privileged', 'off', false);
select set_config('request.jwt.claim.sub', :'mei', false);
set role authenticated;

insert into storage.objects (bucket_id, name, owner_id)
values (
  'verification-docs',
  :'mei' || '/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.jpg',
  :'mei'
);

insert into public.verification_submissions (user_id, community_id, storage_path, file_name, mime_type)
values (
  :'mei',
  :'sky',
  :'mei' || '/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.jpg',
  'old.jpg',
  'image/jpeg'
);

reset role;
begin;
select set_config('bb.privileged', 'on', true);
update public.verification_submissions
set status = 'verified',
    decided_at = now() - interval '91 days',
    decided_by = :'admin'
where storage_path like '%bbbbbbbb%';
commit;

select private.purge_expired_verification_docs();

do $$
begin
  if exists (
    select 1 from storage.objects
    where name like '%bbbbbbbb%'
  ) then
    raise exception 'expired verification object was kept';
  end if;
  if (
    select document_deleted_at is null
    from public.verification_submissions
    where storage_path like '%bbbbbbbb%'
  ) then
    raise exception 'expired submission was not marked deleted';
  end if;
  if exists (
    select 1 from public.verification_submissions
    where storage_path like '%aaaaaaaa%'
      and document_deleted_at is not null
  ) then
    raise exception 'a fresh decision was purged';
  end if;
end $$;

-- Chat is private to the two people, and a block stops it in both directions.
begin;
select set_config('bb.privileged', 'on', true);
update public.profiles
set verification_status = 'verified'
where id = :'mei';
commit;

select set_config('bb.privileged', 'off', false);
select set_config('request.jwt.claim.sub', :'alex', false);
set role authenticated;

-- Alex blocked Mei above, so this must fail. Unblock first.
delete from public.blocks
where blocker_id = :'alex' and blocked_id = :'mei';

insert into public.conversations (community_id, user_low, user_high)
values (:'sky', least(:'alex', :'mei')::uuid, greatest(:'alex', :'mei')::uuid);

insert into public.messages (conversation_id, sender_id, body)
select id, :'alex', 'Can I collect it from the lobby?'
from public.conversations
where user_low = least(:'alex', :'mei')::uuid;

do $$
begin
  begin
    insert into public.messages (conversation_id, sender_id, body)
    select id, '11111111-1111-4111-8111-111111111111', 'I am at #08-112'
    from public.conversations
    limit 1;
    raise exception 'unit number message was stored';
  exception
    when others then
      if sqlerrm = 'unit number message was stored' then
        raise;
      end if;
  end;
end $$;

reset role;
select set_config('request.jwt.claim.sub', :'farah', false);
set role authenticated;

do $$
declare
  seen int;
begin
  select count(*) into seen from public.messages;
  if seen <> 0 then
    raise exception 'a third member can read a private chat';
  end if;
end $$;

reset role;
select set_config('request.jwt.claim.sub', :'mei', false);
set role authenticated;

insert into public.blocks (blocker_id, blocked_id)
values (:'mei', :'alex');

do $$
declare
  seen int;
begin
  select count(*) into seen from public.messages;
  if seen <> 0 then
    raise exception 'messages stay visible after a block';
  end if;
end $$;

reset role;
select set_config('bb.privileged', 'on', false);
select 'rls smoke passed' as result;
