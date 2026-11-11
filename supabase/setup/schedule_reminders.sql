-- Runs the send-reminders Edge Function every morning at 9 AM Mountain time
-- (16:00 UTC, so 9 AM in winter and 10 AM in summer). Run once in the SQL Editor
-- AFTER the function is deployed and its CRON_SECRET secret is set.
--
-- Before running: replace the two placeholders below.
--   YOUR-PROJECT-REF  -> hrcthuqltodogsglfatt
--   PASTE-CRON-SECRET -> the same value you saved as the CRON_SECRET function secret
-- The secret is stored in Supabase Vault (encrypted), not in this file. Don't commit
-- this file with the real secret pasted in.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Re-running? Delete the old values first:
--   delete from vault.secrets where name in ('reminders_url', 'reminders_cron_secret');
select vault.create_secret('https://YOUR-PROJECT-REF.supabase.co/functions/v1/send-reminders', 'reminders_url');
select vault.create_secret('PASTE-CRON-SECRET', 'reminders_cron_secret');

select cron.unschedule('send-maintenance-reminders')
where exists (select 1 from cron.job where jobname = 'send-maintenance-reminders');

select cron.schedule(
  'send-maintenance-reminders',
  '0 16 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'reminders_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'reminders_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- Check it: select jobname, schedule, active from cron.job;
-- See runs:  select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;
-- Function replies: select status_code, content from net._http_response order by created desc limit 5;
