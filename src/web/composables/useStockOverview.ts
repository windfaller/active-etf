import { ref } from "vue";
import { getJson, readCachedJson } from "../apiClient";
import type { StockEtfs, StockHistory, StockInstitutions, StockMarket, StockOverview } from "../contracts/stocks";

export function useStockOverview() {
  const overview = ref<StockOverview | null>(null);
  const history = ref<StockHistory | null>(null);
  const etfs = ref<StockEtfs | null>(null);
  const institutions = ref<StockInstitutions | null>(null);
  const loading = ref(false);
  const error = ref("");
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
    try {
      const [overviewResult, historyResult, etfsResult, institutionsResult] = await Promise.all([
        getJson<StockOverview>(paths.overview, requestController.signal),
        getJson<StockHistory>(paths.history, requestController.signal),
        getJson<StockEtfs>(paths.etfs, requestController.signal),
        getJson<StockInstitutions>(paths.institutions, requestController.signal)
      ]);
      if (controller !== requestController) return;
      overview.value = overviewResult;
      history.value = historyResult;
      etfs.value = etfsResult;
      institutions.value = institutionsResult;
    } catch (cause) {
      if (controller === requestController && !(cause instanceof DOMException && cause.name === "AbortError") && !overview.value) {
        error.value = cause instanceof Error ? cause.message : "股票情報讀取失敗。";
      }
    } finally {
      if (controller === requestController) {
        controller = null;
        loading.value = false;
      }
    }
  }

  function abort(): void { controller?.abort(); }
  return { overview, history, etfs, institutions, loading, error, load, abort };
}
