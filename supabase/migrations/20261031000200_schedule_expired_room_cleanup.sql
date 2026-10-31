create extension if not exists pg_cron with schema pg_catalog;

create index if not exists games_expires_at_idx on public.games(expires_at);

select cron.schedule(
  'delete-expired-battleship-rooms',
  '17 * * * *',
  $$delete from public.games where expires_at < now()$$
);
