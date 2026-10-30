-- Realtime evaluates table RLS as the subscribed user. It needs permission to
-- execute the membership predicate used by those policies, but receives no
-- direct access to fleet data or game writes.
grant usage on schema private to authenticated;
grant execute on function private.is_game_player(uuid, uuid) to authenticated;
