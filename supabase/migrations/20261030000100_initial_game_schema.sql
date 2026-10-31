create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.games (
  id uuid primary key default gen_random_uuid(),
  room_code text not null unique check (room_code ~ '^[A-F0-9]{6}$'),
  host_name text not null check (char_length(host_name) between 1 and 32),
  join_token_hash text not null,
  mode text not null check (mode in ('quick', 'standard')),
  status text not null default 'waiting' check (status in ('waiting', 'placing', 'active', 'completed')),
  current_turn uuid,
  winner_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);

create table public.game_players (
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null,
  seat smallint not null check (seat in (1, 2)),
  ready boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (game_id, user_id),
  unique (game_id, seat)
);

create table public.fleets (
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null,
  ships jsonb not null,
  created_at timestamptz not null default now(),
  primary key (game_id, user_id),
  foreign key (game_id, user_id) references public.game_players(game_id, user_id) on delete cascade
);

create table public.shots (
  id bigint generated always as identity primary key,
  game_id uuid not null references public.games(id) on delete cascade,
  shooter_id uuid not null,
  target_id uuid not null,
  row smallint not null check (row >= 0),
  col smallint not null check (col >= 0),
  result text not null check (result in ('miss', 'hit', 'sunk')),
  ship_index smallint,
  turn_number integer not null,
  created_at timestamptz not null default now(),
  unique (game_id, shooter_id, row, col),
  foreign key (game_id, shooter_id) references public.game_players(game_id, user_id) on delete cascade,
  foreign key (game_id, target_id) references public.game_players(game_id, user_id) on delete cascade
);

create index game_players_user_id_idx on public.game_players(user_id);
create index shots_game_id_idx on public.shots(game_id, turn_number);
create index games_expires_at_idx on public.games(expires_at);

alter table public.games enable row level security;
alter table public.game_players enable row level security;
alter table public.fleets enable row level security;
alter table public.shots enable row level security;

revoke all on public.games, public.game_players, public.fleets, public.shots from anon, authenticated;
grant select on public.games, public.game_players, public.shots to authenticated;

create or replace function private.is_game_player(p_game_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.game_players
    where game_id = p_game_id and user_id = p_user_id
  );
$$;

create policy "players can read their games"
on public.games for select to authenticated
using (exists (
  select 1 where private.is_game_player(games.id, (select auth.uid()))
));

create policy "players can read players in their games"
on public.game_players for select to authenticated
using (private.is_game_player(game_players.game_id, (select auth.uid())));

create policy "players can read shots in their games"
on public.shots for select to authenticated
using (private.is_game_player(shots.game_id, (select auth.uid())));

create or replace function private.validate_fleet(p_mode text, p_ships jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_size integer := case p_mode when 'quick' then 7 when 'standard' then 10 else 0 end;
  v_expected integer[] := case p_mode when 'quick' then array[2,2,3] when 'standard' then array[2,3,3,4,5] else array[]::integer[] end;
  v_actual integer[];
  v_ship jsonb;
  v_length integer;
  v_row integer;
  v_col integer;
  v_orientation text;
  v_offset integer;
  v_cell text;
  v_cell_row integer;
  v_cell_col integer;
  v_occupied text[] := array[]::text[];
begin
  if jsonb_typeof(p_ships) <> 'array' or jsonb_array_length(p_ships) <> cardinality(v_expected) then return false; end if;
  select array_agg((item->>'length')::integer order by (item->>'length')::integer)
    into v_actual from jsonb_array_elements(p_ships) item;
  if v_actual is distinct from v_expected then return false; end if;

  for v_ship in select value from jsonb_array_elements(p_ships) loop
    v_length := (v_ship->>'length')::integer;
    v_row := (v_ship->>'row')::integer;
    v_col := (v_ship->>'col')::integer;
    v_orientation := v_ship->>'orientation';
    if v_orientation not in ('h', 'v') then return false; end if;
    for v_offset in 0..v_length - 1 loop
      v_cell_row := v_row + (case when v_orientation = 'v' then v_offset else 0 end);
      v_cell_col := v_col + (case when v_orientation = 'h' then v_offset else 0 end);
      v_cell := v_cell_row::text || ':' || v_cell_col::text;
      if v_cell_row < 0 or v_cell_col < 0 or
         v_cell_row >= v_size or v_cell_col >= v_size or
         v_cell = any(v_occupied) then return false;
      end if;
      v_occupied := array_append(v_occupied, v_cell);
    end loop;
  end loop;
  return true;
exception when others then
  return false;
end;
$$;

create or replace function public.create_game(p_mode text, p_host_name text)
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

create or replace function public.join_game(p_game_id uuid, p_join_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_game public.games%rowtype;
  v_count integer;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  select * into v_game from public.games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.expires_at < now() then raise exception 'game expired'; end if;
  if exists (select 1 from public.game_players where game_id = p_game_id and user_id = v_user) then
    return jsonb_build_object('game_id', p_game_id, 'joined', true);
  end if;
  if encode(extensions.digest(p_join_token, 'sha256'), 'hex') <> v_game.join_token_hash then raise exception 'invalid join token'; end if;
  select count(*) into v_count from public.game_players where game_id = p_game_id;
  if v_count >= 2 then raise exception 'game is full'; end if;
  if v_game.status <> 'waiting' then raise exception 'game has already started'; end if;
  insert into public.game_players (game_id, user_id, seat) values (p_game_id, v_user, 2);
  update public.games set status = 'placing', updated_at = now() where id = p_game_id;
  return jsonb_build_object('game_id', p_game_id, 'joined', true);
end;
$$;

create or replace function public.submit_fleet(p_game_id uuid, p_ships jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_game public.games%rowtype;
  v_ready_count integer;
  v_first_player uuid;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  select * into v_game from public.games where id = p_game_id for update;
  if not found or not exists (select 1 from public.game_players where game_id = p_game_id and user_id = v_user) then raise exception 'game not found'; end if;
  if v_game.expires_at < now() then raise exception 'game expired'; end if;
  if v_game.status <> 'placing' then raise exception 'fleets cannot be changed now'; end if;
  if not private.validate_fleet(v_game.mode, p_ships) then raise exception 'invalid fleet'; end if;
  if exists (select 1 from public.game_players where game_id = p_game_id and user_id = v_user and ready) then raise exception 'fleet is already locked'; end if;

  insert into public.fleets (game_id, user_id, ships) values (p_game_id, v_user, p_ships)
  on conflict (game_id, user_id) do update set ships = excluded.ships;
  update public.game_players set ready = true where game_id = p_game_id and user_id = v_user;
  select count(*) into v_ready_count from public.game_players where game_id = p_game_id and ready;
  if v_ready_count = 2 then
    select user_id into v_first_player from public.game_players where game_id = p_game_id and seat = 1;
    update public.games set status = 'active', current_turn = v_first_player, updated_at = now() where id = p_game_id;
  else
    update public.games set updated_at = now() where id = p_game_id;
  end if;
  return jsonb_build_object('ready', true, 'started', v_ready_count = 2);
end;
$$;

create or replace function public.fire_shot(p_game_id uuid, p_row integer, p_col integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_game public.games%rowtype;
  v_target uuid;
  v_size integer;
  v_ship jsonb;
  v_ship_index integer;
  v_index integer;
  v_offset integer;
  v_cell_row integer;
  v_cell_col integer;
  v_hit boolean := false;
  v_sunk boolean := false;
  v_all_hit boolean;
  v_turn integer;
  v_total_cells integer;
  v_hit_count integer;
  v_result text;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  select * into v_game from public.games where id = p_game_id for update;
  if not found or v_game.status <> 'active' then raise exception 'game is not active'; end if;
  if v_game.expires_at < now() then raise exception 'game expired'; end if;
  if v_game.current_turn <> v_user then raise exception 'not your turn'; end if;
  v_size := case v_game.mode when 'quick' then 7 else 10 end;
  if p_row < 0 or p_col < 0 or p_row >= v_size or p_col >= v_size then raise exception 'shot is outside the board'; end if;
  select user_id into v_target from public.game_players where game_id = p_game_id and user_id <> v_user;
  if v_target is null then raise exception 'opponent not found'; end if;
  if exists (select 1 from public.shots where game_id = p_game_id and shooter_id = v_user and row = p_row and col = p_col) then raise exception 'square already targeted'; end if;

  v_index := 0;
  for v_ship in select value from jsonb_array_elements((select ships from public.fleets where game_id = p_game_id and user_id = v_target)) loop
    for v_offset in 0..(v_ship->>'length')::integer - 1 loop
      v_cell_row := (v_ship->>'row')::integer + case when v_ship->>'orientation' = 'v' then v_offset else 0 end;
      v_cell_col := (v_ship->>'col')::integer + case when v_ship->>'orientation' = 'h' then v_offset else 0 end;
      if v_cell_row = p_row and v_cell_col = p_col then v_hit := true; v_ship_index := v_index; exit; end if;
    end loop;
    exit when v_hit;
    v_index := v_index + 1;
  end loop;

  select coalesce(max(turn_number), 0) + 1 into v_turn from public.shots where game_id = p_game_id;
  v_result := case when v_hit then 'hit' else 'miss' end;
  insert into public.shots (game_id, shooter_id, target_id, row, col, result, ship_index, turn_number)
  values (p_game_id, v_user, v_target, p_row, p_col, v_result, v_ship_index, v_turn);

  if v_hit then
    select value into v_ship from jsonb_array_elements((select ships from public.fleets where game_id = p_game_id and user_id = v_target)) with ordinality as ship(value, position)
      where position = v_ship_index + 1;
    v_all_hit := true;
    for v_offset in 0..(v_ship->>'length')::integer - 1 loop
      v_cell_row := (v_ship->>'row')::integer + case when v_ship->>'orientation' = 'v' then v_offset else 0 end;
      v_cell_col := (v_ship->>'col')::integer + case when v_ship->>'orientation' = 'h' then v_offset else 0 end;
      if not exists (select 1 from public.shots where game_id = p_game_id and target_id = v_target and row = v_cell_row and col = v_cell_col and result in ('hit', 'sunk')) then
        v_all_hit := false;
      end if;
    end loop;
    if v_all_hit then
      v_sunk := true;
      v_result := 'sunk';
      update public.shots set result = 'sunk' where game_id = p_game_id and target_id = v_target and ship_index = v_ship_index;
    end if;
  end if;

  v_total_cells := case v_game.mode when 'quick' then 7 else 17 end;
  select count(*) into v_hit_count from public.shots where game_id = p_game_id and target_id = v_target and result in ('hit', 'sunk');
  if v_hit_count = v_total_cells then
    update public.games set status = 'completed', winner_id = v_user, current_turn = null, updated_at = now() where id = p_game_id;
  else
    update public.games set current_turn = v_target, updated_at = now() where id = p_game_id;
  end if;
  return jsonb_build_object('result', v_result, 'sunk', v_sunk, 'winner', case when v_hit_count = v_total_cells then v_user else null end);
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

revoke execute on function private.validate_fleet(text, jsonb) from public, anon, authenticated;
revoke execute on function private.is_game_player(uuid, uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_game_player(uuid, uuid) to authenticated;
revoke execute on function public.create_game(text, text), public.join_game(uuid, text), public.submit_fleet(uuid, jsonb), public.fire_shot(uuid, integer, integer), public.get_game_state(uuid) from public, anon;
grant execute on function public.create_game(text, text), public.join_game(uuid, text), public.submit_fleet(uuid, jsonb), public.fire_shot(uuid, integer, integer), public.get_game_state(uuid) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.games, public.game_players, public.shots;
exception when duplicate_object then null;
end $$;
