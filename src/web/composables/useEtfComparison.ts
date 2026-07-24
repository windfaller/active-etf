import { ref } from "vue";
import { getJson, readCachedJson } from "../apiClient";
import type { EtfComparison } from "../contracts/compare";

export function useEtfComparison() {
  const comparison = ref<EtfComparison | null>(null);
  const loading = ref(false);
  const error = ref("");
  let controller: AbortController | null = null;
  async function load(type: "tw" | "global", codes: string[]): Promise<EtfComparison | null> {
    controller?.abort();
    const requestController = new AbortController();
    controller = requestController;
    const path = `/api/compare/etfs?type=${type}&codes=${encodeURIComponent(codes.join(","))}`;
    comparison.value = readCachedJson<EtfComparison>(path);
    loading.value = true;
    error.value = "";
    try {
      const result = await getJson<EtfComparison>(path, requestController.signal);
      comparison.value = result;
      return result;
    }
    catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError") && !comparison.value) {
        error.value = cause instanceof Error ? cause.message : "ETF 比較讀取失敗。";
      }
    }
    finally {
      if (controller === requestController) {
        controller = null;
        loading.value = false;
      }
    }
    return null;
  }
  return { comparison, loading, error, load, abort: () => controller?.abort() };
}
