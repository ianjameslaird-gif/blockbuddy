-- Community names, slugs and resident labels are public. The register screen
-- lists them before a session exists, so anon may select this table.
-- Other public tables stay closed to anon. There is no write grant.
-- Idempotent. Re-running 20261115140000_schema.sql revokes this grant;
-- run this file again afterwards.

grant select on table public.communities to anon;

drop policy if exists communities_select_anon on public.communities;
create policy communities_select_anon on public.communities
  for select
  to anon
  using (slug <> '');
