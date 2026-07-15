import { createHash, randomUUID } from "node:crypto";
import type { GlobalEtfConfig } from "../../config/globalEtfs.js";
import type { GlobalEtfHolding, GlobalEtfSnapshot } from "../../models/GlobalEtf.js";

function addOptional(current: number | undefined, next: number | undefined): number | undefined {
  if (current === undefined && next === undefined) return undefined;
  return (current ?? 0) + (next ?? 0);
}

function exposureComponentFrom(holding: GlobalEtfHolding): NonNullable<GlobalEtfHolding["exposureComponents"]>[number] {
  return {
    ticker: holding.sourceTicker ?? holding.ticker,
    name: holding.name,
    weightPercent: holding.weightPercent,
    assetType: holding.assetType
  };
}

export function aggregateGlobalHoldings(holdings: GlobalEtfHolding[]): GlobalEtfHolding[] {
  const byKey = new Map<string, GlobalEtfHolding>();

  for (const holding of holdings) {
    const current = byKey.get(holding.positionKey);
    if (!current) {
      byKey.set(holding.positionKey, {
        ...holding,
        exposureComponents: holding.exposureComponents ?? [exposureComponentFrom(holding)]
      });
      continue;
    }

    current.weightPercent = addOptional(current.weightPercent, holding.weightPercent);
    current.shares = addOptional(current.shares, holding.shares);
    current.marketValue = addOptional(current.marketValue, holding.marketValue);
    current.notionalValue = addOptional(current.notionalValue, holding.notionalValue);
    current.ticker ??= holding.ticker;
    current.identifier ??= holding.identifier;
    current.country ??= holding.country;
    current.sector ??= holding.sector;
    current.industry ??= holding.industry;
    current.assetType ??= holding.assetType;
    current.exposureComponents = [...(current.exposureComponents ?? [exposureComponentFrom(current)]), exposureComponentFrom(holding)];
  }

  return [...byKey.values()].sort((a, b) => (b.weightPercent ?? -1) - (a.weightPercent ?? -1));
}

export function buildGlobalEtfSignature(snapshot: Pick<GlobalEtfSnapshot, "etfCode" | "sourceAsOf" | "sourceStatus" | "rowCount" | "rawRowCount" | "holdings">): string {
  const payload = {
    etfCode: snapshot.etfCode,
    sourceStatus: snapshot.sourceStatus,
    sourceAsOf: snapshot.sourceAsOf,
    rowCount: snapshot.rowCount,
    rawRowCount: snapshot.rawRowCount,
    positions: snapshot.holdings.map((holding) => ({
      positionKey: holding.positionKey,
      ticker: holding.ticker,
      sourceTicker: holding.sourceTicker,
      name: holding.name,
      weightPercent: holding.weightPercent ?? null,
      shares: holding.shares ?? null,
      marketValue: holding.marketValue ?? null,
      notionalValue: holding.notionalValue ?? null,
      exposureComponents: holding.exposureComponents ?? null
    }))
  };

  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function buildGlobalSnapshot(
  etf: GlobalEtfConfig,
  input: {
    sourceAsOf: string;
    sourceUrl: string;
    rawRowCount: number;
    holdings: GlobalEtfHolding[];
    rawSnapshotId?: string;
  }
): GlobalEtfSnapshot {
  const holdings = aggregateGlobalHoldings(input.holdings).map((holding) => ({
    ...holding,
    sourceAsOf: input.sourceAsOf,
    sourceUrl: input.sourceUrl
  }));
  const unusableReason =
    holdings.length === 0
      ? "no_holdings"
      : etf.etfCode === "EUV" && ((input.rawRowCount > 200 && holdings.length > 200) || holdings.some((holding) => (holding.weightPercent ?? 0) > 100))
        ? "historical_aggregation_pollution"
        : undefined;
  const snapshot: GlobalEtfSnapshot = {
    snapshotId: randomUUID(),
    etfCode: etf.etfCode,
    fundName: etf.fundName,
    issuer: etf.issuer,
    sourceAsOf: input.sourceAsOf,
    fetchedAt: new Date(),
    sourceUrl: input.sourceUrl,
    sourceStatus: "ok",
    productGroup: "global_etf",
    market: "US",
    strategyType: etf.strategyType,
    rowCount: holdings.length,
    rawRowCount: input.rawRowCount,
    holdings,
    rawSnapshotId: input.rawSnapshotId,
    signature: "",
    unusableReason
  };

  snapshot.signature = buildGlobalEtfSignature(snapshot);
  return snapshot;
}
