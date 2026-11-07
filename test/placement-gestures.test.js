import test from "node:test";
import assert from "node:assert/strict";
import { draggedShipPosition, keyboardMovedShip, PlacementGestures } from "../src/assets/js/placement-gestures.js";

test("keyboard arrows move a placed ship one square", () => {
  const ship = { length: 3, row: 4, col: 4, orientation: "h" };
  assert.deepEqual(keyboardMovedShip(ship, "ArrowLeft"), { ...ship, col: 3 });
  assert.deepEqual(keyboardMovedShip(ship, "ArrowRight"), { ...ship, col: 5 });
  assert.deepEqual(keyboardMovedShip(ship, "ArrowUp"), { ...ship, row: 3 });
  assert.deepEqual(keyboardMovedShip(ship, "ArrowDown"), { ...ship, row: 5 });
});

test("keyboard movement ignores unplaced ships and unrelated keys", () => {
  assert.equal(keyboardMovedShip({ row: null, col: null }, "ArrowRight"), null);
  assert.equal(keyboardMovedShip({ row: 2, col: 2 }, "Enter"), null);
});

test("a horizontal drag keeps the grabbed ship section under the pointer", () => {
  assert.deepEqual(draggedShipPosition(4, 5, "h", 2), { row: 4, col: 3 });
});

test("a vertical drag keeps the grabbed ship section under the pointer", () => {
  assert.deepEqual(draggedShipPosition(5, 4, "v", 2), { row: 3, col: 4 });
});

function dragSetup(source = "list") {
  const element = (area, dataset = {}) => ({
    area,
    dataset,
    style: { setProperty() {} },
    addEventListener() {},
    append() {},
    remove() {},
    contains(target) { return target?.area === area; },
    closest(selector) {
      if (selector === "[data-drag-ship]") return this.dataset.dragShip === undefined ? null : this;
      if (selector === "[data-placement-board] .board-cell") return this.area === "board" ? this : null;
      return null;
    }
  });
  const board = element("board");
  const list = element("list");
  const handle = element(source, { dragShip: "0", shipOffset: "1" });
  const listTarget = element("list");
  const cell = element("board", { row: "4", col: "5" });
  let beneath = cell;
  const drops = [];
  const documentRef = {
    body: { append() {} },
    defaultView: { setTimeout, clearTimeout },
    addEventListener() {},
    removeEventListener() {},
    elementFromPoint() { return beneath; },
    createElement() { return element("ghost"); }
  };
  const gestures = new PlacementGestures({
    board,
    list,
    documentRef,
    getShip: () => ({ length: 3, orientation: "h" }),
    canStart: () => true,
    onStart() {},
    onPreview() {},
    onListPreview() {},
    onClearPreview() {},
    onBoardDrop: (...args) => drops.push(["board", ...args]),
    onListDrop: (...args) => drops.push(["list", ...args]),
    onEnd() {}
  });
  const down = { pointerId: 1, pointerType: "mouse", button: 0, clientX: 0, clientY: 0, target: handle };
  const move = { pointerId: 1, clientX: 20, clientY: 20, preventDefault() {} };
  return { gestures, down, move, drops, hoverList: () => { beneath = listTarget; } };
}

test("a ship dragged from the fleet anchors its first section to the drop square", () => {
  const { gestures, down, move, drops } = dragSetup();
  gestures.handlePointerDown(down);
  gestures.handlePointerMove(move);
  gestures.handlePointerEnd({ pointerId: 1, type: "pointerup" });
  assert.deepEqual(drops, [["board", 0, 4, 5, 0]]);
});

test("a ship moved on the board preserves the grabbed section", () => {
  const { gestures, down, move, drops } = dragSetup("board");
  gestures.handlePointerDown(down);
  gestures.handlePointerMove(move);
  gestures.handlePointerEnd({ pointerId: 1, type: "pointerup" });
  assert.deepEqual(drops, [["board", 0, 4, 5, 1]]);
});

test("dragging back to the fleet reports a list drop", () => {
  const { gestures, down, move, drops, hoverList } = dragSetup();
  gestures.handlePointerDown(down);
  hoverList();
  gestures.handlePointerMove(move);
  gestures.handlePointerEnd({ pointerId: 1, type: "pointerup" });
  assert.deepEqual(drops, [["list", 0]]);
});

test("a cancelled pointer gesture never moves the ship", () => {
  const { gestures, down, move, drops } = dragSetup();
  gestures.handlePointerDown(down);
  gestures.handlePointerMove(move);
  gestures.handlePointerEnd({ pointerId: 1, type: "pointercancel" });
  assert.deepEqual(drops, []);
});
