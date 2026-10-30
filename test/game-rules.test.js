import test from "node:test";
import assert from "node:assert/strict";
import { GAME_MODES, canPlaceShip, cellsForShip, dailySeed, randomFleet, seededRandom, validateFleet } from "../src/assets/js/game-rules.js";

test("horizontal and vertical ships occupy the expected cells", () => {
  assert.deepEqual(cellsForShip({ length: 3, row: 1, col: 2, orientation: "h" }), [
    { row: 1, col: 2 }, { row: 1, col: 3 }, { row: 1, col: 4 }
  ]);
  assert.deepEqual(cellsForShip({ length: 2, row: 3, col: 4, orientation: "v" }), [
    { row: 3, col: 4 }, { row: 4, col: 4 }
  ]);
});

test("placement rejects overlap and board overflow", () => {
  const ships = [{ length: 3, row: 0, col: 0, orientation: "h" }];
  assert.equal(canPlaceShip({ length: 2, row: 0, col: 2, orientation: "v" }, ships, 7), false);
  assert.equal(canPlaceShip({ length: 2, row: 6, col: 6, orientation: "h" }, ships, 7), false);
  assert.equal(canPlaceShip({ length: 2, row: 4, col: 4, orientation: "h" }, ships, 7), true);
});

test("random fleets are deterministic and valid", () => {
  for (const mode of Object.keys(GAME_MODES)) {
    const first = randomFleet(mode, seededRandom(`test:${mode}`));
    const second = randomFleet(mode, seededRandom(`test:${mode}`));
    assert.deepEqual(first, second);
    assert.equal(validateFleet(mode, first), true);
  }
});

test("daily seed uses a UTC calendar date", () => {
  assert.equal(dailySeed(new Date("2026-10-30T23:59:59Z")), "2026-10-30");
});
