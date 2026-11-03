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
