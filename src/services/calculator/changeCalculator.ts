import type { EtfHoldingChange, HoldingChangeStatus } from "../../models/EtfHoldingChange.js";
import type { EtfDailyHolding } from "../../models/EtfDailyHolding.js";
import { round, toLots } from "../../utils/number.js";

export interface CalculateChangeInput {
  etfCode: string;
  tradeDate: string;
  current: Pick<EtfDailyHolding, "stockId" | "stockName" | "shares" | "weight"> | null;
  previous: Pick<EtfDailyHolding, "stockId" | "stockName" | "shares" | "weight" | "tradeDate"> | null;
  prevTotalUnits: number | null;
  currentTotalUnits: number | null;
  now?: Date;
}

function baseStatus(prevShares: number, currentShares: number): HoldingChangeStatus {
  if (prevShares === 0 && currentShares > 0) return "new";
  if (prevShares > 0 && currentShares === 0) return "exit";
  if (currentShares > prevShares) return "increase";
  if (currentShares < prevShares) return "decrease";
  return "unchanged";
}

export function calculateHoldingChange(input: CalculateChangeInput): EtfHoldingChange {
  if (!input.current && !input.previous) {
    throw new Error("Either current or previous holding is required");
  }

  const prevShares = input.previous?.shares ?? 0;
  const currentShares = input.current?.shares ?? 0;
  const diffShares = currentShares - prevShares;
  const diffPct = prevShares > 0 ? round((diffShares / prevShares) * 100) : null;
  const prevWeight = input.previous?.weight ?? null;
  const currentWeight = input.current?.weight ?? null;
  const diffWeightPoint =
    prevWeight !== null && currentWeight !== null ? round(currentWeight - prevWeight) : null;

  const now = input.now ?? new Date();
  const stockId = input.current?.stockId ?? input.previous?.stockId;
  const stockName = input.current?.stockName ?? input.previous?.stockName;

  if (!stockId || !stockName) {
    throw new Error("stockId and stockName are required");
  }

  return {
    etfCode: input.etfCode,
    tradeDate: input.tradeDate,
    stockId,
    stockName,
    prevTradeDate: input.previous?.tradeDate ?? null,
    prevShares,
    currentShares,
    diffShares,
    diffLots: toLots(diffShares),
    diffPct,
    prevWeight,
    currentWeight,
    diffWeightPoint,
    prevTotalUnits: input.prevTotalUnits,
    currentTotalUnits: input.currentTotalUnits,
    scaleRatio: null,
    expectedSharesByScale: null,
    activeDiffShares: null,
    activeDiffLots: null,
    activeDiffPct: null,
    activeSignalScore: null,
    status: baseStatus(prevShares, currentShares),
    createdAt: now,
    updatedAt: now
  };
}

export function calculateDailyChanges(
  input: Omit<CalculateChangeInput, "current" | "previous"> & {
    currentHoldings: Array<Pick<EtfDailyHolding, "stockId" | "stockName" | "shares" | "weight">>;
    previousHoldings: Array<Pick<EtfDailyHolding, "stockId" | "stockName" | "shares" | "weight" | "tradeDate">>;
  }
): EtfHoldingChange[] {
  const currentByStock = new Map(input.currentHoldings.map((holding) => [holding.stockId, holding]));
  const previousByStock = new Map(input.previousHoldings.map((holding) => [holding.stockId, holding]));
  const stockIds = new Set([...currentByStock.keys(), ...previousByStock.keys()]);

  return [...stockIds].map((stockId) =>
    calculateHoldingChange({
      etfCode: input.etfCode,
      tradeDate: input.tradeDate,
      current: currentByStock.get(stockId) ?? null,
      previous: previousByStock.get(stockId) ?? null,
      prevTotalUnits: input.prevTotalUnits,
      currentTotalUnits: input.currentTotalUnits,
      now: input.now
    })
  );
}
