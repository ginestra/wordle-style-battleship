export function showToast(message, duration = 2600) {
  const region = document.querySelector("[data-toast-region]");
  if (!region) return;
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  region.append(toast);
  window.setTimeout(() => toast.remove(), duration);
}

export async function copyText(value, successMessage = "Copied") {
  try {
    await navigator.clipboard.writeText(value);
    showToast(successMessage);
  } catch {
    const input = document.createElement("textarea");
    input.value = value;
    document.body.append(input);
    input.select();
    document.execCommand("copy");
    input.remove();
    showToast(successMessage);
  }
}
