export const GAME_MODES = Object.freeze({
  quick: Object.freeze({ size: 7, fleet: Object.freeze([3, 2, 2]) }),
  standard: Object.freeze({ size: 10, fleet: Object.freeze([5, 4, 3, 3, 2]) })
});

export function cellsForShip(ship) {
  return Array.from({ length: ship.length }, (_, offset) => ({
    row: ship.row + (ship.orientation === "v" ? offset : 0),
    col: ship.col + (ship.orientation === "h" ? offset : 0)
  }));
}

export function fleetCells(ships) {
  return ships.flatMap((ship, shipIndex) => cellsForShip(ship).map((cell) => ({ ...cell, shipIndex })));
}

export function canPlaceShip(ship, ships, boardSize, ignoreIndex = -1) {
  const candidate = cellsForShip(ship);
  if (candidate.some(({ row, col }) => row < 0 || col < 0 || row >= boardSize || col >= boardSize)) return false;

  const occupied = new Set(
    ships.flatMap((other, index) => index === ignoreIndex ? [] : cellsForShip(other))
      .map(({ row, col }) => `${row}:${col}`)
  );
  return candidate.every(({ row, col }) => !occupied.has(`${row}:${col}`));
}

export function validateFleet(mode, ships) {
  const config = GAME_MODES[mode];
  if (!config || ships.length !== config.fleet.length) return false;
  const expected = [...config.fleet].sort((a, b) => a - b);
  const actual = ships.map(({ length }) => length).sort((a, b) => a - b);
  if (!expected.every((length, index) => length === actual[index])) return false;
  return ships.every((ship, index) => canPlaceShip(ship, ships, config.size, index));
}

export function randomFleet(mode, random = Math.random) {
  const config = GAME_MODES[mode];
  if (!config) throw new Error("Unknown game mode");

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const ships = [];
    let failed = false;
    for (const length of config.fleet) {
      let placed = false;
      for (let shipAttempt = 0; shipAttempt < 300; shipAttempt += 1) {
        const orientation = random() < .5 ? "h" : "v";
        const row = Math.floor(random() * config.size);
        const col = Math.floor(random() * config.size);
        const ship = { length, row, col, orientation };
        if (canPlaceShip(ship, ships, config.size)) {
          ships.push(ship);
          placed = true;
          break;
        }
      }
      if (!placed) { failed = true; break; }
    }
    if (!failed) return ships;
  }
  throw new Error("Could not generate a fleet");
}

export function createBoard(element, size, { interactive = true, onSelect, label = "water" } = {}) {
  element.replaceChildren();
  element.style.setProperty("--board-size", size);
  const cells = [];

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const cell = document.createElement(interactive ? "button" : "span");
      cell.className = "board-cell";
      if (interactive) cell.type = "button";
      cell.dataset.row = row;
      cell.dataset.col = col;
      cell.setAttribute("aria-label", `${String.fromCharCode(65 + col)}${row + 1}, ${label}`);
      if (onSelect) cell.addEventListener("click", () => onSelect(row, col));
      element.append(cell);
      cells.push(cell);
    }
  }
  return cells;
}

export function cellAt(cells, size, row, col) {
  return cells[(row * size) + col];
}

export function seededRandom(seed) {
  let state = hashString(seed)();
  return () => {
    state |= 0;
    state = state + 0x6D2B79F5 | 0;
    let value = Math.imul(state ^ state >>> 15, 1 | state);
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function hashString(value) {
  let hash = 1779033703 ^ value.length;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 3432918353);
    hash = hash << 13 | hash >>> 19;
  }
  return () => {
    hash = Math.imul(hash ^ hash >>> 16, 2246822507);
    hash = Math.imul(hash ^ hash >>> 13, 3266489909);
    return (hash ^= hash >>> 16) >>> 0;
  };
}

export function dailySeed(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function coordinate(row, col) {
  return `${String.fromCharCode(65 + col)}${row + 1}`;
}
