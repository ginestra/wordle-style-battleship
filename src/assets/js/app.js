import { nextAppearance, normaliseAppearance, STYLES, THEMES } from "./appearance.js";

const themeButton = document.querySelector("[data-theme-toggle]");
const themeIcon = document.querySelector("[data-theme-icon]");
const styleButton = document.querySelector("[data-style-toggle]");
const styleIcon = document.querySelector("[data-style-icon]");
const styleLabel = document.querySelector("[data-style-label]");

function updateBrowserColour() {
  const colour = getComputedStyle(document.documentElement).getPropertyValue("--paper").trim();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && colour) meta.content = colour;
}

function setTheme(theme) {
  const resolved = normaliseAppearance(theme, THEMES, "system");
  document.documentElement.dataset.theme = resolved;
  localStorage.setItem("fleet-theme", resolved);
  if (themeIcon) themeIcon.textContent = resolved === "light" ? "☀" : resolved === "dark" ? "●" : "◐";
  if (themeButton) themeButton.setAttribute("aria-label", `Colour theme: ${resolved}. Click to change.`);
  if (themeButton) themeButton.title = `Colour theme: ${resolved}`;
  updateBrowserColour();
}

function setStyle(style) {
  const resolved = normaliseAppearance(style, STYLES, "minimal");
  document.documentElement.dataset.style = resolved;
  localStorage.setItem("fleet-style", resolved);
  if (styleIcon) styleIcon.textContent = resolved === "colourful" ? "◆" : "◇";
  if (styleLabel) styleLabel.textContent = resolved === "colourful" ? "Colourful" : "Minimal";
  if (styleButton) styleButton.setAttribute("aria-label", `Visual style: ${resolved}. Click to change.`);
  if (styleButton) styleButton.title = `Visual style: ${resolved}`;
  updateBrowserColour();
}

setTheme(localStorage.getItem("fleet-theme") || "system");
setStyle(localStorage.getItem("fleet-style") || "minimal");
themeButton?.addEventListener("click", () => {
  const current = document.documentElement.dataset.theme;
  setTheme(nextAppearance(current, THEMES));
});
styleButton?.addEventListener("click", () => {
  const current = document.documentElement.dataset.style;
  setStyle(nextAppearance(current, STYLES));
});
window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener?.("change", updateBrowserColour);
