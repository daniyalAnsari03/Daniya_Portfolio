-- Ask AI cleanup schedule (Chatbot step 8).
--
-- Schedules the daily 90-day chat cleanup with pg_cron. The job deletes every
-- conversation whose last message is older than 90 days (its messages
-- cascade) plus stale rate-limit windows, by calling the
-- `public.purge_old_chats(90)` function created in 008_chat.sql. This file
-- only schedules the job — it does not change the function or the grants
-- from 008.
--
-- Run this manually in the Supabase SQL editor. The app never runs
-- migrations. If "create extension" is not permitted, enable pg_cron in the
-- Supabase Dashboard (Database -> Extensions) first, then re-run this file.

create extension if not exists pg_cron;

-- Idempotent: if a job named 'purge-old-chats' already exists, unschedule it
-- so scheduling it again below never duplicates the job.
do $$
begin
  if exists (select from cron.job where jobname = 'purge-old-chats') then
    perform cron.unschedule(jobid)
      from cron.job
      where jobname = 'purge-old-chats';
  end if;
end;
$$;

-- Daily at 03:00 UTC.
select cron.schedule(
  'purge-old-chats',
  '0 3 * * *',
  $$select public.purge_old_chats(90)$$
);
