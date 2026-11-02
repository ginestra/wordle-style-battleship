import test from "node:test";
import assert from "node:assert/strict";
import { nextBoardCellIndex, syncBoardTabStops } from "../src/assets/js/game-rules.js";

function cells(count, disabled = []) {
  return Array.from({ length: count }, (_, index) => ({
    disabled: disabled.includes(index),
    tabIndex: -1
  }));
}

test("arrow navigation moves within board rows and columns", () => {
  const board = cells(9);
  assert.equal(nextBoardCellIndex(board, 3, 4, "ArrowLeft"), 3);
  assert.equal(nextBoardCellIndex(board, 3, 4, "ArrowRight"), 5);
  assert.equal(nextBoardCellIndex(board, 3, 4, "ArrowUp"), 1);
  assert.equal(nextBoardCellIndex(board, 3, 4, "ArrowDown"), 7);
});

test("board navigation does not wrap and skips unavailable squares", () => {
  const board = cells(9, [1, 2, 5]);
  assert.equal(nextBoardCellIndex(board, 3, 0, "ArrowRight"), 0);
  assert.equal(nextBoardCellIndex(board, 3, 8, "ArrowRight"), 8);
  assert.equal(nextBoardCellIndex(board, 3, 8, "ArrowUp"), 8);
  assert.equal(nextBoardCellIndex(board, 3, 6, "ArrowRight"), 7);
});

test("Home and End choose the first available square in the row", () => {
  const board = cells(9, [3, 5]);
  assert.equal(nextBoardCellIndex(board, 3, 4, "Home"), 4);
  assert.equal(nextBoardCellIndex(board, 3, 4, "End"), 4);
  assert.equal(nextBoardCellIndex(cells(9, [3]), 3, 5, "Home"), 4);
});

test("a board keeps one enabled tab stop", () => {
  const board = cells(4, [0]);
  assert.equal(syncBoardTabStops(board), 1);
  assert.deepEqual(board.map((cell) => cell.tabIndex), [-1, 0, -1, -1]);

  board[1].disabled = true;
  assert.equal(syncBoardTabStops(board), 2);
  assert.deepEqual(board.map((cell) => cell.tabIndex), [-1, -1, 0, -1]);
});

test("a fully unavailable board has no tab stop", () => {
  const board = cells(3, [0, 1, 2]);
  assert.equal(syncBoardTabStops(board), -1);
  assert.deepEqual(board.map((cell) => cell.tabIndex), [-1, -1, -1]);
});
