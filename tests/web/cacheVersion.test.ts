import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildVersionedReloadUrl,
  installAppVersionWatcher,
  reloadWhenAppVersionChanges
} from "../../src/web/cacheVersion.js";

function storage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    removeItem: vi.fn((key: string) => values.delete(key))
  };
}

function browserEnvironment(options: { storedVersion?: string; pendingVersion?: string; deployedVersion?: string; fetchError?: Error } = {}) {
  const localStorage = storage(options.storedVersion ? { "active-etf:app-version": options.storedVersion } : {});
  const sessionStorage = storage(options.pendingVersion ? { "active-etf:version-reload-pending": options.pendingVersion } : {});
  const replace = vi.fn();
  const cacheDelete = vi.fn(async () => true);
  const unregister = vi.fn(async () => true);
  const windowListeners = new Map<string, Set<() => void>>();
  const documentListeners = new Map<string, Set<() => void>>();
  let idleCallback: (() => void) | null = null;
  let visibilityState: "hidden" | "visible" = "visible";
  const add = (target: Map<string, Set<() => void>>, name: string, callback: () => void) => target.set(name, new Set([...(target.get(name) ?? []), callback]));
  const remove = (target: Map<string, Set<() => void>>, name: string, callback: () => void) => target.get(name)?.delete(callback);
  const fakeWindow = {
    location: { href: "https://active-etf.inthewins.com/compare/etfs?codes=DRAM,HBMX#holdings", replace },
    localStorage,
    sessionStorage,
    caches: { keys: vi.fn(async () => ["old-shell", "old-api"]), delete: cacheDelete },
    setTimeout: vi.fn(() => 1),
    clearTimeout: vi.fn(),
    requestIdleCallback: vi.fn((callback: () => void) => { idleCallback = callback; return 2; }),
    cancelIdleCallback: vi.fn(),
    addEventListener: vi.fn((name: string, callback: () => void) => add(windowListeners, name, callback)),
    removeEventListener: vi.fn((name: string, callback: () => void) => remove(windowListeners, name, callback))
  };
  const fakeDocument = {
    get visibilityState() { return visibilityState; },
    addEventListener: vi.fn((name: string, callback: () => void) => add(documentListeners, name, callback)),
    removeEventListener: vi.fn((name: string, callback: () => void) => remove(documentListeners, name, callback))
  };
  const fetch = options.fetchError
    ? vi.fn(async () => { throw options.fetchError; })
    : vi.fn(async () => new Response(JSON.stringify({ version: options.deployedVersion ?? "B" }), { status: 200 }));
  vi.stubGlobal("window", fakeWindow);
  vi.stubGlobal("document", fakeDocument);
  vi.stubGlobal("navigator", { serviceWorker: { getRegistrations: vi.fn(async () => [{ unregister }]) } });
  vi.stubGlobal("fetch", fetch);
  return {
    cacheDelete,
    fetch,
    fireDocument: (name: string) => documentListeners.get(name)?.forEach((callback) => callback()),
    fireWindow: (name: string) => windowListeners.get(name)?.forEach((callback) => callback()),
    localStorage,
    pending: sessionStorage,
    replace,
    runIdle: () => idleCallback?.(),
    setVisibility: (value: "hidden" | "visible") => { visibilityState = value; },
    unregister
  };
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(() => vi.unstubAllGlobals());

describe("cache version reload URL", () => {
  it("adds the deployed app version to clean app routes", () => {
    expect(buildVersionedReloadUrl("https://active-etf.inthewins.com/market", "abc123")).toBe(
      "https://active-etf.inthewins.com/market?appVersion=abc123"
    );
  });

  it("preserves existing query params and replaces stale version params", () => {
    expect(buildVersionedReloadUrl("https://active-etf.inthewins.com/etf/00981A?date=2026-07-03&appVersion=old#changes", "new-sha")).toBe(
      "https://active-etf.inthewins.com/etf/00981A?date=2026-07-03&appVersion=new-sha#changes"
    );
  });

  it("reloads a new version only once and clears browser caches and service workers", async () => {
    const browser = browserEnvironment({ storedVersion: "A", deployedVersion: "B" });
    await expect(reloadWhenAppVersionChanges()).resolves.toBe(true);
    expect(browser.replace).toHaveBeenCalledWith("https://active-etf.inthewins.com/compare/etfs?codes=DRAM%2CHBMX&appVersion=B#holdings");
    expect(browser.cacheDelete).toHaveBeenCalledTimes(2);
    expect(browser.unregister).toHaveBeenCalledOnce();

    await expect(reloadWhenAppVersionChanges()).resolves.toBe(false);
    expect(browser.replace).toHaveBeenCalledOnce();
    expect(browser.pending.removeItem).toHaveBeenCalledWith("active-etf:version-reload-pending");
  });

  it("does not reload the same deployed version", async () => {
    const browser = browserEnvironment({ storedVersion: "B", deployedVersion: "B" });
    await expect(reloadWhenAppVersionChanges()).resolves.toBe(false);
    expect(browser.replace).not.toHaveBeenCalled();
  });

  it("honors the pending guard and avoids a reload loop", async () => {
    const browser = browserEnvironment({ storedVersion: "A", pendingVersion: "B", deployedVersion: "B" });
    await expect(reloadWhenAppVersionChanges()).resolves.toBe(false);
    expect(browser.replace).not.toHaveBeenCalled();
  });

  it("ignores a version fetch failure without disrupting the app", async () => {
    const browser = browserEnvironment({ storedVersion: "A", fetchError: new Error("timeout") });
    await expect(reloadWhenAppVersionChanges()).resolves.toBe(false);
    expect(browser.replace).not.toHaveBeenCalled();
  });

  it("still reloads when Cache Storage cleanup is unavailable", async () => {
    const browser = browserEnvironment({ storedVersion: "A", deployedVersion: "B" });
    vi.mocked((window as unknown as { caches: { keys: () => Promise<string[]> } }).caches.keys).mockRejectedValueOnce(new Error("blocked"));
    await expect(reloadWhenAppVersionChanges()).resolves.toBe(true);
    expect(browser.replace).toHaveBeenCalledOnce();
  });

  it("runs the initial check while idle and removes listeners during cleanup", async () => {
    const browser = browserEnvironment();
    const checkVersion = vi.fn(async () => false);
    const stop = installAppVersionWatcher({ checkVersion });
    browser.runIdle();
    await settle();
    expect(checkVersion).toHaveBeenCalledOnce();
    stop();
    browser.fireWindow("focus");
    await settle();
    expect(checkVersion).toHaveBeenCalledOnce();
  });

  it("checks on focus and throttles repeated focus events for at least 60 seconds", async () => {
    const browser = browserEnvironment();
    let now = 1_000;
    const checkVersion = vi.fn(async () => false);
    installAppVersionWatcher({ checkVersion, now: () => now });
    browser.fireWindow("focus");
    await settle();
    browser.fireWindow("focus");
    await settle();
    expect(checkVersion).toHaveBeenCalledOnce();
    now += 60_000;
    browser.fireWindow("focus");
    await settle();
    expect(checkVersion).toHaveBeenCalledTimes(2);
  });

  it("skips hidden visibility events and checks when the page becomes visible", async () => {
    const browser = browserEnvironment();
    let now = 1_000;
    const checkVersion = vi.fn(async () => false);
    installAppVersionWatcher({ checkVersion, now: () => now });
    browser.setVisibility("hidden");
    browser.fireDocument("visibilitychange");
    await settle();
    expect(checkVersion).not.toHaveBeenCalled();
    now += 60_000;
    browser.setVisibility("visible");
    browser.fireDocument("visibilitychange");
    await settle();
    expect(checkVersion).toHaveBeenCalledOnce();
  });
});
