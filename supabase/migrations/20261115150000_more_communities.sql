-- Add the five nearest named HDB projects to SkyPeak as BlockBuddy communities,
-- and let sign-up pick a community via user metadata 'community_slug'
-- (falls back to SkyPeak when missing or unknown).
insert into public.communities (name, slug, resident_label) values
  ('Golden Daisy', 'golden-daisy', 'Golden Daisy resident'),
  ('Skyline II @ Bukit Batok', 'skyline-ii-bukit-batok', 'Skyline II @ Bukit Batok resident'),
  ('Skyline I @ Bukit Batok', 'skyline-i-bukit-batok', 'Skyline I @ Bukit Batok resident'),
  ('Sky Vista @ Bukit Batok', 'sky-vista-bukit-batok', 'Sky Vista @ Bukit Batok resident'),
  ('West Terra @ Bukit Batok', 'west-terra-bukit-batok', 'West Terra @ Bukit Batok resident')
on conflict (slug) do update
set name = excluded.name,
    resident_label = excluded.resident_label;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  comm uuid;
  chosen text;
  wanted text;
begin
  wanted := btrim(coalesce(new.raw_user_meta_data ->> 'community_slug', ''));
  if wanted <> '' then
    select id into comm from public.communities where slug = wanted;
  end if;

  if comm is null then
    select id into comm
    from public.communities
    where slug = 'skypeak-bukit-batok';
  end if;

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
