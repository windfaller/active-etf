import type { EtfHoldingChange, HoldingChangeStatus } from "../../models/EtfHoldingChange.js";
import { round, toLots } from "../../utils/number.js";

export interface ActiveSignalOptions {
  consecutiveIncreaseDays?: number;
}

export function activeThreshold(expectedSharesByScale: number): number {
  return Math.max(1000, expectedSharesByScale * 0.001);
}

function activeStatus(
  currentStatus: HoldingChangeStatus,
  activeDiffShares: number,
  threshold: number
): HoldingChangeStatus {
  if (currentStatus === "new" || currentStatus === "exit") {
    return currentStatus;
  }

  if (activeDiffShares > threshold) {
    return "scale_adjusted_increase";
  }

  if (activeDiffShares < -threshold) {
    return "scale_adjusted_decrease";
  }

  return currentStatus;
}

function scoreSignal(change: EtfHoldingChange, consecutiveIncreaseDays: number): number {
  let score = 0;

  if ((change.activeDiffShares ?? 0) > 0) score += 40;
  if ((change.diffWeightPoint ?? 0) > 0) score += 30;
  if ((change.activeDiffPct ?? 0) > 1) score += 10;
  if (consecutiveIncreaseDays >= 3) score += 20;

  return Math.min(score, 100);
}

export function applyActiveSignal(
  change: EtfHoldingChange,
  options: ActiveSignalOptions = {}
): EtfHoldingChange {
  if (
    change.prevTotalUnits === null ||
    change.currentTotalUnits === null ||
    change.prevTotalUnits <= 0 ||
    change.prevShares <= 0
  ) {
    return {
      ...change,
      activeSignalScore: null
    };
  }

  const scaleRatio = change.currentTotalUnits / change.prevTotalUnits;
  const expectedSharesByScale = change.prevShares * scaleRatio;
  const activeDiffShares = change.currentShares - expectedSharesByScale;
  const activeDiffPct =
    expectedSharesByScale > 0 ? round((activeDiffShares / expectedSharesByScale) * 100) : null;
  const threshold = activeThreshold(expectedSharesByScale);
  const enriched: EtfHoldingChange = {
    ...change,
    scaleRatio: round(scaleRatio, 8),
    expectedSharesByScale: round(expectedSharesByScale, 4),
    activeDiffShares: round(activeDiffShares, 4),
    activeDiffLots: round(toLots(activeDiffShares), 4),
    activeDiffPct,
    status: activeStatus(change.status, activeDiffShares, threshold)
  };

  return {
    ...enriched,
    activeSignalScore: scoreSignal(enriched, options.consecutiveIncreaseDays ?? 0)
  };
}

export function applyActiveSignals(
  changes: EtfHoldingChange[],
  consecutiveDaysByStockId: Map<string, number> = new Map()
): EtfHoldingChange[] {
  return changes.map((change) =>
    applyActiveSignal(change, {
      consecutiveIncreaseDays: consecutiveDaysByStockId.get(change.stockId) ?? 0
    })
  );
}
