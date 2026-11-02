alter table public.games
  add column completion_reason text
  check (completion_reason in ('resignation'));

create or replace function public.resign_game(p_game_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_game public.games%rowtype;
  v_winner uuid;
begin
  if v_user is null then raise exception 'authentication required'; end if;

  select * into v_game from public.games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.status <> 'active' then raise exception 'game is not active'; end if;
  if not exists (select 1 from public.game_players where game_id = p_game_id and user_id = v_user) then
    raise exception 'game not found';
  end if;

  select user_id into v_winner
  from public.game_players
  where game_id = p_game_id and user_id <> v_user;
  if v_winner is null then raise exception 'opponent not found'; end if;

  update public.games
  set status = 'completed',
      winner_id = v_winner,
      current_turn = null,
      completion_reason = 'resignation',
      updated_at = now()
  where id = p_game_id;

  return jsonb_build_object('winner', v_winner, 'reason', 'resignation');
end;
$$;

create or replace function public.get_game_state_v2(p_game_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_result jsonb;
begin
  if v_user is null or not exists (select 1 from public.game_players where game_id = p_game_id and user_id = v_user) then raise exception 'game not found'; end if;
  select jsonb_build_object(
    'game', jsonb_build_object('id', g.id, 'room_code', g.room_code, 'host_name', g.host_name, 'mode', g.mode, 'status', g.status, 'current_turn', g.current_turn, 'winner_id', g.winner_id, 'completion_reason', g.completion_reason, 'updated_at', g.updated_at, 'expires_at', g.expires_at),
    'players', coalesce((select jsonb_agg(jsonb_build_object('user_id', p.user_id, 'seat', p.seat, 'ready', p.ready) order by p.seat) from public.game_players p where p.game_id = g.id), '[]'::jsonb),
    'own_fleet', coalesce((select f.ships from public.fleets f where f.game_id = g.id and f.user_id = v_user), '[]'::jsonb),
    'opponent_fleet', case when g.status = 'completed' then coalesce((select f.ships from public.fleets f where f.game_id = g.id and f.user_id <> v_user), '[]'::jsonb) else '[]'::jsonb end,
    'last_opponent_move_at', (select s.created_at from public.shots s where s.game_id = g.id and s.shooter_id <> v_user order by s.turn_number desc limit 1),
    'shots', coalesce((select jsonb_agg(jsonb_build_object('by_me', s.shooter_id = v_user, 'row', s.row, 'col', s.col, 'result', s.result) order by s.turn_number) from public.shots s where s.game_id = g.id), '[]'::jsonb)
  ) into v_result from public.games g where g.id = p_game_id;
  if v_result is null then raise exception 'game not found'; end if;
  return v_result;
end;
$$;

revoke execute on function public.resign_game(uuid) from public, anon;
grant execute on function public.resign_game(uuid) to authenticated;
