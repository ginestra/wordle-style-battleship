import { anonymisedShipProgress, fleetCells, shipHitCount } from "./game-rules.js";

export function fleetProgress(ships, shots) {
  const occupied = fleetCells(ships);
  return ships.map((ship, shipIndex) => {
    const hits = shipHitCount(occupied, shots, shipIndex);
    return {
      length: ship.length,
      hits,
      sunk: hits === ship.length,
      markers: anonymisedShipProgress(ship.length, hits)
    };
  });
}

export function renderFleetProgress(list, ships, shots) {
  list.replaceChildren();
  fleetProgress(ships, shots).forEach(({ length, hits, sunk, markers }) => {
    const row = document.createElement("div");
    row.className = `fleet-item fleet-progress-item${sunk ? " is-sunk" : ""}`;
    const visual = document.createElement("div");
    visual.className = "fleet-progress-ship";
    visual.setAttribute("role", "img");
    visual.setAttribute("aria-label", `Ship length ${length}, ${sunk ? "sunk" : `${hits} of ${length} sections hit`}`);
    markers.forEach((hit) => {
      const block = document.createElement("i");
      if (sunk) block.className = "is-sunk";
      else if (hit) block.className = "is-hit";
      visual.append(block);
    });
    const status = document.createElement("span");
    status.textContent = sunk ? "Sunk" : hits ? `${hits}/${length} hit` : "Afloat";
    row.append(visual, status);
    list.append(row);
  });
}

export function attackProgress(lengths, shots) {
  const total = lengths.reduce((sum, length) => sum + length, 0);
  const hits = Math.min(total, shots.filter((shot) => shot.by_me && ["hit", "sunk"].includes(shot.result)).length);
  let remaining = hits;
  const rows = lengths.map((length) => {
    const rowHits = Math.min(length, remaining);
    remaining -= rowHits;
    return { length, markers: anonymisedShipProgress(length, rowHits) };
  });
  return { hits, total, rows };
}

export function renderAttackProgress(list, lengths, shots) {
  const progress = attackProgress(lengths, shots);
  list.replaceChildren();
  list.setAttribute("role", "img");
  list.setAttribute("aria-label", `${progress.hits} of ${progress.total} opposing fleet sections hit`);

  const total = document.createElement("strong");
  total.className = "attack-progress-total";
  total.textContent = `${progress.hits}/${progress.total} hits`;
  list.append(total);

  progress.rows.forEach(({ markers }) => {
    const visual = document.createElement("div");
    visual.className = "fleet-progress-ship attack-progress-row";
    visual.setAttribute("aria-hidden", "true");
    markers.forEach((hit) => {
      const block = document.createElement("i");
      if (hit) block.className = "is-hit";
      visual.append(block);
    });
    list.append(visual);
  });
}
