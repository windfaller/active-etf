import { readonly, ref } from "vue";

interface RuntimeConfigResponse {
  ads?: {
    enabled?: boolean;
    trackingEnabled?: boolean;
  };
}

const adsEnabled = ref(false);
const trackingEnabled = ref(false);
const loaded = ref(false);
let configRequest: Promise<void> | null = null;

async function fetchRuntimeConfig(): Promise<RuntimeConfigResponse> {
  const response = await fetch("/api/config", {
    headers: {
      Accept: "application/json"
    },
    cache: "no-store"
  });

  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return (await response.json()) as RuntimeConfigResponse;
}

export function loadAdsRuntimeConfig(): Promise<void> {
  if (configRequest) return configRequest;

  configRequest = fetchRuntimeConfig()
    .then((config) => {
      adsEnabled.value = config.ads?.enabled === true;
      trackingEnabled.value = config.ads?.trackingEnabled === true;
    })
    .catch(() => {
      adsEnabled.value = false;
      trackingEnabled.value = false;
    })
    .finally(() => {
      loaded.value = true;
    });

  return configRequest;
}

export function useAdsRuntimeConfig() {
  void loadAdsRuntimeConfig();

  return {
    adsEnabled: readonly(adsEnabled),
    trackingEnabled: readonly(trackingEnabled),
    loaded: readonly(loaded)
  };
}

export function isAdsRuntimeEnabled(): boolean {
  return adsEnabled.value;
}

export function isAdTrackingRuntimeEnabled(): boolean {
  return trackingEnabled.value;
}
