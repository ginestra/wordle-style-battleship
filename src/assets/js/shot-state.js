export function shotTargetsMe(shot) {
  return !shot.by_me;
}

export function hasMyShotAt(shots, row, col) {
  return shots.some((shot) => shot.by_me && shot.row === row && shot.col === col);
}
