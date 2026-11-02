import test from "node:test";
import assert from "node:assert/strict";
import { parseInvitationHash } from "../src/assets/js/invitation.js";

test("invitation fields are decoded from the URL hash", () => {
  assert.deepEqual(parseInvitationHash("#game=room%201&join=secret%2Btoken&player=guest"), {
    gameId: "room 1",
    joinToken: "secret+token",
    player: "guest"
  });
});

test("an empty hash produces an empty invitation", () => {
  assert.deepEqual(parseInvitationHash(""), {
    gameId: null,
    joinToken: null,
    player: null
  });
});
