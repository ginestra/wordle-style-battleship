import test from "node:test";
import assert from "node:assert/strict";
import { hasMyShotAt, shotTargetsMe } from "../src/assets/js/shot-state.js";

test("maps compact shots to the correct board", () => {
  assert.equal(shotTargetsMe({ by_me: false }), true);
  assert.equal(shotTargetsMe({ by_me: true }), false);
});

test("detects only coordinates previously targeted by this player", () => {
  const shots = [
    { by_me: true, row: 2, col: 3, result: "miss" },
    { by_me: false, row: 4, col: 5, result: "hit" }
  ];
  assert.equal(hasMyShotAt(shots, 2, 3), true);
  assert.equal(hasMyShotAt(shots, 4, 5), false);
  assert.equal(hasMyShotAt(shots, 0, 0), false);
});
