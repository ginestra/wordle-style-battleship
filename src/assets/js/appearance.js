export const THEMES = Object.freeze(["system", "light", "dark"]);
export const STYLES = Object.freeze(["minimal", "colourful"]);

export function normaliseAppearance(value, choices, fallback) {
  return choices.includes(value) ? value : fallback;
}

export function nextAppearance(current, choices) {
  const index = choices.indexOf(current);
  return choices[(index + 1) % choices.length];
}
