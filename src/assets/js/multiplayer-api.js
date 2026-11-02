import { rpc } from "./supabase-client.js";

export class MultiplayerApi {
  constructor(call = rpc) {
    this.call = call;
  }

  createGame(mode, hostName) {
    return this.call("create_game", { p_mode: mode, p_host_name: hostName });
  }

  joinGame(gameId, joinToken) {
    return this.call("join_game", { p_game_id: gameId, p_join_token: joinToken });
  }

  getState(gameId) {
    return this.call("get_game_state_v2", { p_game_id: gameId });
  }

  submitFleet(gameId, ships) {
    return this.call("submit_fleet", { p_game_id: gameId, p_ships: ships });
  }

  fireShot(gameId, row, col) {
    return this.call("fire_shot", { p_game_id: gameId, p_row: row, p_col: col });
  }
}
