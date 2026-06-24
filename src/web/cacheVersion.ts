declare const __APP_VERSION__: string;

const VERSION_STORAGE_KEY = "active-etf:app-version";
const RELOAD_GUARD_KEY = "active-etf:version-reload-pending";

async function clearBrowserCaches(): Promise<void> {
  if ("caches" in window) {
    const cacheNames = await window.caches.keys();
    await Promise.all(cacheNames.map((cacheName) => window.caches.delete(cacheName)));
  }

  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }
}

async function latestDeployedVersion(): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 1500);

  const response = await fetch(`/app-version.json?t=${Date.now()}`, {
    cache: "no-store",
    signal: controller.signal,
    headers: {
      "Cache-Control": "no-cache"
    }
  });
  window.clearTimeout(timeoutId);

  if (!response.ok) return null;
  const body = (await response.json()) as { version?: unknown };
  return typeof body.version === "string" ? body.version : null;
}

export async function reloadWhenAppVersionChanges(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  try {
    const deployedVersion = await latestDeployedVersion();
    if (!deployedVersion) return;

    const storedVersion = window.localStorage.getItem(VERSION_STORAGE_KEY);
    const pendingReload = window.sessionStorage.getItem(RELOAD_GUARD_KEY);

    if (!storedVersion) {
        window.localStorage.setItem(VERSION_STORAGE_KEY, deployedVersion);
        return false;
      }

      if (storedVersion !== deployedVersion && pendingReload !== deployedVersion) {
        window.sessionStorage.setItem(RELOAD_GUARD_KEY, deployedVersion);
        window.localStorage.setItem(VERSION_STORAGE_KEY, deployedVersion);
        await clearBrowserCaches();
        window.location.reload();
        return true;
      }

      if (storedVersion === deployedVersion && pendingReload === deployedVersion) {
        window.sessionStorage.removeItem(RELOAD_GUARD_KEY);
      }
  } catch {
    if (!window.localStorage.getItem(VERSION_STORAGE_KEY)) {
      window.localStorage.setItem(VERSION_STORAGE_KEY, __APP_VERSION__);
    }
  }

  return false;
}
