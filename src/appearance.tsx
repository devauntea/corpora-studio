import { useSyncExternalStore } from "react";
import { SunMoon } from "lucide-react";
export type Appearance = "system" | "light" | "dark";
const key = "form-studio-appearance";
const media = window.matchMedia("(prefers-color-scheme: dark)");
function read(): Appearance {
  try {
    const value = localStorage.getItem(key);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}
let preference = read();
const listeners = new Set<() => void>();
function apply() {
  const resolved =
    preference === "system" ? (media.matches ? "dark" : "light") : preference;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
}
function publish() {
  apply();
  for (const listener of listeners) listener();
}
// This runs before React mounts, including when a saved preference is restored.
apply();
media.addEventListener("change", () => {
  if (preference === "system") publish();
});
window.addEventListener("storage", (event) => {
  if (event.key === key || event.key === null) {
    preference = read();
    publish();
  }
});
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function choose(value: Appearance) {
  preference = value;
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Appearance still works when storage is unavailable. */
  }
  publish();
}
export function AppearanceControl() {
  const value = useSyncExternalStore(subscribe, () => preference);
  return (
    <label
      className="appearance-control"
      title="Appearance — follows your device or stays light/dark"
    >
      <SunMoon size={15} aria-hidden="true" />
      <span className="sr-only">Appearance</span>
      <select
        aria-label="Appearance"
        value={value}
        onChange={(event) => choose(event.target.value as Appearance)}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}
