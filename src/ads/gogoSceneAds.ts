// The SDK is vendored unchanged from the fixed 1.3.0 URL; see docs/gogoshared-scene-ads.md.
export const SCENE_ADS_PROJECT_ID = "active-etf";
export const SCENE_ADS_SDK_VERSION = "1.3.0";

export interface SceneAdsClient {
  readonly enabled: boolean;
  readonly collection: string;
  readonly status: string;
  readonly pref: { enabled?: boolean };
  readonly config: { enabled: boolean; defaultEnabled: boolean } | null;
  readonly catalog: { groups: { id: string; label: string }[] } | null;
  load(): Promise<boolean>;
  draw(canvas: HTMLCanvasElement, index?: number): string | null;
  bindClick(canvas: HTMLCanvasElement): () => void;
  subscribe(listener: () => void): () => void;
  setEnabled(value: boolean): void;
  setCollection(value: string): void;
  dispose(): void;
}

interface SceneAdsSdk {
  version: string;
  Client: new (options: { projectId: string }) => SceneAdsClient;
}

let sdkRequest: Promise<SceneAdsSdk> | null = null;

export function loadSceneAdsSdk(): Promise<SceneAdsSdk> {
  const target = window as Window & { GogoAds?: SceneAdsSdk };
  if (target.GogoAds) {
    return target.GogoAds.version === SCENE_ADS_SDK_VERSION
      ? Promise.resolve(target.GogoAds)
      : Promise.reject(new Error("A different GogoShared SDK is already loaded"));
  }
  if (sdkRequest) return sdkRequest;
  sdkRequest = new Promise<SceneAdsSdk>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/vendor/gogoshared-ads/1.3.0/gogo-ads.js";
    script.async = true;
    script.dataset.gogoAdsSdk = SCENE_ADS_SDK_VERSION;
    script.onload = () => {
      if (target.GogoAds?.version === SCENE_ADS_SDK_VERSION) resolve(target.GogoAds);
      else reject(new Error("Unexpected GogoShared SDK version"));
    };
    script.onerror = () => {
      script.remove();
      sdkRequest = null;
      reject(new Error("GogoShared SDK unavailable"));
    };
    document.head.appendChild(script);
  });
  return sdkRequest;
}
