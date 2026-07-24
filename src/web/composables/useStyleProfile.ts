import { ref } from "vue";
import { getJson, readCachedJson } from "../apiClient";
import type { StyleProfile } from "../contracts/styleProfile";

export function useStyleProfile() {
  const profile = ref<StyleProfile | null>(null);
  const loading = ref(false);
  const error = ref("");
  let controller: AbortController | null = null;
  async function load(code: string, window: 20 | 60): Promise<void> {
    controller?.abort();
    const requestController = new AbortController();
    controller = requestController;
    const path = `/api/etf/${encodeURIComponent(code)}/style?window=${window}`;
    profile.value = readCachedJson<StyleProfile>(path);
    loading.value = true;
    error.value = "";
    try {
      profile.value = await getJson<StyleProfile>(path, requestController.signal);
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError") && !profile.value) {
        error.value = cause instanceof Error ? cause.message : "經理人風格讀取失敗。";
      }
    } finally {
      if (controller === requestController) {
        controller = null;
        loading.value = false;
      }
    }
  }
  return { profile, loading, error, load, abort: () => controller?.abort() };
}
