import test from "node:test";
import assert from "node:assert/strict";
import { multiplayerResult } from "../src/assets/js/multiplayer-result.js";

test("a resignation announces the winner without claiming the fleet was sunk", () => {
  const result = multiplayerResult({ winner_id: "host", completion_reason: "resignation" }, "host");
  assert.equal(result.won, true);
  assert.equal(result.resultTitle, "Your opponent resigned.");
  assert.match(result.dialogCopy, /opponent resigned/i);
});

test("the resigning player sees an explicit resignation result", () => {
  const result = multiplayerResult({ winner_id: "host", completion_reason: "resignation" }, "guest");
  assert.equal(result.won, false);
  assert.equal(result.resultTitle, "You resigned.");
  assert.match(result.resultCopy, /opponent takes the win/i);
});

test("normal completed games retain the fleet-sunk result", () => {
  const result = multiplayerResult({ winner_id: "host", completion_reason: null }, "host");
  assert.equal(result.resultTitle, "You sank the fleet.");
});
