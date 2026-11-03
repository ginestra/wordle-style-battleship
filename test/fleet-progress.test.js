import test from "node:test";
import assert from "node:assert/strict";
import { fleetProgress } from "../src/assets/js/fleet-progress.js";

test("fleet progress counts incoming hits per ship without exposing positions", () => {
  const ships = [
    { length: 3, row: 0, col: 0, orientation: "h" },
    { length: 2, row: 2, col: 0, orientation: "v" }
  ];
  const shots = [
    { row: 0, col: 2, result: "hit" },
    { row: 2, col: 0, result: "hit" },
    { row: 3, col: 0, result: "sunk" },
    { row: 6, col: 6, result: "miss" }
  ];

  assert.deepEqual(fleetProgress(ships, shots), [
    { length: 3, hits: 1, sunk: false, markers: [true, false, false] },
    { length: 2, hits: 2, sunk: true, markers: [true, true] }
  ]);
});
