import test from "node:test";
import assert from "node:assert/strict";
import { opponentMoveTime } from "../src/assets/js/relative-time.js";

test("formats an opponent move from the current minute", () => {
  const display = opponentMoveTime("2026-11-02T12:00:20Z", new Date("2026-11-02T12:00:50Z"), "en-GB");
  assert.match(display.text, /^Opponent moved just now · /);
  assert.equal(display.dateTime, "2026-11-02T12:00:20.000Z");
  assert.match(display.accessibleText, /^Opponent last moved /);
});

test("formats elapsed minutes without making a network request", () => {
  const display = opponentMoveTime("2026-11-02T11:55:00Z", new Date("2026-11-02T12:00:00Z"), "en-GB");
  assert.match(display.text, /^Opponent moved 5 min ago · /);
});

test("returns no display for a missing or invalid timestamp", () => {
  assert.equal(opponentMoveTime(null), null);
  assert.equal(opponentMoveTime("not-a-date"), null);
});
