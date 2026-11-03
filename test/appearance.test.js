import test from "node:test";
import assert from "node:assert/strict";
import { nextAppearance, normaliseAppearance, STYLES, THEMES } from "../src/assets/js/appearance.js";

test("appearance values fall back when storage contains an unknown option", () => {
  assert.equal(normaliseAppearance("dark", THEMES, "system"), "dark");
  assert.equal(normaliseAppearance("neon", THEMES, "system"), "system");
  assert.equal(normaliseAppearance("neon", STYLES, "minimal"), "minimal");
});

test("appearance controls cycle and wrap independently", () => {
  assert.equal(nextAppearance("system", THEMES), "light");
  assert.equal(nextAppearance("dark", THEMES), "system");
  assert.equal(nextAppearance("minimal", STYLES), "colourful");
  assert.equal(nextAppearance("colourful", STYLES), "minimal");
});
