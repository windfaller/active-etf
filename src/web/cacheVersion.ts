declare const __APP_VERSION__: string;

const VERSION_STORAGE_KEY = "active-etf:app-version";
const RELOAD_GUARD_KEY = "active-etf:version-reload-pending";
const VERSION_QUERY_PARAM = "appVersion";
const DEFAULT_MINIMUM_CHECK_INTERVAL_MS = 60_000;

interface AppVersionWatcherWindow {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
}

export interface AppVersionWatcherOptions {
  minimumCheckIntervalMs?: number;
  /** @internal Test seam; production callers should use the default version check. */
  checkVersion?: () => Promise<boolean>;
  /** @internal Test seam for deterministic throttling. */
  now?: () => number;
}

export function buildVersionedReloadUrl(currentHref: string, deployedVersion: string): string {
  const url = new URL(currentHref);
  url.searchParams.set(VERSION_QUERY_PARAM, deployedVersion);
  return url.toString();
}

function reloadWithVersionedUrl(deployedVersion: string): void {
  window.location.replace(buildVersionedReloadUrl(window.location.href, deployedVersion));
}

export async function clearBrowserCaches(): Promise<void> {
  try {
    if ("caches" in window) {
      const cacheNames = await window.caches.keys();
      await Promise.allSettled(cacheNames.map((cacheName) => window.caches.delete(cacheName)));
    }
  } catch {
    // A blocked Cache Storage API must not prevent the versioned reload.
  }

  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.allSettled(registrations.map((registration) => registration.unregister()));
    }
  } catch {
    // A blocked Service Worker API must not prevent the versioned reload.
  }
}

async function latestDeployedVersion(): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 1500);

  let response: Response;
  try {
    response = await fetch(`/app-version.json?t=${Date.now()}`, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "Cache-Control": "no-cache"
      }
    });
  } finally {
    window.clearTimeout(timeoutId);
  }

  if (!response.ok) return null;
  const body = (await response.json()) as { version?: unknown };
  return typeof body.version === "string" ? body.version : null;
}

export async function reloadWhenAppVersionChanges(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  try {
    const deployedVersion = await latestDeployedVersion();
    if (!deployedVersion) return false;

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
      reloadWithVersionedUrl(deployedVersion);
      return true;
    }

    if (storedVersion === deployedVersion && pendingReload === deployedVersion) {
      window.sessionStorage.removeItem(RELOAD_GUARD_KEY);
    }
  } catch {
    if (!window.localStorage.getItem(VERSION_STORAGE_KEY)) {
      const buildVersion = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "unknown";
      window.localStorage.setItem(VERSION_STORAGE_KEY, buildVersion);
    }
  }

  return false;
}

export function installAppVersionWatcher(options: AppVersionWatcherOptions = {}): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") return () => undefined;

  const browserWindow = window as AppVersionWatcherWindow;
  const minimumCheckIntervalMs = Math.max(
    DEFAULT_MINIMUM_CHECK_INTERVAL_MS,
    options.minimumCheckIntervalMs ?? DEFAULT_MINIMUM_CHECK_INTERVAL_MS
  );
  const now = options.now ?? Date.now;
  const checkVersion = options.checkVersion ?? reloadWhenAppVersionChanges;
  let lastCheckStartedAt = Number.NEGATIVE_INFINITY;
  let inFlight = false;
  let disposed = false;
  let idleHandle: number | null = null;
  let timeoutHandle: number | null = null;

  const check = (): void => {
    const startedAt = now();
    if (disposed || inFlight || startedAt - lastCheckStartedAt < minimumCheckIntervalMs) return;
    lastCheckStartedAt = startedAt;
    inFlight = true;
    void checkVersion().catch(() => false).finally(() => { inFlight = false; });
  };
  const onFocus = (): void => check();
  const onVisibilityChange = (): void => {
    if (document.visibilityState === "visible") check();
  };

  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", onVisibilityChange);
  if (browserWindow.requestIdleCallback) {
    idleHandle = browserWindow.requestIdleCallback(check, { timeout: 2500 });
  } else {
    timeoutHandle = window.setTimeout(check, 800);
  }

  return () => {
    disposed = true;
    window.removeEventListener("focus", onFocus);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    if (idleHandle !== null) browserWindow.cancelIdleCallback?.(idleHandle);
    if (timeoutHandle !== null) window.clearTimeout(timeoutHandle);
  };
}
