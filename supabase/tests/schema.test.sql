begin;

select plan(7);

select has_table('public', 'games', 'games table exists');
select has_table('public', 'game_players', 'game players table exists');
select has_table('public', 'fleets', 'fleets table exists');
select has_table('public', 'shots', 'shots table exists');
select has_function('public', 'create_game', array['text', 'text'], 'game creation RPC exists');
select has_function('public', 'get_game_state_v2', array['uuid'], 'compact game-state RPC exists');
select hasnt_function('public', 'get_game_state', array['uuid'], 'legacy game-state RPC is retired');

select * from finish();
rollback;
