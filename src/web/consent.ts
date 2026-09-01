export const TRACKING_CONSENT_STORAGE_KEY = "active_etf_tracking_consent_v1";
export const ACTIVE_ETF_GTM_ID = "GTM-WSP962PS";

export type TrackingConsent = "granted" | "denied";

export interface TrackingConsentTarget {
  dataLayer?: unknown[];
  document?: Document;
  localStorage?: Pick<Storage, "getItem" | "setItem">;
  __ACTIVE_ETF_TRACKING_ALLOWED__?: boolean;
  __ACTIVE_ETF_GTM_LOADING__?: boolean;
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

function pushConsentCommand(
  target: TrackingConsentTarget,
  state: TrackingConsent,
  operation: "default" | "update" = state === "granted" ? "update" : "default"
): void {
  const dataLayer = target.dataLayer ??= [];
  function gtagCommand(..._args: unknown[]): void {
    dataLayer.push(arguments);
  }
  gtagCommand(
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

export function hasTrackingConsent(target: TrackingConsentTarget | null = browserTarget()): boolean {
  return target?.__ACTIVE_ETF_TRACKING_ALLOWED__ === true;
}

export function loadGtm(target: TrackingConsentTarget | null = browserTarget()): boolean {
  if (!target || !target.document || !hasTrackingConsent(target) || target.__ACTIVE_ETF_GTM_LOADING__) return false;
  if (target.document.querySelector(`script[data-gtm-id="${ACTIVE_ETF_GTM_ID}"]`)) return false;

  target.__ACTIVE_ETF_GTM_LOADING__ = true;
  const dataLayer = target.dataLayer ??= [];
  dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
  const script = target.document.createElement("script");
  script.async = true;
  script.dataset.gtmId = ACTIVE_ETF_GTM_ID;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${ACTIVE_ETF_GTM_ID}`;
  target.document.head.appendChild(script);
  return true;
}

export function initializeTrackingConsent(target: TrackingConsentTarget | null = browserTarget()): TrackingConsent | null {
  if (!target) return null;
  const consent = readTrackingConsent(safeStorage(target));
  target.__ACTIVE_ETF_TRACKING_ALLOWED__ = consent === "granted";
  pushConsentCommand(target, "denied");
  if (consent === "granted") {
    pushConsentCommand(target, "granted");
    loadGtm(target);
  }
  return consent;
}

export function grantTrackingConsent(target: TrackingConsentTarget | null = browserTarget()): boolean {
  if (!target) return false;
  writeTrackingConsent("granted", safeStorage(target));
  target.__ACTIVE_ETF_TRACKING_ALLOWED__ = true;
  pushConsentCommand(target, "granted");
  return loadGtm(target) || target.__ACTIVE_ETF_GTM_LOADING__ === true;
}

export function denyTrackingConsent(target: TrackingConsentTarget | null = browserTarget()): boolean {
  if (!target) return false;
  writeTrackingConsent("denied", safeStorage(target));
  target.__ACTIVE_ETF_TRACKING_ALLOWED__ = false;
  pushConsentCommand(target, "denied", "update");
  return true;
}
