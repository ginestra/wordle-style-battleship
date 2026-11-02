export function shouldRefreshGame(currentUpdatedAt, payload) {
  const incomingUpdatedAt = payload?.new?.updated_at;
  if (!currentUpdatedAt || !incomingUpdatedAt) return true;
  return incomingUpdatedAt !== currentUpdatedAt;
}
