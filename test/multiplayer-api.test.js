import test from "node:test";
import assert from "node:assert/strict";
import { MultiplayerApi } from "../src/assets/js/multiplayer-api.js";

test("multiplayer API maps game actions to their RPC contracts", async () => {
  const calls = [];
  const api = new MultiplayerApi(async (name, parameters) => {
    calls.push({ name, parameters });
    return { ok: true };
  });
  const fleet = [{ length: 2, row: 0, col: 0, orientation: "h" }];

  await api.createGame("quick", "Gi");
  await api.joinGame("game-id", "join-token");
  await api.getState("game-id");
  await api.submitFleet("game-id", fleet);
  await api.fireShot("game-id", 2, 3);
  await api.resignGame("game-id");

  assert.deepEqual(calls, [
    { name: "create_game", parameters: { p_mode: "quick", p_host_name: "Gi" } },
    { name: "join_game", parameters: { p_game_id: "game-id", p_join_token: "join-token" } },
    { name: "get_game_state_v2", parameters: { p_game_id: "game-id" } },
    { name: "submit_fleet", parameters: { p_game_id: "game-id", p_ships: fleet } },
    { name: "fire_shot", parameters: { p_game_id: "game-id", p_row: 2, p_col: 3 } },
    { name: "resign_game", parameters: { p_game_id: "game-id" } }
  ]);
});
