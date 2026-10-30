import { copyText, showToast } from "./ui.js";
import { GAME_MODES, cellAt, coordinate, createBoard, dailySeed, fleetCells, randomFleet, seededRandom } from "./game-rules.js";

const root = document.querySelector("[data-daily-root]");
if (root) initialiseDaily();

function initialiseDaily() {
  const today = dailySeed();
  const config = GAME_MODES.standard;
  const seed = `fleet-daily-v1:${today}`;
  const fleet = randomFleet("standard", seededRandom(seed));
  const occupied = fleetCells(fleet);
  const storageKey = `fleet-daily-v1:${today}`;
  const saved = parseProgress(localStorage.getItem(storageKey));
  const shots = saved?.shots || [];
  const board = root.querySelector("[data-daily-board]");
  const cells = createBoard(board, config.size, { onSelect: fire, label: "unknown water" });

  root.querySelector("[data-daily-number]").textContent = puzzleNumber(today);
  root.querySelector("[data-daily-date]").textContent = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${today}T12:00:00Z`));
  renderFleet();
  render();

  function fire(row, col) {
    if (isComplete() || shots.some((shot) => shot.row === row && shot.col === col)) return;
    const target = occupied.find((cell) => cell.row === row && cell.col === col);
    shots.push({ row, col, shipIndex: target?.shipIndex ?? null });
    localStorage.setItem(storageKey, JSON.stringify({ shots }));
    render();
    showToast(target ? (isShipSunk(target.shipIndex) ? "Ship sunk" : "Hit") : "Miss");
  }

  function isShipSunk(shipIndex) {
    const shipCells = occupied.filter((cell) => cell.shipIndex === shipIndex);
    return shipCells.every((target) => shots.some((shot) => shot.row === target.row && shot.col === target.col));
  }

  function isComplete() {
    return fleet.every((_, index) => isShipSunk(index));
  }

  function render() {
    cells.forEach((cell) => {
      cell.className = "board-cell";
      cell.disabled = false;
      const row = Number(cell.dataset.row);
      const col = Number(cell.dataset.col);
      const shot = shots.find((item) => item.row === row && item.col === col);
      if (!shot) return;
      cell.disabled = true;
      if (shot.shipIndex === null) cell.classList.add("is-miss");
      else cell.classList.add(isShipSunk(shot.shipIndex) ? "is-sunk" : "is-hit");
      cell.setAttribute("aria-label", `${coordinate(row, col)}, ${shot.shipIndex === null ? "miss" : isShipSunk(shot.shipIndex) ? "sunk ship" : "hit"}`);
    });

    const sunk = fleet.filter((_, index) => isShipSunk(index)).length;
    root.querySelector("[data-shot-count]").textContent = shots.length;
    root.querySelector("[data-sunk-count]").textContent = `${sunk}/${fleet.length}`;
    renderFleet();

    const status = root.querySelector("[data-daily-status]");
    const share = root.querySelector("[data-share-result]");
    if (isComplete()) {
      status.innerHTML = `<strong>Fleet sunk in ${shots.length} shots.</strong><span>Come back tomorrow for new waters.</span>`;
      share.hidden = false;
      share.onclick = () => copyText(shareText(), "Result copied");
      root.querySelector("[data-next-game]").textContent = nextGameText();
    }
  }

  function renderFleet() {
    const list = root.querySelector("[data-daily-fleet]");
    list.replaceChildren();
    fleet.forEach((ship, index) => {
      const row = document.createElement("div");
      row.className = `fleet-item${isShipSunk(index) ? " is-placed" : ""}`;
      const blocks = Array.from({ length: ship.length }, () => "<i></i>").join("");
      row.innerHTML = `<button type="button" tabindex="-1" aria-label="Ship length ${ship.length}${isShipSunk(index) ? ", sunk" : ""}">${blocks}</button><span>${isShipSunk(index) ? "Sunk" : "Afloat"}</span>`;
      list.append(row);
    });
  }

  function shareText() {
    const markers = shots.map((shot) => shot.shipIndex === null ? "⬜" : isShipSunk(shot.shipIndex) ? "🟪" : "🟥");
    const rows = [];
    for (let index = 0; index < markers.length; index += 10) rows.push(markers.slice(index, index + 10).join(""));
    return `FLEET DAILY #${puzzleNumber(today)} — ${shots.length} shots\n${rows.join("\n")}`;
  }
}

function parseProgress(value) {
  try { return value ? JSON.parse(value) : null; } catch { return null; }
}

function puzzleNumber(dateString) {
  const epoch = Date.parse("2026-01-01T00:00:00Z");
  return Math.floor((Date.parse(`${dateString}T00:00:00Z`) - epoch) / 86400000) + 1;
}

function nextGameText() {
  const now = new Date();
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const minutes = Math.max(0, Math.floor((midnight - now.getTime()) / 60000));
  return `Next game in ${Math.floor(minutes / 60)}h ${minutes % 60}m (UTC).`;
}
