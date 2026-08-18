export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "theme";

const THEME_EVENT = "themechange";
const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Runs before first paint, so the page never flashes the wrong theme. Kept as a
 * string because it has to be inlined into the document head by hand — the
 * bundled React tree only hydrates after the browser has already painted.
 */
export const themeBootstrapScript = `
(function () {
  var theme = "light";
  try {
    var saved = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    theme =
      saved === "light" || saved === "dark"
        ? saved
        : matchMedia(${JSON.stringify(DARK_QUERY)}).matches
          ? "dark"
          : "light";
  } catch (e) {}
  document.documentElement.dataset.theme = theme;
})();
`.trim();

function systemTheme(): Theme {
  return matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

function readStoredTheme(): Theme | null {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === "light" || saved === "dark" ? saved : null;
  } catch {
    return null;
  }
}

/**
 * The live theme lives on the <html> element, not in React state — the
 * bootstrap script above sets it before React exists. This exposes it as an
 * external store so components can read it without a setState-in-effect dance.
 */
export const themeStore = {
  subscribe(onChange: () => void): () => void {
    const media = matchMedia(DARK_QUERY);
    const onSystemChange = () => {
      // An explicit choice wins; otherwise keep following the OS.
      if (readStoredTheme() !== null) return;
      document.documentElement.dataset.theme = systemTheme();
      onChange();
    };
    media.addEventListener("change", onSystemChange);
    window.addEventListener(THEME_EVENT, onChange);
    return () => {
      media.removeEventListener("change", onSystemChange);
      window.removeEventListener(THEME_EVENT, onChange);
    };
  },

  getSnapshot(): Theme {
    return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  },

  // Unknowable while rendering on the server, and guessing would paint the
  // wrong icon for half of all visitors.
  getServerSnapshot(): null {
    return null;
  },
};

export function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private browsing and the like — the toggle still works for this visit.
  }
  window.dispatchEvent(new Event(THEME_EVENT));
}
