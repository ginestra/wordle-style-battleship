import test from "node:test";
import assert from "node:assert/strict";
import { authStorageKeyForHash } from "../src/assets/js/supabase-client.js";

const gameId = "12345678-1234-1234-1234-123456789abc";

test("an invitation uses a room-specific guest auth session", () => {
  assert.equal(
    authStorageKeyForHash(`#game=${gameId}&join=private-token`),
    `fleet-guest-${gameId}`
  );
});

test("a joined guest keeps the same auth session after the invitation token is removed", () => {
  assert.equal(
    authStorageKeyForHash(`#game=${gameId}&player=guest`),
    `fleet-guest-${gameId}`
  );
});

test("the room creator continues to use the existing default auth session", () => {
  assert.equal(authStorageKeyForHash(`#game=${gameId}`), null);
});

test("malformed game identifiers cannot become auth storage keys", () => {
  assert.equal(authStorageKeyForHash("#game=../../other&player=guest"), null);
});
