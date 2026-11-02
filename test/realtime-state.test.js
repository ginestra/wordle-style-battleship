import test from "node:test";
import assert from "node:assert/strict";
import { shouldRefreshGame } from "../src/assets/js/realtime-state.js";

test("ignores a realtime revision that is already rendered", () => {
  const updatedAt = "2026-11-02T14:00:00.123456+00:00";
  assert.equal(shouldRefreshGame(updatedAt, { new: { updated_at: updatedAt } }), false);
});

test("refreshes when the game revision changes", () => {
  assert.equal(shouldRefreshGame(
    "2026-11-02T14:00:00.123456+00:00",
    { new: { updated_at: "2026-11-02T14:01:00.654321+00:00" } }
  ), true);
});

test("refreshes conservatively when a revision is unavailable", () => {
  assert.equal(shouldRefreshGame(null, { new: { updated_at: "2026-11-02T14:01:00+00:00" } }), true);
  assert.equal(shouldRefreshGame("2026-11-02T14:00:00+00:00", { old: {} }), true);
});
