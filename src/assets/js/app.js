const themeButton = document.querySelector("[data-theme-toggle]");
const themeIcon = document.querySelector("[data-theme-icon]");
const themes = ["system", "light", "dark"];

function setTheme(theme) {
  const resolved = themes.includes(theme) ? theme : "system";
  document.documentElement.dataset.theme = resolved;
  localStorage.setItem("fleet-theme", resolved);
  if (themeIcon) themeIcon.textContent = resolved === "light" ? "☀" : resolved === "dark" ? "●" : "◐";
  if (themeButton) themeButton.setAttribute("aria-label", `Colour theme: ${resolved}. Click to change.`);
}

setTheme(localStorage.getItem("fleet-theme") || "system");
themeButton?.addEventListener("click", () => {
  const current = document.documentElement.dataset.theme;
  setTheme(themes[(themes.indexOf(current) + 1) % themes.length]);
});
