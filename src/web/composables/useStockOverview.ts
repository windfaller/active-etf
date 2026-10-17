import { ref, type Ref } from "vue";
import { getJson, readCachedJson } from "../apiClient.js";
import type { StockEtfs, StockHistory, StockInstitutions, StockMarket, StockOverview } from "../contracts/stocks.js";

export function useStockOverview() {
  const overview = ref<StockOverview | null>(null);
  const history = ref<StockHistory | null>(null);
  const etfs = ref<StockEtfs | null>(null);
  const institutions = ref<StockInstitutions | null>(null);
  const loading = ref(false);
  const error = ref("");
  const sectionLoading = ref({ overview: false, history: false, etfs: false, institutions: false });
  const sectionErrors = ref({ history: "", etfs: "", institutions: "" });
  let controller: AbortController | null = null;

  async function load(market: StockMarket, symbol: string, date?: string): Promise<void> {
    controller?.abort();
    const requestController = new AbortController();
    controller = requestController;
    loading.value = true;
    error.value = "";
    const suffix = date ? `&date=${encodeURIComponent(date)}` : "";
    const paths = {
      overview: `/api/stocks/${market}/${encodeURIComponent(symbol)}/overview?${suffix.slice(1)}`,
      history: `/api/stocks/${market}/${encodeURIComponent(symbol)}/history?window=20${suffix}`,
      etfs: `/api/stocks/${market}/${encodeURIComponent(symbol)}/etfs?${suffix.slice(1)}`,
      institutions: `/api/stocks/${market}/${encodeURIComponent(symbol)}/institutions?${suffix.slice(1)}`
    };
    overview.value = readCachedJson<StockOverview>(paths.overview);
    history.value = readCachedJson<StockHistory>(paths.history);
    etfs.value = readCachedJson<StockEtfs>(paths.etfs);
    institutions.value = readCachedJson<StockInstitutions>(paths.institutions);
    sectionLoading.value = { overview: true, history: true, etfs: true, institutions: true };
    sectionErrors.value = { history: "", etfs: "", institutions: "" };
    async function loadSection<T>(key: keyof typeof paths, target: Ref<T | null>): Promise<void> {
      try {
        const value = await getJson<T>(paths[key], requestController.signal);
        if (controller === requestController) target.value = value;
      } catch (cause) {
        if (controller !== requestController || requestController.signal.aborted) return;
        const message = cause instanceof Error ? cause.message : "資料暫時無法讀取。";
        if (key === "overview") error.value = overview.value ? "更新失敗，先顯示先前取得的資料。" : message;
        else sectionErrors.value[key] = message;
      } finally {
        if (controller === requestController) sectionLoading.value[key] = false;
      }
    }
    // Each successful response paints immediately; slow/failed details cannot hide the overview.
    await Promise.all([
      loadSection("overview", overview), loadSection("history", history),
      loadSection("etfs", etfs), loadSection("institutions", institutions)
    ]);
    if (controller === requestController) {
      controller = null;
      loading.value = false;
    }
  }

  function abort(): void { controller?.abort(); controller = null; }
  return { overview, history, etfs, institutions, loading, sectionLoading, sectionErrors, error, load, abort };
}
