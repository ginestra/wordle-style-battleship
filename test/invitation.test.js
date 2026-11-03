import test from "node:test";
import assert from "node:assert/strict";
import { clearHostInvitation, loadHostInvitation, parseInvitationHash, saveHostInvitation } from "../src/assets/js/invitation.js";

const gameId = "12345678-1234-1234-1234-123456789abc";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
}

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

test("a host invitation survives reload until its room expires", () => {
  const storage = memoryStorage();
  const now = Date.parse("2026-11-03T12:00:00Z");
  const expiresAt = "2026-11-04T12:00:00Z";
  const url = `https://example.com/multiplayer/#game=${gameId}&join=secret`;

  assert.equal(saveHostInvitation(storage, { gameId, url, expiresAt }, now), true);
  assert.equal(loadHostInvitation(storage, gameId, now + 1000), url);
  assert.equal(loadHostInvitation(storage, gameId, Date.parse(expiresAt)), null);
});

test("stored invitations must match their room and can be cleared", () => {
  const storage = memoryStorage();
  const now = Date.parse("2026-11-03T12:00:00Z");
  const expiresAt = "2026-11-04T12:00:00Z";
  const wrongUrl = "https://example.com/multiplayer/#game=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa&join=secret";
  assert.equal(saveHostInvitation(storage, { gameId, url: wrongUrl, expiresAt }, now), false);
  assert.equal(saveHostInvitation(storage, { gameId, url: `https://example.com/#game=${gameId}`, expiresAt: "invalid" }, now), false);

  const url = `https://example.com/multiplayer/#game=${gameId}&join=secret`;
  saveHostInvitation(storage, { gameId, url, expiresAt }, now);
  clearHostInvitation(storage, gameId, now);
  assert.equal(loadHostInvitation(storage, gameId, now), null);
});
