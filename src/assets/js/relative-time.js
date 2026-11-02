export function opponentMoveTime(value, now = new Date(), locale) {
  if (!value) return null;
  const movedAt = new Date(value);
  if (Number.isNaN(movedAt.getTime())) return null;

  const elapsedMinutes = Math.max(0, Math.floor((now.getTime() - movedAt.getTime()) / 60000));
  let relative;
  if (elapsedMinutes < 1) relative = "just now";
  else if (elapsedMinutes < 60) relative = `${elapsedMinutes} min ago`;
  else {
    const hours = Math.floor(elapsedMinutes / 60);
    relative = `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  }

  const sameDay = movedAt.getFullYear() === now.getFullYear()
    && movedAt.getMonth() === now.getMonth()
    && movedAt.getDate() === now.getDate();
  const shortFormat = sameDay
    ? { hour: "numeric", minute: "2-digit" }
    : { dateStyle: "medium", timeStyle: "short" };
  const shortTime = new Intl.DateTimeFormat(locale, shortFormat).format(movedAt);
  const exactTime = new Intl.DateTimeFormat(locale, { dateStyle: "full", timeStyle: "short" }).format(movedAt);

  return {
    text: `Opponent moved ${relative} · ${shortTime}`,
    dateTime: movedAt.toISOString(),
    accessibleText: `Opponent last moved ${exactTime}`
  };
}
