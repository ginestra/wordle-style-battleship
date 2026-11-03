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
  v_neighbour_row integer;
  v_neighbour_col integer;
  v_occupied text[] := array[]::text[];
  v_ship_cells text[];
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
    v_ship_cells := array[]::text[];
    if v_orientation not in ('h', 'v') then return false; end if;

    for v_offset in 0..v_length - 1 loop
      v_cell_row := v_row + (case when v_orientation = 'v' then v_offset else 0 end);
      v_cell_col := v_col + (case when v_orientation = 'h' then v_offset else 0 end);
      v_cell := v_cell_row::text || ':' || v_cell_col::text;
      if v_cell_row < 0 or v_cell_col < 0 or v_cell_row >= v_size or v_cell_col >= v_size then return false; end if;

      for v_neighbour_row in v_cell_row - 1..v_cell_row + 1 loop
        for v_neighbour_col in v_cell_col - 1..v_cell_col + 1 loop
          if (v_neighbour_row::text || ':' || v_neighbour_col::text) = any(v_occupied) then return false; end if;
        end loop;
      end loop;

      v_ship_cells := array_append(v_ship_cells, v_cell);
    end loop;
    v_occupied := v_occupied || v_ship_cells;
  end loop;
  return true;
exception when others then
  return false;
end;
$$;
