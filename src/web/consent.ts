export const TRACKING_CONSENT_STORAGE_KEY = "active_etf_tracking_consent_v1";
export const TRACKING_CONSENT_CHANGED_EVENT = "active-etf:tracking-consent-changed";
export const ACTIVE_ETF_GOOGLE_TAG_ID = "G-DG02G9VVHY";
export const ACTIVE_ETF_META_PIXEL_ID = "1811635619849853";

export type TrackingConsent = "granted" | "denied";
export type ImpliedConsentInteraction = "navigation" | "button" | "form_control";

type MetaPixelFunction = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  loaded?: boolean;
  queue?: unknown[];
  push?: (...args: unknown[]) => void;
  version?: string;
};

export interface TrackingConsentTarget {
  dataLayer?: unknown[];
  document?: Document;
  localStorage?: Pick<Storage, "getItem" | "setItem">;
  dispatchEvent?: (event: Event) => boolean;
  fbq?: MetaPixelFunction;
  _fbq?: MetaPixelFunction;
  __ACTIVE_ETF_TRACKING_ALLOWED__?: boolean;
  __ACTIVE_ETF_GOOGLE_TAG_LOADING__?: boolean;
  __ACTIVE_ETF_META_PIXEL_LOADING__?: boolean;
}

function browserTarget(): TrackingConsentTarget | null {
  return typeof window === "undefined" ? null : window as TrackingConsentTarget;
}

function safeStorage(target: TrackingConsentTarget | null): TrackingConsentTarget["localStorage"] | null {
  if (!target) return null;
  try {
    return target.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readTrackingConsent(storage?: Pick<Storage, "getItem"> | null): TrackingConsent | null {
  try {
    const value = storage?.getItem(TRACKING_CONSENT_STORAGE_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

export function readBrowserTrackingConsent(): TrackingConsent | null {
  return readTrackingConsent(safeStorage(browserTarget()));
}

export function writeTrackingConsent(
  consent: TrackingConsent,
  storage?: Pick<Storage, "setItem"> | null
): boolean {
  try {
    storage?.setItem(TRACKING_CONSENT_STORAGE_KEY, consent);
    return Boolean(storage);
  } catch {
    return false;
  }
}

export function pushGoogleCommand(target: TrackingConsentTarget, ...args: unknown[]): void {
  const dataLayer = target.dataLayer ??= [];
  function gtagCommand(..._args: unknown[]): void {
    dataLayer.push(arguments);
  }
  gtagCommand(...args);
}

function pushConsentCommand(
  target: TrackingConsentTarget,
  state: TrackingConsent,
  operation: "default" | "update" = state === "granted" ? "update" : "default"
): void {
  pushGoogleCommand(
    target,
    "consent",
    operation,
    {
      ad_storage: state,
      ad_user_data: state,
      ad_personalization: state,
      analytics_storage: state,
      functionality_storage: "granted",
      security_storage: "granted"
    }
  );
}

function notifyConsentChanged(target: TrackingConsentTarget, consent: TrackingConsent): void {
  const CustomEventConstructor = target.document?.defaultView?.CustomEvent;
  if (!CustomEventConstructor || !target.dispatchEvent) return;
  target.dispatchEvent(new CustomEventConstructor(TRACKING_CONSENT_CHANGED_EVENT, { detail: { consent } }));
}

export function hasTrackingConsent(target: TrackingConsentTarget | null = browserTarget()): boolean {
  return target?.__ACTIVE_ETF_TRACKING_ALLOWED__ === true;
}

export function loadGoogleTag(target: TrackingConsentTarget | null = browserTarget()): boolean {
  if (!target || !target.document || target.__ACTIVE_ETF_GOOGLE_TAG_LOADING__) return false;
  if (target.document.querySelector(`script[data-google-tag-id="${ACTIVE_ETF_GOOGLE_TAG_ID}"]`)) return false;

  target.__ACTIVE_ETF_GOOGLE_TAG_LOADING__ = true;
  pushGoogleCommand(target, "js", new Date());
  pushGoogleCommand(target, "config", ACTIVE_ETF_GOOGLE_TAG_ID, {
    allow_ad_personalization_signals: false,
    allow_google_signals: false,
    send_page_view: false
  });
  const script = target.document.createElement("script");
  script.async = true;
  script.dataset.googleTagId = ACTIVE_ETF_GOOGLE_TAG_ID;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${ACTIVE_ETF_GOOGLE_TAG_ID}`;
  target.document.head.appendChild(script);
  return true;
}

export function loadMetaPixel(target: TrackingConsentTarget | null = browserTarget()): boolean {
  if (!target || !target.document || !hasTrackingConsent(target) || target.__ACTIVE_ETF_META_PIXEL_LOADING__) return false;
  if (target.document.querySelector(`script[data-meta-pixel-id="${ACTIVE_ETF_META_PIXEL_ID}"]`)) return false;

  target.__ACTIVE_ETF_META_PIXEL_LOADING__ = true;
  const queue: unknown[] = [];
  const fbq: MetaPixelFunction = function (...args: unknown[]): void {
    if (fbq.callMethod) fbq.callMethod(...args);
    else queue.push(args);
  };
  fbq.loaded = true;
  fbq.queue = queue;
  fbq.push = fbq;
  fbq.version = "2.0";
  target.fbq = fbq;
  target._fbq = fbq;

  const script = target.document.createElement("script");
  script.async = true;
  script.dataset.metaPixelId = ACTIVE_ETF_META_PIXEL_ID;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  target.document.head.appendChild(script);
  fbq("init", ACTIVE_ETF_META_PIXEL_ID);
  fbq("track", "PageView");
  return true;
}

export function trackMetaCustomEvent(
  event: string,
  target: TrackingConsentTarget | null = browserTarget()
): boolean {
  if (!target || !hasTrackingConsent(target) || !target.fbq) return false;
  target.fbq("trackCustom", event);
  return true;
}

export function initializeTrackingConsent(target: TrackingConsentTarget | null = browserTarget()): TrackingConsent | null {
  if (!target) return null;
  const consent = readTrackingConsent(safeStorage(target));
  target.__ACTIVE_ETF_TRACKING_ALLOWED__ = consent === "granted";
  pushConsentCommand(target, "denied");
  if (consent === "granted") pushConsentCommand(target, "granted");
  loadGoogleTag(target);
  if (consent === "granted") loadMetaPixel(target);
  return consent;
}

export function grantTrackingConsent(target: TrackingConsentTarget | null = browserTarget()): boolean {
  if (!target) return false;
  if (hasTrackingConsent(target)) {
    loadGoogleTag(target);
    loadMetaPixel(target);
    return true;
  }
  writeTrackingConsent("granted", safeStorage(target));
  target.__ACTIVE_ETF_TRACKING_ALLOWED__ = true;
  pushConsentCommand(target, "granted");
  loadGoogleTag(target);
  loadMetaPixel(target);
  notifyConsentChanged(target, "granted");
  return true;
}

export function denyTrackingConsent(target: TrackingConsentTarget | null = browserTarget()): boolean {
  if (!target) return false;
  writeTrackingConsent("denied", safeStorage(target));
  target.__ACTIVE_ETF_TRACKING_ALLOWED__ = false;
  pushConsentCommand(target, "denied", "update");
  loadGoogleTag(target);
  notifyConsentChanged(target, "denied");
  return true;
}

function asElement(target: EventTarget | null): Element | null {
  if (!target || typeof (target as Element).closest !== "function") return null;
  return target as Element;
}

export function impliedConsentInteraction(target: EventTarget | null): ImpliedConsentInteraction | null {
  const element = asElement(target);
  if (!element || element.closest("[data-tracking-consent-ui]")) return null;
  const actionable = element.closest("a,button,input,select,textarea,[role='button'],[role='tab']");
  if (!actionable) return null;
  if (actionable.matches("a")) {
    const href = actionable.getAttribute("href") ?? "";
    const origin = actionable.ownerDocument?.location?.origin ?? "https://active-etf.inthewins.com";
    const path = new URL(href, origin).pathname.replace(/\/+$/u, "") || "/";
    if (path === "/privacy" || path === "/terms") return null;
    return "navigation";
  }
  if (actionable.matches("input,select,textarea")) return "form_control";
  return "button";
}

export function installImpliedTrackingConsent(
  onInteraction?: (interaction: ImpliedConsentInteraction) => void,
  target: Window = window
): () => void {
  const handleInteraction = (event: Event): void => {
    if (!event.isTrusted) return;
    const interaction = impliedConsentInteraction(event.target);
    if (!interaction) return;
    grantTrackingConsent(target as TrackingConsentTarget);
    onInteraction?.(interaction);
  };
  target.document.addEventListener("click", handleInteraction, true);
  target.document.addEventListener("change", handleInteraction, true);
  return () => {
    target.document.removeEventListener("click", handleInteraction, true);
    target.document.removeEventListener("change", handleInteraction, true);
  };
}
