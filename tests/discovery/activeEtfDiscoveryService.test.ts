import { describe, expect, it } from "vitest";
import type { ActiveEtfDiscovery } from "../../src/models/ActiveEtfDiscovery.js";
import { formatDiscoveryMessage } from "../../src/services/discovery/activeEtfDiscoveryService.js";

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
