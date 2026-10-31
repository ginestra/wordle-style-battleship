alter table public.games
  add column host_name text not null default 'A friend';

alter table public.games
  add constraint games_host_name_length check (char_length(host_name) between 1 and 32);

drop function public.create_game(text);

create function public.create_game(p_mode text, p_host_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_game_id uuid;
  v_room_code text;
  v_join_token text;
  v_host_name text;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if p_mode not in ('quick', 'standard') then raise exception 'invalid game mode'; end if;
  v_host_name := regexp_replace(btrim(p_host_name), '[[:space:]]+', ' ', 'g');
  if char_length(v_host_name) not between 1 and 32 then raise exception 'invalid host name'; end if;
  v_room_code := upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 6));
  v_join_token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.games (room_code, host_name, join_token_hash, mode)
  values (v_room_code, v_host_name, encode(extensions.digest(v_join_token, 'sha256'), 'hex'), p_mode)
  returning id into v_game_id;
  insert into public.game_players (game_id, user_id, seat) values (v_game_id, v_user, 1);
  return jsonb_build_object('game_id', v_game_id, 'room_code', v_room_code, 'join_token', v_join_token);
exception when unique_violation then
  raise exception 'room collision; please try again';
end;
$$;

create or replace function public.get_game_state(p_game_id uuid)
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
    'game', jsonb_build_object('id', g.id, 'room_code', g.room_code, 'host_name', g.host_name, 'mode', g.mode, 'status', g.status, 'current_turn', g.current_turn, 'winner_id', g.winner_id, 'expires_at', g.expires_at),
    'players', coalesce((select jsonb_agg(jsonb_build_object('user_id', p.user_id, 'seat', p.seat, 'ready', p.ready) order by p.seat) from public.game_players p where p.game_id = g.id), '[]'::jsonb),
    'own_fleet', coalesce((select f.ships from public.fleets f where f.game_id = g.id and f.user_id = v_user), '[]'::jsonb),
    'opponent_fleet', case when g.status = 'completed' then coalesce((select f.ships from public.fleets f where f.game_id = g.id and f.user_id <> v_user), '[]'::jsonb) else '[]'::jsonb end,
    'shots', coalesce((select jsonb_agg(jsonb_build_object('shooter_id', s.shooter_id, 'target_id', s.target_id, 'row', s.row, 'col', s.col, 'result', s.result, 'turn_number', s.turn_number) order by s.turn_number) from public.shots s where s.game_id = g.id), '[]'::jsonb)
  ) into v_result from public.games g where g.id = p_game_id;
  if v_result is null then raise exception 'game not found'; end if;
  return v_result;
end;
$$;

revoke execute on function public.create_game(text, text) from public, anon;
grant execute on function public.create_game(text, text) to authenticated;
