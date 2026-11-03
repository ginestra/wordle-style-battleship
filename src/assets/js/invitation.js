export function parseInvitationHash(hash) {
  const parameters = new URLSearchParams(String(hash || "").replace(/^#/, ""));
  return {
    gameId: parameters.get("game"),
    joinToken: parameters.get("join"),
    player: parameters.get("player")
  };
}

const hostInvitationsKey = "fleet-host-invitations";
const gameIdPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export function saveHostInvitation(storage, { gameId, url, expiresAt }, now = Date.now()) {
  if (!validInvitation(gameId, url, expiresAt, now)) return false;
  try {
    const invitations = readHostInvitations(storage, now);
    invitations[gameId] = { url, expiresAt };
    storage.setItem(hostInvitationsKey, JSON.stringify(invitations));
    return true;
  } catch {
    return false;
  }
}

export function loadHostInvitation(storage, gameId, now = Date.now()) {
  if (!gameIdPattern.test(String(gameId || ""))) return null;
  try {
    const invitations = readHostInvitations(storage, now);
    const invitation = invitations[gameId];
    return invitation && validInvitation(gameId, invitation.url, invitation.expiresAt, now) ? invitation.url : null;
  } catch {
    return null;
  }
}

export function clearHostInvitation(storage, gameId, now = Date.now()) {
  if (!gameIdPattern.test(String(gameId || ""))) return;
  try {
    const invitations = readHostInvitations(storage, now);
    delete invitations[gameId];
    if (Object.keys(invitations).length) storage.setItem(hostInvitationsKey, JSON.stringify(invitations));
    else storage.removeItem(hostInvitationsKey);
  } catch {
    // Storage can be unavailable in restrictive browsing modes.
  }
}

function readHostInvitations(storage, now) {
  let parsed = {};
  try { parsed = JSON.parse(storage.getItem(hostInvitationsKey) || "{}"); } catch { parsed = {}; }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return Object.fromEntries(
    Object.entries(parsed).filter(([gameId, invitation]) =>
      validInvitation(gameId, invitation?.url, invitation?.expiresAt, now)
    )
  );
}

function validInvitation(gameId, url, expiresAt, now) {
  const expiry = Date.parse(expiresAt);
  if (!gameIdPattern.test(String(gameId || "")) || typeof url !== "string" || !Number.isFinite(expiry) || expiry <= now) return false;
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) && parseInvitationHash(parsed.hash).gameId === gameId;
  } catch {
    return false;
  }
}
