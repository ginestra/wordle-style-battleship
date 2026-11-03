import test from "node:test";
import assert from "node:assert/strict";
import { gameProgress, opponentHitCount } from "../src/assets/js/fleet-progress.js";

test("game progress queues aggregate hits and marks only sunk ships", () => {
  assert.deepEqual(gameProgress([3, 2, 2], 4, [2]), {
    hits: 4,
    total: 7,
    hitMarkers: [true, true, true, true, false, false, false],
    ships: [
      { length: 3, sunk: false },
      { length: 2, sunk: true },
      { length: 2, sunk: false }
    ]
  });
});

test("opponent hit count ignores misses and incoming shots", () => {
  const shots = [
    { by_me: true, result: "hit" },
    { by_me: true, result: "miss" },
    { by_me: true, result: "sunk" },
    { by_me: true, result: "hit" },
    { by_me: false, result: "hit" }
  ];

  assert.equal(opponentHitCount(shots), 3);
});

test("game progress clamps impossible hit totals", () => {
  assert.equal(gameProgress([2], 9).hits, 2);
  assert.equal(gameProgress([2], -1).hits, 0);
});
