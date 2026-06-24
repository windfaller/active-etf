import type {
  GlobalEtfAggregateChange,
  GlobalEtfHolding,
  GlobalEtfHoldingChange,
  GlobalEtfSnapshot
} from "../../models/GlobalEtf.js";

function round(value: number, digits = 4): number {
  return Number(value.toFixed(digits));
}

function compareOptional(current?: number, previous?: number): number | undefined {
  if (current === undefined || previous === undefined) return undefined;
  return round(current - previous);
}

export function calculateGlobalEtfChanges(current: GlobalEtfSnapshot, previous: GlobalEtfSnapshot | null): GlobalEtfHoldingChange[] {
  const previousByKey = new Map((previous?.holdings ?? []).map((holding) => [holding.positionKey, holding]));
  const currentByKey = new Map(current.holdings.map((holding) => [holding.positionKey, holding]));
  const keys = new Set([...previousByKey.keys(), ...currentByKey.keys()]);
  const changes: GlobalEtfHoldingChange[] = [];

  for (const key of keys) {
    const currentHolding = currentByKey.get(key);
    const previousHolding = previousByKey.get(key);
    const source = currentHolding ?? previousHolding;
    if (!source) continue;

    const deltaPp = compareOptional(currentHolding?.weightPercent, previousHolding?.weightPercent);
    const deltaShares = compareOptional(currentHolding?.shares, previousHolding?.shares);
    const deltaMarketValue = compareOptional(currentHolding?.marketValue, previousHolding?.marketValue);
    const status =
      !previousHolding && currentHolding
        ? "new"
        : previousHolding && !currentHolding
          ? "exit"
          : (deltaPp ?? 0) > 0
            ? "increase"
            : (deltaPp ?? 0) < 0
              ? "decrease"
              : "unchanged";

    changes.push({
      etfCode: current.etfCode,
      sourceAsOf: current.sourceAsOf,
      prevSourceAsOf: previous?.sourceAsOf ?? null,
      positionKey: key,
      ticker: source.ticker,
      name: source.name,
      sector: source.sector,
      country: source.country,
      assetType: source.assetType,
      prevWeightPercent: previousHolding?.weightPercent,
      currentWeightPercent: currentHolding?.weightPercent,
      deltaPp,
      prevShares: previousHolding?.shares,
      currentShares: currentHolding?.shares,
      deltaShares,
      prevMarketValue: previousHolding?.marketValue,
      currentMarketValue: currentHolding?.marketValue,
      deltaMarketValue,
      status
    });
  }

  return changes.sort((a, b) => Math.abs(b.deltaPp ?? 0) - Math.abs(a.deltaPp ?? 0));
}

function aggregateByField(holdings: GlobalEtfHolding[], field: "sector" | "country"): Map<string, number> {
  const totals = new Map<string, number>();
  for (const holding of holdings) {
    const key = holding[field]?.trim();
    if (!key) continue;
    totals.set(key, (totals.get(key) ?? 0) + (holding.weightPercent ?? 0));
  }
  return totals;
}

export function calculateGlobalEtfAggregateChanges(current: GlobalEtfSnapshot, previous: GlobalEtfSnapshot | null, field: "sector" | "country"): GlobalEtfAggregateChange[] {
  if (!previous) return [];
  const currentTotals = aggregateByField(current.holdings, field);
  const previousTotals = aggregateByField(previous.holdings, field);
  const keys = new Set([...currentTotals.keys(), ...previousTotals.keys()]);

  return [...keys]
    .map((name) => {
      const currentWeightPercent = currentTotals.get(name) ?? 0;
      const prevWeightPercent = previousTotals.get(name) ?? 0;
      return {
        name,
        prevWeightPercent,
        currentWeightPercent,
        deltaPp: round(currentWeightPercent - prevWeightPercent)
      };
    })
    .filter((row) => Math.abs(row.deltaPp) >= 0.1)
    .sort((a, b) => Math.abs(b.deltaPp) - Math.abs(a.deltaPp));
}

export function splitGlobalEtfChanges(changes: GlobalEtfHoldingChange[]) {
  return {
    newPositions: changes.filter((change) => change.status === "new"),
    exitedPositions: changes.filter((change) => change.status === "exit"),
    weightChanges: changes.filter((change) => change.deltaPp !== undefined && Math.abs(change.deltaPp) >= 0.01),
    shareChanges: changes.filter((change) => change.deltaShares !== undefined && change.deltaShares !== 0),
    marketValueChanges: changes.filter((change) => change.deltaMarketValue !== undefined && Math.abs(change.deltaMarketValue) >= 1)
  };
}
