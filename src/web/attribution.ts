// Only campaign metadata is retained. No identity, research selection or OAuth data belongs here.
export const CAMPAIGN_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "gbraid", "wbraid", "fbclid"] as const;
const STORAGE_KEY = "active_etf_campaign_v1";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

type Campaign = { savedAt: number; values: Record<string, string> };

export function safeCampaignValues(search: string): Record<string, string> {
  const input = new URLSearchParams(search);
  const values: Record<string, string> = {};
  for (const key of CAMPAIGN_KEYS) {
    const value = input.get(key);
    if (value && value.length <= 300 && /^[\w.~-]+$/u.test(value)) values[key] = value;
  }
  return values;
}

export function captureCampaign(search: string, storage: Pick<Storage, "setItem"> | null = typeof sessionStorage === "undefined" ? null : sessionStorage): void {
  const values = safeCampaignValues(search);
  if (!Object.keys(values).length) return;
  try { storage?.setItem(STORAGE_KEY, JSON.stringify({ savedAt: Date.now(), values } satisfies Campaign)); } catch { /* storage may be disabled in app browsers */ }
}

export function clearCampaign(storage: Pick<Storage, "removeItem"> | null = typeof sessionStorage === "undefined" ? null : sessionStorage): void {
  try { storage?.removeItem(STORAGE_KEY); } catch { /* storage may be disabled */ }
}

export function readCampaign(storage: Pick<Storage, "getItem"> | null = typeof sessionStorage === "undefined" ? null : sessionStorage): Record<string, string> {
  try {
    const stored = JSON.parse(storage?.getItem(STORAGE_KEY) ?? "null") as Campaign | null;
    if (!stored || !Number.isFinite(stored.savedAt) || Date.now() - stored.savedAt > MAX_AGE_MS) return {};
    return safeCampaignValues(new URLSearchParams(stored.values).toString());
  } catch { return {}; }
}

export function withCampaign(url: URL, values = readCampaign()): URL {
  for (const key of CAMPAIGN_KEYS) {
    const value = values[key];
    if (value && !url.searchParams.has(key)) url.searchParams.set(key, value);
  }
  return url;
}
