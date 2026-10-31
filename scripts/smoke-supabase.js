import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required");

const makeClient = () => createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});

const host = makeClient();
const guest = makeClient();

async function call(client, name, parameters) {
  const { data, error } = await client.rpc(name, parameters);
  if (error) throw error;
  return data;
}

const hostFleet = [
  { length: 3, row: 0, col: 0, orientation: "h" },
  { length: 2, row: 2, col: 0, orientation: "h" },
  { length: 2, row: 4, col: 0, orientation: "h" }
];

const guestFleet = [
  { length: 3, row: 0, col: 0, orientation: "v" },
  { length: 2, row: 0, col: 2, orientation: "v" },
  { length: 2, row: 0, col: 4, orientation: "v" }
];

try {
  const hostAuth = await host.auth.signInAnonymously();
  const guestAuth = await guest.auth.signInAnonymously();
  assert.ifError(hostAuth.error);
  assert.ifError(guestAuth.error);

  const created = await call(host, "create_game", { p_mode: "quick", p_host_name: "  Fleet   Tester  " });
  await call(guest, "join_game", { p_game_id: created.game_id, p_join_token: created.join_token });

  const forbiddenFleetRead = await host.from("fleets").select("ships");
  assert.ok(forbiddenFleetRead.error, "hidden fleets must not be directly readable");

  await call(host, "submit_fleet", { p_game_id: created.game_id, p_ships: hostFleet });
  let hostState = await call(host, "get_game_state", { p_game_id: created.game_id });
  assert.equal(hostState.game.status, "placing");
  assert.equal(hostState.game.host_name, "Fleet Tester");
  assert.deepEqual(hostState.opponent_fleet, []);

  await call(guest, "submit_fleet", { p_game_id: created.game_id, p_ships: guestFleet });
  hostState = await call(host, "get_game_state", { p_game_id: created.game_id });
  assert.equal(hostState.game.status, "active");
  assert.equal(hostState.game.current_turn, hostAuth.data.user.id);
  assert.deepEqual(hostState.own_fleet, hostFleet);

  let resolveRealtime;
  const realtimeEvent = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Realtime shot event timed out")), 20000);
    resolveRealtime = (payload) => { clearTimeout(timeout); resolve(payload); };
  });
  const channel = host
    .channel(`smoke:${created.game_id}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "shots", filter: `game_id=eq.${created.game_id}` }, (payload) => resolveRealtime({ source: "shots", payload }))
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${created.game_id}` }, (payload) => resolveRealtime({ source: "games", payload }));
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Realtime subscription timed out")), 20000);
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") { clearTimeout(timeout); resolve(); }
      if (status === "CHANNEL_ERROR") { clearTimeout(timeout); reject(new Error("Realtime subscription failed")); }
    });
  });

  const shot = await call(host, "fire_shot", { p_game_id: created.game_id, p_row: 0, p_col: 0 });
  assert.equal(shot.result, "hit");
  const visibleShots = await host.from("shots").select("row,col,result").eq("game_id", created.game_id);
  assert.ifError(visibleShots.error);
  assert.equal(visibleShots.data.length, 1);
  const event = await realtimeEvent;
  assert.ok(["games", "shots"].includes(event.source));
  if (event.source === "shots") {
    assert.equal(event.payload.new.row, 0);
    assert.equal(event.payload.new.col, 0);
  }

  let guestState = await call(guest, "get_game_state", { p_game_id: created.game_id });
  assert.equal(guestState.game.current_turn, guestAuth.data.user.id);
  assert.equal(guestState.shots.length, 1);
  assert.equal(guestState.shots[0].result, "hit");

  const remainingTargets = [
    [1, 0], [2, 0],
    [0, 2], [1, 2],
    [0, 4], [1, 4]
  ];
  const guestMisses = [[6, 6], [6, 5], [6, 4], [6, 3], [6, 2], [6, 1]];
  for (let index = 0; index < remainingTargets.length; index += 1) {
    await call(guest, "fire_shot", { p_game_id: created.game_id, p_row: guestMisses[index][0], p_col: guestMisses[index][1] });
    await call(host, "fire_shot", { p_game_id: created.game_id, p_row: remainingTargets[index][0], p_col: remainingTargets[index][1] });
  }

  hostState = await call(host, "get_game_state", { p_game_id: created.game_id });
  guestState = await call(guest, "get_game_state", { p_game_id: created.game_id });
  assert.equal(hostState.game.status, "completed");
  assert.equal(hostState.game.winner_id, hostAuth.data.user.id);
  assert.deepEqual(hostState.opponent_fleet, guestFleet);
  assert.deepEqual(guestState.opponent_fleet, hostFleet);
  const completedStateBytes = Buffer.byteLength(JSON.stringify(hostState));

  await host.removeChannel(channel);
  console.log(`Completed quick-game state: ${completedStateBytes} bytes for ${hostState.shots.length} shots.`);
  console.log("Supabase smoke test passed: names, fleet privacy, readiness, turns, completion reveal, and realtime.");
} finally {
  await Promise.allSettled([host.removeAllChannels(), guest.removeAllChannels()]);
  host.realtime.disconnect();
  guest.realtime.disconnect();
  await Promise.allSettled([host.auth.signOut(), guest.auth.signOut()]);
}
