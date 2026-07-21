import { ref } from "vue";
import { getJson } from "../apiClient";
import type { SearchResponse, SearchResult } from "../contracts/search";

export function useGlobalSearch(defaultTypes: string[] = []) {
  const query = ref("");
  const results = ref<SearchResult[]>([]);
  const loading = ref(false);
  const error = ref("");
  let controller: AbortController | null = null;
  let timer: number | null = null;

  function cancel(): void {
    controller?.abort();
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
  }

  function search(value: string, immediate = false): void {
    query.value = value;
    cancel();
    error.value = "";
    if (value.trim().length < 2) { results.value = []; loading.value = false; return; }
    const run = async () => {
      const requestController = new AbortController();
      controller = requestController;
      loading.value = true;
      const params = new URLSearchParams({ q: value.trim(), limit: "12" });
      if (defaultTypes.length) params.set("types", defaultTypes.join(","));
      try { results.value = (await getJson<SearchResponse>(`/api/search?${params.toString()}`, requestController.signal)).results; }
      catch (cause) { if (!(cause instanceof DOMException && cause.name === "AbortError")) error.value = cause instanceof Error ? cause.message : "搜尋失敗。"; }
      finally {
        if (controller === requestController) {
          controller = null;
          loading.value = false;
        }
      }
    };
    if (immediate) void run();
    else timer = window.setTimeout(() => void run(), 250);
  }

  return { query, results, loading, error, search, cancel };
}
