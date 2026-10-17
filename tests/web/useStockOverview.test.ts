import { afterEach, expect, it, vi } from "vitest";
import { clearJsonCache } from "../../src/web/apiClient.js";
import { useStockOverview } from "../../src/web/composables/useStockOverview.js";

afterEach(() => { clearJsonCache(); vi.unstubAllGlobals(); });

it("renders overview and ETF details while history is still pending, retaining partial success on failure", async () => {
  const pending = new Map<string, (response: Response) => void>();
  vi.stubGlobal("fetch", vi.fn((url: string) => new Promise<Response>((resolve) => {
    pending.set(new URL(url, "http://localhost").pathname.split("/").at(-1)!, resolve);
  })));
  const stock = useStockOverview();
  const loaded = stock.load("us", "MU");
  await vi.waitFor(() => expect(pending.size).toBe(4));
  pending.get("overview")!(new Response(JSON.stringify({ stock: { symbol: "MU", name: "Micron" } })));
  pending.get("etfs")!(new Response(JSON.stringify({ rows: [{ etfCode: "DRAM" }] })));
  await vi.waitFor(() => expect(stock.overview.value?.stock.name).toBe("Micron"));
  expect(stock.history.value).toBeNull();
  expect(stock.sectionLoading.value.history).toBe(true);
  expect(stock.etfs.value?.rows[0]).toMatchObject({ etfCode: "DRAM" });
  pending.get("history")!(new Response(JSON.stringify({ error: "slow source failed" }), { status: 503 }));
  pending.get("institutions")!(new Response(JSON.stringify({ rows: [] })));
  await loaded;
  expect(stock.error.value).toBe("");
  expect(stock.sectionErrors.value.history).toBe("slow source failed");
  expect(stock.overview.value?.stock.symbol).toBe("MU");
  expect(stock.loading.value).toBe(false);
});
