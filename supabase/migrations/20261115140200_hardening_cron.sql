-- Pin search_path on the unit-number helpers (Supabase security advisor) and
-- schedule the daily 90-day verification-document purge with pg_cron.
alter function public.contains_unit_number(text) set search_path = '';
alter function public.no_unit_number(text) set search_path = '';

create extension if not exists pg_cron with schema pg_catalog;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'purge-verification-docs') then
    perform cron.unschedule('purge-verification-docs');
  end if;
  perform cron.schedule(
    'purge-verification-docs',
    '15 3 * * *',
    'select private.purge_expired_verification_docs()'
  );
end $$;
