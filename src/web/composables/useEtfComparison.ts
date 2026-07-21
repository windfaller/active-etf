import { ref } from "vue";
import { getJson } from "../apiClient";
import type { EtfComparison } from "../contracts/compare";

export function useEtfComparison() {
  const comparison = ref<EtfComparison | null>(null);
  const loading = ref(false);
  const error = ref("");
  let controller: AbortController | null = null;
  async function load(type: "tw" | "global", codes: string[]): Promise<void> {
    controller?.abort(); controller = new AbortController(); loading.value = true; error.value = "";
    try { comparison.value = await getJson<EtfComparison>(`/api/compare/etfs?type=${type}&codes=${encodeURIComponent(codes.join(","))}`, controller.signal); }
    catch (cause) { if (!(cause instanceof DOMException && cause.name === "AbortError")) error.value = cause instanceof Error ? cause.message : "ETF 比較讀取失敗。"; }
    finally { loading.value = false; }
  }
  return { comparison, loading, error, load, abort: () => controller?.abort() };
}
