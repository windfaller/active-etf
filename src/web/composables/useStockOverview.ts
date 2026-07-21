import { ref } from "vue";
import { getJson } from "../apiClient";
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
    controller = new AbortController();
    loading.value = true;
    error.value = "";
    const suffix = date ? `&date=${encodeURIComponent(date)}` : "";
    try {
      const [overviewResult, historyResult, etfsResult, institutionsResult] = await Promise.all([
        getJson<StockOverview>(`/api/stocks/${market}/${encodeURIComponent(symbol)}/overview?${suffix.slice(1)}`, controller.signal),
        getJson<StockHistory>(`/api/stocks/${market}/${encodeURIComponent(symbol)}/history?window=20${suffix}`, controller.signal),
        getJson<StockEtfs>(`/api/stocks/${market}/${encodeURIComponent(symbol)}/etfs?${suffix.slice(1)}`, controller.signal),
        getJson<StockInstitutions>(`/api/stocks/${market}/${encodeURIComponent(symbol)}/institutions?${suffix.slice(1)}`, controller.signal)
      ]);
      overview.value = overviewResult;
      history.value = historyResult;
      etfs.value = etfsResult;
      institutions.value = institutionsResult;
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError")) error.value = cause instanceof Error ? cause.message : "股票情報讀取失敗。";
    } finally {
      loading.value = false;
    }
  }

  function abort(): void { controller?.abort(); }
  return { overview, history, etfs, institutions, loading, error, load, abort };
}
