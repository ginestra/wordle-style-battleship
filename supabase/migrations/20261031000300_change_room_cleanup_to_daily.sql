select cron.schedule(
  'delete-expired-battleship-rooms',
  '17 3 * * *',
  $$delete from public.games where expires_at < now()$$
);
