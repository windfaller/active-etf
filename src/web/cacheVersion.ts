declare const __APP_VERSION__: string;

const VERSION_STORAGE_KEY = "active-etf:app-version";
const RELOAD_GUARD_KEY = "active-etf:version-reload-pending";
const VERSION_QUERY_PARAM = "appVersion";
const VERSION_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const VERSION_CHECK_MIN_GAP_MS = 1000;

export function buildVersionedReloadUrl(currentHref: string, deployedVersion: string): string {
  const url = new URL(currentHref);
  url.searchParams.set(VERSION_QUERY_PARAM, deployedVersion);
  return url.toString();
}

function reloadWithVersionedUrl(deployedVersion: string): void {
  window.location.replace(buildVersionedReloadUrl(window.location.href, deployedVersion));
}

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

  try {
    const response = await fetch(`/app-version.json?t=${Date.now()}`, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "Cache-Control": "no-cache"
      }
    });

    if (!response.ok) return null;
    const body = (await response.json()) as { version?: unknown };
    return typeof body.version === "string" ? body.version : null;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function shouldReloadForVersion(
  runningVersion: string,
  deployedVersion: string,
  pendingReload: string | null
): boolean {
  return runningVersion !== deployedVersion && pendingReload !== deployedVersion;
}

export async function reloadWhenAppVersionChanges(runningVersion = __APP_VERSION__): Promise<boolean> {
  if (typeof window === "undefined") return false;

  try {
    const deployedVersion = await latestDeployedVersion();
    if (!deployedVersion) return false;

    const pendingReload = window.sessionStorage.getItem(RELOAD_GUARD_KEY);
    window.localStorage.setItem(VERSION_STORAGE_KEY, deployedVersion);

    if (shouldReloadForVersion(runningVersion, deployedVersion, pendingReload)) {
      window.sessionStorage.setItem(RELOAD_GUARD_KEY, deployedVersion);
      await clearBrowserCaches();
      reloadWithVersionedUrl(deployedVersion);
      return true;
    }

    if (runningVersion === deployedVersion && pendingReload === deployedVersion) {
      window.sessionStorage.removeItem(RELOAD_GUARD_KEY);
    }
  } catch {
    if (!window.localStorage.getItem(VERSION_STORAGE_KEY)) {
      window.localStorage.setItem(VERSION_STORAGE_KEY, __APP_VERSION__);
    }
  }

  return false;
}

export function startAppVersionMonitor(
  check: () => Promise<boolean> = () => reloadWhenAppVersionChanges()
): () => void {
  if (typeof window === "undefined") return () => undefined;

  let stopped = false;
  let inFlight = false;
  let lastStartedAt = 0;

  const run = (force = false) => {
    const now = Date.now();
    if (stopped || inFlight || (!force && now - lastStartedAt < VERSION_CHECK_MIN_GAP_MS)) return;
    lastStartedAt = now;
    inFlight = true;
    void check()
      .catch(() => false)
      .finally(() => {
        inFlight = false;
      });
  };
  const onResume = () => run();
  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") run();
  };

  window.addEventListener("focus", onResume);
  window.addEventListener("online", onResume);
  document.addEventListener("visibilitychange", onVisibilityChange);
  const intervalId = window.setInterval(run, VERSION_CHECK_INTERVAL_MS);
  run(true);

  return () => {
    stopped = true;
    window.clearInterval(intervalId);
    window.removeEventListener("focus", onResume);
    window.removeEventListener("online", onResume);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
}
