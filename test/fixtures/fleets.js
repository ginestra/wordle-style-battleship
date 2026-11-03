export const validQuickFleets = Object.freeze({
  host: Object.freeze([
    { length: 3, row: 0, col: 0, orientation: "h" },
    { length: 2, row: 2, col: 0, orientation: "h" },
    { length: 2, row: 4, col: 0, orientation: "h" }
  ]),
  guest: Object.freeze([
    { length: 3, row: 0, col: 0, orientation: "v" },
    { length: 2, row: 0, col: 2, orientation: "v" },
    { length: 2, row: 0, col: 4, orientation: "v" }
  ])
});

export const invalidQuickFleets = Object.freeze([
  {
    label: "overlapping ships",
    ships: [
      { length: 3, row: 0, col: 0, orientation: "h" },
      { length: 2, row: 0, col: 2, orientation: "v" },
      { length: 2, row: 4, col: 0, orientation: "h" }
    ]
  },
  {
    label: "ships touching at an edge",
    ships: [
      { length: 3, row: 0, col: 0, orientation: "h" },
      { length: 2, row: 1, col: 0, orientation: "h" },
      { length: 2, row: 4, col: 0, orientation: "h" }
    ]
  },
  {
    label: "ships touching diagonally",
    ships: [
      { length: 3, row: 0, col: 0, orientation: "h" },
      { length: 2, row: 1, col: 3, orientation: "v" },
      { length: 2, row: 4, col: 0, orientation: "h" }
    ]
  },
  {
    label: "ship outside the board",
    ships: [
      { length: 3, row: 0, col: 0, orientation: "h" },
      { length: 2, row: 2, col: 0, orientation: "h" },
      { length: 2, row: 6, col: 6, orientation: "h" }
    ]
  },
  {
    label: "incorrect fleet composition",
    ships: [
      { length: 3, row: 0, col: 0, orientation: "h" },
      { length: 3, row: 2, col: 0, orientation: "h" },
      { length: 2, row: 4, col: 0, orientation: "h" }
    ]
  }
]);
