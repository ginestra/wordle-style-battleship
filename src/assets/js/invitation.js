export function parseInvitationHash(hash) {
  const parameters = new URLSearchParams(String(hash || "").replace(/^#/, ""));
  return {
    gameId: parameters.get("game"),
    joinToken: parameters.get("join"),
    player: parameters.get("player")
  };
}
