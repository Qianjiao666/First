export const THEME_STORAGE_KEY = "mkj-theme-v1";

export const THEMES = Object.freeze({
  "tech-light": Object.freeze({ label: "科技浅色" }),
  "tech-dark": Object.freeze({ label: "科技暗色" }),
  "fresh-blue": Object.freeze({ label: "清新蓝调" }),
});

const DEFAULT_THEME = "tech-light";

function validTheme(value) {
  return typeof value === "string" && Object.hasOwn(THEMES, value) ? value : DEFAULT_THEME;
}

export function createThemeController({
  storage = globalThis.localStorage,
  documentRef = globalThis.document,
} = {}) {
  const listeners = new Set();
  let current = DEFAULT_THEME;

  try {
    current = validTheme(storage?.getItem?.(THEME_STORAGE_KEY));
  } catch {
    current = DEFAULT_THEME;
  }

  function apply(theme) {
    if (documentRef?.documentElement?.dataset) {
      documentRef.documentElement.dataset.theme = theme;
    }
  }

  function getTheme() {
    return current;
  }

  function setTheme(value) {
    const next = validTheme(value);
    current = next;
    apply(next);
    try {
      storage?.setItem?.(THEME_STORAGE_KEY, next);
    } catch {
      // The visual preference still applies for this page when storage is unavailable.
    }
    for (const listener of listeners) listener(next);
    return next;
  }

  function subscribeTheme(listener, { immediate = false } = {}) {
    if (typeof listener !== "function") return () => {};
    listeners.add(listener);
    if (immediate) listener(current);
    return () => listeners.delete(listener);
  }

  apply(current);
  return { getTheme, setTheme, subscribeTheme };
}

const controller = createThemeController();

export const getTheme = controller.getTheme;
export const setTheme = controller.setTheme;
export const subscribeTheme = controller.subscribeTheme;

if (typeof window !== "undefined") window.MKJTheme = controller;
