import { ref } from "vue";
import { getJson, readCachedJson } from "../apiClient";
import type { SignalsResponse } from "../contracts/signals";

export function useSignals() {
  const signals = ref<SignalsResponse | null>(null);
  const loading = ref(false);
  const error = ref("");
  let controller: AbortController | null = null;
  async function load(kind: SignalsResponse["kind"], window: 3 | 5 | 20): Promise<void> {
    controller?.abort();
    const requestController = new AbortController();
    controller = requestController;
    const path = `/api/signals?kind=${kind}&window=${window}&limit=30`;
    signals.value = readCachedJson<SignalsResponse>(path);
    loading.value = true;
    error.value = "";
    try {
      signals.value = await getJson<SignalsResponse>(path, requestController.signal);
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError") && !signals.value) {
        error.value = cause instanceof Error ? cause.message : "訊號讀取失敗。";
      }
    } finally {
      if (controller === requestController) {
        controller = null;
        loading.value = false;
      }
    }
  }
  return { signals, loading, error, load, abort: () => controller?.abort() };
}
