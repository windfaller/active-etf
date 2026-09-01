import { describe, expect, it, vi } from "vitest";
import {
  ACTIVE_ETF_GOOGLE_TAG_ID,
  ACTIVE_ETF_META_PIXEL_ID,
  TRACKING_CONSENT_STORAGE_KEY,
  denyTrackingConsent,
  grantTrackingConsent,
  hasTrackingConsent,
  impliedConsentInteraction,
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

function targetWithDocument(initial?: string): { target: TrackingConsentTarget; appended: Array<Record<string, unknown>> } {
  const appended: Array<Record<string, unknown>> = [];
  const target: TrackingConsentTarget = {
    dataLayer: [],
    localStorage: storage(initial),
    document: {
      querySelector: vi.fn(() => null),
      createElement: vi.fn(() => ({ dataset: {} })),
      head: { appendChild: vi.fn((node: Record<string, unknown>) => appended.push(node)) }
    } as unknown as Document
  };
  return { target, appended };
}

function fakeAction(kind: "a" | "button" | "input", href = "", inConsentUi = false): EventTarget {
  const action = {
    ownerDocument: { location: { origin: "https://active-etf.inthewins.com" } },
    closest: vi.fn((selector: string) => selector === "[data-tracking-consent-ui]"
      ? (inConsentUi ? action : null)
      : action),
    getAttribute: vi.fn((name: string) => name === "href" ? href : null),
    matches: vi.fn((selector: string) => selector.split(",").includes(kind))
  };
  return action as unknown as EventTarget;
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

  it("loads Google in denied mode for anonymous measurement but keeps Meta blocked", () => {
    const { target, appended } = targetWithDocument();
    expect(initializeTrackingConsent(target)).toBeNull();
    expect(hasTrackingConsent(target)).toBe(false);
    expect(appended).toHaveLength(1);
    expect(appended[0]?.dataset).toEqual({ googleTagId: ACTIVE_ETF_GOOGLE_TAG_ID });
    expect(appended[0]?.src).toContain(`gtag/js?id=${ACTIVE_ETF_GOOGLE_TAG_ID}`);
    expect(JSON.stringify(appended)).not.toContain(ACTIVE_ETF_META_PIXEL_ID);
    expect(Array.from(target.dataLayer?.[0] as IArguments).slice(0, 2)).toEqual(["consent", "default"]);
    expect(Array.from(target.dataLayer?.[0] as IArguments)[2]).toMatchObject({ analytics_storage: "denied", ad_storage: "denied" });
  });

  it("upgrades Google consent and loads Meta only after consent", () => {
    const { target, appended } = targetWithDocument();
    initializeTrackingConsent(target);
    expect(grantTrackingConsent(target)).toBe(true);
    expect(hasTrackingConsent(target)).toBe(true);
    expect(appended).toHaveLength(2);
    expect(appended[1]?.dataset).toEqual({ metaPixelId: ACTIVE_ETF_META_PIXEL_ID });
    expect(appended[1]?.src).toBe("https://connect.facebook.net/en_US/fbevents.js");
    expect(target.fbq?.queue).toEqual([
      ["init", ACTIVE_ETF_META_PIXEL_ID],
      ["track", "PageView"]
    ]);

    expect(denyTrackingConsent(target)).toBe(true);
    expect(hasTrackingConsent(target)).toBe(false);
    expect(Array.from(target.dataLayer?.at(-1) as IArguments).slice(0, 2)).toEqual(["consent", "update"]);
    expect(Array.from(target.dataLayer?.at(-1) as IArguments)[2]).toMatchObject({ analytics_storage: "denied", ad_storage: "denied" });
  });

  it("recognizes product actions as implied consent but excludes consent and legal controls", () => {
    expect(impliedConsentInteraction(fakeAction("a", "/market"))).toBe("navigation");
    expect(impliedConsentInteraction(fakeAction("button"))).toBe("button");
    expect(impliedConsentInteraction(fakeAction("input"))).toBe("form_control");
    expect(impliedConsentInteraction(fakeAction("a", "/privacy"))).toBeNull();
    expect(impliedConsentInteraction(fakeAction("a", "/terms"))).toBeNull();
    expect(impliedConsentInteraction(fakeAction("button", "", true))).toBeNull();
  });
});
