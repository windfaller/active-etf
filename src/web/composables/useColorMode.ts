import { computed, ref } from "vue";

export type ColorMode = "light" | "dark";

export const COLOR_MODE_STORAGE_KEY = "active-etf-color-mode";

const colorMode = ref<ColorMode>("light");
let initialized = false;

export function resolveInitialColorMode(storedMode: string | null, prefersDark: boolean): ColorMode {
  if (storedMode === "light" || storedMode === "dark") return storedMode;
  return prefersDark ? "dark" : "light";
}

function applyColorMode(mode: ColorMode): void {
  document.documentElement.dataset.theme = mode;
  document.documentElement.style.colorScheme = mode;
}

export function initializeColorMode(): void {
  if (initialized || typeof window === "undefined") return;
  let storedMode: string | null = null;
  try {
    storedMode = window.localStorage.getItem(COLOR_MODE_STORAGE_KEY);
  } catch {
    storedMode = null;
  }
  colorMode.value = resolveInitialColorMode(storedMode, window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false);
  applyColorMode(colorMode.value);
  initialized = true;
}

export function useColorMode() {
  initializeColorMode();

  function toggleColorMode(): void {
    colorMode.value = colorMode.value === "dark" ? "light" : "dark";
    applyColorMode(colorMode.value);
    try {
      window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, colorMode.value);
    } catch {
      // The selected mode still applies for the current session when storage is unavailable.
    }
  }

  return {
    colorMode,
    isDarkMode: computed(() => colorMode.value === "dark"),
    toggleColorMode
  };
}
