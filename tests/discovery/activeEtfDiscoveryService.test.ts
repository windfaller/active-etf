import type { Db } from "mongodb";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ActiveEtfDiscovery } from "../../src/models/ActiveEtfDiscovery.js";
import { formatDiscoveryMessage, runActiveEtfDiscovery } from "../../src/services/discovery/activeEtfDiscoveryService.js";
import { fetchSource } from "../../src/services/source/httpClient.js";

vi.mock("../../src/services/source/httpClient.js", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../src/services/source/httpClient.js")>(),
  fetchSource: vi.fn()
}));

function discovery(input: Partial<ActiveEtfDiscovery> & Pick<ActiveEtfDiscovery, "etfCode" | "stockName" | "issuer">): ActiveEtfDiscovery {
  return {
    etfCode: input.etfCode,
    stockName: input.stockName,
    listingDate: input.listingDate ?? "2026-05-18",
    issuer: input.issuer,
    indexName: null,
    totalAssetValue: null,
    closePrice: null,
    holders: null,
    valueYtd: null,
    volumeYtd: null,
    isTracked: false,
    configuredProviderId: null,
    suggestedProviderId: input.suggestedProviderId ?? "nomura",
    discoveryStatus: input.discoveryStatus ?? "needs_provider_mapping",
    sourceUrl: "https://wwwc.twse.com.tw/zh/ETFortune-institute/ajaxProducts",
    rawSnapshotId: "snapshot-1",
    firstDetectedAt: new Date("2026-05-18T00:00:00.000Z"),
    lastSeenAt: new Date("2026-05-18T00:00:00.000Z"),
    lastNotifiedAt: null
  };
}

describe("active ETF discovery notifications", () => {
  afterEach(() => vi.resetAllMocks());

  it("retains a null issuer and uses only the verified configured provider mapping", async () => {
    const rawBody = JSON.stringify({ status: "success", data: [{
      stockNo: "00415A", stockName: "主動群益核心50", listingDate: "2026.10.20", issuer: null
    }] });
    vi.mocked(fetchSource).mockResolvedValue({
      url: "https://wwwc.twse.com.tw/zh/ETFortune-institute/ajaxProducts", method: "POST", requestHeaders: {},
      responseStatus: 200, responseHeaders: {}, rawContentType: "application/json", rawBody
    });
    const saved: ActiveEtfDiscovery[] = [];
    const insertOne = vi.fn();
    const db = { collection: (name: string) => {
      if (name === "raw_snapshots") return { insertOne };
      if (name === "etf_master") return { distinct: async () => [] };
      return {
        findOne: async () => null,
        updateOne: async (_filter: unknown, update: { $set: ActiveEtfDiscovery }) => saved.push(update.$set),
        find: () => ({ sort: () => ({ toArray: async () => saved }) })
      };
    } } as unknown as Db;

    const result = await runActiveEtfDiscovery(db, { notify: false });

    expect(result.allUntracked[0]).toMatchObject({
      etfCode: "00415A", issuer: null, isTracked: false,
      configuredProviderId: "capital", suggestedProviderId: "capital", discoveryStatus: "needs_provider_mapping"
    });
    expect(insertOne).toHaveBeenCalledWith(expect.objectContaining({ rawBody, parsedOk: true }));
    expect(result.notification.attempted).toBe(false);
    expect(formatDiscoveryMessage(result.newlyDetected, result.allUntracked)).toContain("發行商未公告");
  });

  it("saves the official raw response when parsing fails and leaves discoveries untouched", async () => {
    vi.mocked(fetchSource).mockResolvedValue({
      url: "https://wwwc.twse.com.tw/zh/ETFortune-institute/ajaxProducts", method: "POST", requestHeaders: {},
      responseStatus: 200, responseHeaders: {}, rawContentType: "application/json", rawBody: "{\"status\":\"success\",\"data\":[{}]}"
    });
    const insertOne = vi.fn();
    const collection = vi.fn(() => ({ insertOne }));
    await expect(runActiveEtfDiscovery({ collection } as unknown as Db)).rejects.toThrow();
    expect(collection).toHaveBeenCalledExactlyOnceWith("raw_snapshots");
    expect(insertOne).toHaveBeenCalledWith(expect.objectContaining({
      etfCode: "__ACTIVE_ETF_LIST__", parsedOk: false, parseError: expect.any(String)
    }));
  });

  it("includes a manual onboarding skill prompt for newly detected ETFs", () => {
    const message = formatDiscoveryMessage(
      [discovery({ etfCode: "00999A", stockName: "主動野村臺灣高息", issuer: "野村投信" })],
      [discovery({ etfCode: "00999A", stockName: "主動野村臺灣高息", issuer: "野村投信" })]
    );

    expect(message).toContain("taiwan-active-etf-onboarding");
    expect(message).toContain("00999A 主動野村臺灣高息");
    expect(message).toContain("不要猜 API");
    expect(message).toContain("必須 reverse engineer 真正 JSON/XHR/API/CSV/XLSX endpoint");
    expect(message).toContain("目前只通知 onboarding 管理者");
  });
});
