import { describe, expect, it, vi } from "vitest";
import {
  TRACKING_CONSENT_STORAGE_KEY,
  denyTrackingConsent,
  grantTrackingConsent,
  hasTrackingConsent,
  initializeTrackingConsent,
  readBrowserTrackingConsent,
  readTrackingConsent,
  writeTrackingConsent,
  type TrackingConsentTarget
} from "../../src/web/consent.js";

function storage(initial?: string) {
  let value = initial ?? null;
  return {
    getItem: vi.fn(() => value),
    setItem: vi.fn((_key: string, next: string) => { value = next; })
  };
}

describe("tracking consent", () => {
  it("treats missing or invalid choices as no consent", () => {
    expect(readTrackingConsent(storage())).toBeNull();
    expect(readTrackingConsent(storage("unexpected"))).toBeNull();
  });

  it("stays safe when the browser blocks storage access", () => {
    const previousWindow = globalThis.window;
    const blockedWindow = {};
    Object.defineProperty(blockedWindow, "localStorage", { get: () => { throw new Error("blocked"); } });
    Object.defineProperty(globalThis, "window", { configurable: true, value: blockedWindow });
    try {
      expect(readBrowserTrackingConsent()).toBeNull();
    } finally {
      Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
    }
  });

  it("stores an explicit choice without user data", () => {
    const targetStorage = storage();
    expect(writeTrackingConsent("denied", targetStorage)).toBe(true);
    expect(targetStorage.setItem).toHaveBeenCalledWith(TRACKING_CONSENT_STORAGE_KEY, "denied");
    expect(readTrackingConsent(targetStorage)).toBe("denied");
  });

  it("does not load GTM before consent", () => {
    const appendChild = vi.fn();
    const target: TrackingConsentTarget = {
      dataLayer: [],
      localStorage: storage(),
      document: {
        querySelector: vi.fn(() => null),
        createElement: vi.fn(() => ({ dataset: {} })),
        head: { appendChild }
      } as unknown as Document
    };
    expect(initializeTrackingConsent(target)).toBeNull();
    expect(hasTrackingConsent(target)).toBe(false);
    expect(appendChild).not.toHaveBeenCalled();
    expect(Array.from(target.dataLayer?.[0] as IArguments).slice(0, 2)).toEqual(["consent", "default"]);
  });

  it("loads GTM only after granting consent and blocks later events after denial", () => {
    const appendChild = vi.fn();
    const target: TrackingConsentTarget = {
      dataLayer: [],
      localStorage: storage(),
      document: {
        querySelector: vi.fn(() => null),
        createElement: vi.fn(() => ({ dataset: {} })),
        head: { appendChild }
      } as unknown as Document
    };
    expect(grantTrackingConsent(target)).toBe(true);
    expect(hasTrackingConsent(target)).toBe(true);
    expect(appendChild).toHaveBeenCalledTimes(1);
    expect(denyTrackingConsent(target)).toBe(true);
    expect(hasTrackingConsent(target)).toBe(false);
    expect(Array.from(target.dataLayer?.at(-1) as IArguments).slice(0, 2)).toEqual(["consent", "update"]);
  });
});
