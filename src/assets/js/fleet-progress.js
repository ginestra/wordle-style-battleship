import { anonymisedShipProgress } from "./game-rules.js";

export function opponentHitCount(shots) {
  return shots.filter((shot) => shot.by_me && ["hit", "sunk"].includes(shot.result)).length;
}

export function gameProgress(lengths, hits, sunkLengths = []) {
  const total = lengths.reduce((sum, length) => sum + length, 0);
  const safeHits = Math.max(0, Math.min(total, hits));
  const unmatchedSunkLengths = [...sunkLengths];
  const ships = lengths.map((length) => {
    const sunkIndex = unmatchedSunkLengths.indexOf(length);
    const sunk = sunkIndex >= 0;
    if (sunk) unmatchedSunkLengths.splice(sunkIndex, 1);
    return { length, sunk };
  });

  return {
    hits: safeHits,
    total,
    hitMarkers: anonymisedShipProgress(total, safeHits),
    ships
  };
}

export function renderGameProgress(container, { lengths, hits, sunkLengths = [], label = "Fleet" }) {
  const progress = gameProgress(lengths, hits, sunkLengths);
  container.replaceChildren();
  container.setAttribute("role", "group");
  container.setAttribute("aria-label", `${label}: ${progress.hits} of ${progress.total} sections hit`);

  const total = document.createElement("strong");
  total.className = "game-progress-total";
  total.textContent = `${progress.hits}/${progress.total} hits`;

  const queue = document.createElement("div");
  queue.className = "hit-queue";
  queue.setAttribute("role", "img");
  queue.setAttribute("aria-label", `${progress.hits} hits, ${progress.total - progress.hits} remaining`);
  progress.hitMarkers.forEach((hit) => {
    const marker = document.createElement("i");
    if (hit) marker.className = "is-hit";
    queue.append(marker);
  });

  const fleet = document.createElement("div");
  fleet.className = "progress-fleet-list";
  progress.ships.forEach(({ length, sunk }) => {
    const row = document.createElement("div");
    row.className = `fleet-item fleet-progress-item${sunk ? " is-sunk" : ""}`;
    const visual = document.createElement("div");
    visual.className = "fleet-progress-ship";
    visual.setAttribute("role", "img");
    visual.setAttribute("aria-label", `Ship length ${length}, ${sunk ? "sunk" : "afloat"}`);
    for (let index = 0; index < length; index += 1) {
      const block = document.createElement("i");
      if (sunk) block.className = "is-sunk";
      visual.append(block);
    }
    const status = document.createElement("span");
    status.textContent = sunk ? "Sunk" : "Afloat";
    row.append(visual, status);
    fleet.append(row);
  });

  container.append(total, queue, fleet);
}
