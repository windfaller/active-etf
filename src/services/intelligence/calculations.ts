import { round } from "../../utils/number.js";

export type SignalDirection = "increase" | "decrease" | "neutral" | "unknown";
export type ConfidenceLevel = "high" | "medium" | "low";

export interface SignalThresholds {
  minActiveLots: number;
  minWeightPoint: number;
}

export interface DirectionInput {
  activeDiffLots: number | null;
  diffWeightPoint: number | null;
}

export interface DirectionalCounts {
  increase: number;
  decrease: number;
  neutral: number;
  unknown: number;
}

export interface ConsensusResult {
  direction: Exclude<SignalDirection, "unknown">;
  sameDirectionCount: number;
  oppositeDirectionCount: number;
  directionalEtfCount: number;
  neutralCount: number;
  ratio: number | null;
  hasConsensus: boolean;
}

export interface DailyDirectionObservation {
  date: string;
  direction: SignalDirection;
  activeNetLots: number | null;
}

export interface ReversalResult {
  detected: boolean;
  date: string | null;
  from: SignalDirection;
  to: SignalDirection;
  priorTradingDays: number;
  beforeActiveNetLots: number | null;
  afterActiveNetLots: number | null;
}

export interface ConfidenceInput {
  tracked: number;
  available: number;
  delayed: number;
  scaleComplete: number;
  requiredObservations: number;
  actualObservations: number;
  dominantShare: number | null;
  directionalRatio: number | null;
}

export const DEFAULT_SIGNAL_THRESHOLDS: SignalThresholds = {
  minActiveLots: 0.01,
  minWeightPoint: 0.0001
};

export function directionForChange(
  input: DirectionInput,
  thresholds: SignalThresholds = DEFAULT_SIGNAL_THRESHOLDS
): SignalDirection {
  const lots = input.activeDiffLots;
  const weight = input.diffWeightPoint;
  if (lots === null && weight === null) return "unknown";
  if ((lots ?? 0) > thresholds.minActiveLots || (weight ?? 0) > thresholds.minWeightPoint) return "increase";
  if ((lots ?? 0) < -thresholds.minActiveLots || (weight ?? 0) < -thresholds.minWeightPoint) return "decrease";
  return "neutral";
}

export function countDirections(directions: SignalDirection[]): DirectionalCounts {
  return directions.reduce<DirectionalCounts>(
    (counts, direction) => ({ ...counts, [direction]: counts[direction] + 1 }),
    { increase: 0, decrease: 0, neutral: 0, unknown: 0 }
  );
}

export function consensusFromDirections(directions: SignalDirection[]): ConsensusResult {
  const counts = countDirections(directions);
  const direction = counts.increase >= counts.decrease ? "increase" : "decrease";
  const sameDirectionCount = direction === "increase" ? counts.increase : counts.decrease;
  const oppositeDirectionCount = direction === "increase" ? counts.decrease : counts.increase;
  const directionalEtfCount = counts.increase + counts.decrease;
  const ratio = directionalEtfCount > 0 ? sameDirectionCount / directionalEtfCount : null;
  return {
    direction: directionalEtfCount > 0 ? direction : "neutral",
    sameDirectionCount,
    oppositeDirectionCount,
    directionalEtfCount,
    neutralCount: counts.neutral,
    ratio,
    hasConsensus:
      sameDirectionCount >= 2 &&
      sameDirectionCount > oppositeDirectionCount &&
      ratio !== null &&
      ratio >= 0.6
  };
}

export function relationBetweenEtfAndInstitution(
  etfDirection: SignalDirection,
  institutionNetShares: number | null
): "aligned" | "divergent" | "insufficient" {
  if (institutionNetShares === null || etfDirection === "unknown" || etfDirection === "neutral" || institutionNetShares === 0) {
    return "insufficient";
  }
  const institutionDirection = institutionNetShares > 0 ? "increase" : "decrease";
  return institutionDirection === etfDirection ? "aligned" : "divergent";
}

export function consecutiveDirection(observations: DailyDirectionObservation[]): {
  direction: SignalDirection;
  tradingDays: number;
  startDate: string | null;
  latestDate: string | null;
  cumulativeActiveNetLots: number | null;
} {
  const ordered = [...observations].sort((a, b) => b.date.localeCompare(a.date));
  const latest = ordered[0];
  if (!latest || latest.direction === "neutral" || latest.direction === "unknown") {
    return {
      direction: latest?.direction ?? "unknown",
      tradingDays: 0,
      startDate: null,
      latestDate: latest?.date ?? null,
      cumulativeActiveNetLots: latest?.activeNetLots ?? null
    };
  }
  const actualRun: DailyDirectionObservation[] = [];
  for (const row of ordered) {
    if (row.direction !== latest.direction) break;
    actualRun.push(row);
  }
  const values = actualRun.map((row) => row.activeNetLots).filter((value): value is number => value !== null);
  return {
    direction: latest.direction,
    tradingDays: actualRun.length,
    startDate: actualRun.at(-1)?.date ?? latest.date,
    latestDate: latest.date,
    cumulativeActiveNetLots: values.length ? round(values.reduce((sum, value) => sum + value, 0)) : null
  };
}

export function detectReversal(observations: DailyDirectionObservation[], minimumPriorDays = 2): ReversalResult {
  const ordered = [...observations].sort((a, b) => b.date.localeCompare(a.date));
  const current = ordered[0];
  if (!current || current.direction === "neutral" || current.direction === "unknown") {
    return { detected: false, date: null, from: "unknown", to: current?.direction ?? "unknown", priorTradingDays: 0, beforeActiveNetLots: null, afterActiveNetLots: current?.activeNetLots ?? null };
  }
  const opposite = current.direction === "increase" ? "decrease" : "increase";
  let priorTradingDays = 0;
  let beforeActiveNetLots = 0;
  let hasBeforeValue = false;
  for (const row of ordered.slice(1)) {
    if (row.direction !== opposite) break;
    priorTradingDays += 1;
    if (row.activeNetLots !== null) {
      beforeActiveNetLots += row.activeNetLots;
      hasBeforeValue = true;
    }
  }
  return {
    detected: priorTradingDays >= minimumPriorDays,
    date: priorTradingDays >= minimumPriorDays ? current.date : null,
    from: priorTradingDays ? opposite : "unknown",
    to: current.direction,
    priorTradingDays,
    beforeActiveNetLots: hasBeforeValue ? round(beforeActiveNetLots) : null,
    afterActiveNetLots: current.activeNetLots
  };
}

export function jaccardOverlap(a: Iterable<string>, b: Iterable<string>): {
  intersectionCount: number;
  unionCount: number;
  similarity: number | null;
} {
  const left = new Set(a);
  const right = new Set(b);
  const intersectionCount = [...left].filter((key) => right.has(key)).length;
  const unionCount = new Set([...left, ...right]).size;
  return { intersectionCount, unionCount, similarity: unionCount ? intersectionCount / unionCount : null };
}

export function weightedOverlap(a: ReadonlyMap<string, number>, b: ReadonlyMap<string, number>): number | null {
  if (!a.size || !b.size) return null;
  let overlap = 0;
  for (const [key, weight] of a) overlap += Math.min(Math.max(0, weight), Math.max(0, b.get(key) ?? 0));
  return round(overlap, 4);
}

export function concentrationMetrics(weights: Array<number | null | undefined>): {
  top5: number | null;
  top10: number | null;
  hhi: number | null;
} {
  const valid = weights.filter((weight): weight is number => Number.isFinite(weight) && (weight ?? 0) >= 0).sort((a, b) => b - a);
  if (!valid.length) return { top5: null, top10: null, hhi: null };
  return {
    top5: round(valid.slice(0, 5).reduce((sum, weight) => sum + weight, 0), 4),
    top10: round(valid.slice(0, 10).reduce((sum, weight) => sum + weight, 0), 4),
    hhi: round(valid.reduce((sum, weight) => sum + Math.pow(weight / 100, 2), 0), 6)
  };
}

export function adjustmentIntensity(weightChanges: Array<number | null | undefined>): number | null {
  const valid = weightChanges.filter((value): value is number => Number.isFinite(value));
  return valid.length ? round(valid.reduce((sum, value) => sum + Math.abs(value), 0) / 2, 4) : null;
}

export function percentileRank(value: number | null, population: Array<number | null | undefined>): number | null {
  if (value === null) return null;
  const valid = population.filter((candidate): candidate is number => Number.isFinite(candidate));
  if (valid.length < 5) return null;
  const below = valid.filter((candidate) => candidate < value).length;
  const equal = valid.filter((candidate) => candidate === value).length;
  return Math.round(((below + equal * 0.5) / valid.length) * 100);
}

export function confidenceForSignal(input: ConfidenceInput): { level: ConfidenceLevel; reason: string } {
  const coverageRatio = input.tracked > 0 ? input.available / input.tracked : 0;
  const scaleRatio = input.available > 0 ? input.scaleComplete / input.available : 0;
  const completeWindow = input.actualObservations >= input.requiredObservations;
  const notDominated = input.dominantShare === null || input.dominantShare <= 0.6;
  const directionIsBroad = input.directionalRatio === null || input.directionalRatio >= 0.6;
  if (coverageRatio >= 0.8 && scaleRatio >= 0.8 && completeWindow && input.delayed === 0 && notDominated && directionIsBroad) {
    return { level: "high", reason: "ETF 涵蓋與規模校正資料完整，觀察期足夠，且訊號未由單一 ETF 主導。" };
  }
  if (coverageRatio >= 0.5 && scaleRatio >= 0.5 && input.actualObservations >= Math.min(3, input.requiredObservations)) {
    const limitations = [
      input.delayed > 0 ? `${input.delayed} 檔 ETF 延遲` : null,
      !completeWindow ? "觀察期尚未完整" : null,
      !notDominated ? "單一 ETF 影響偏高" : null,
      !directionIsBroad ? "同方向 ETF 比例不足" : null,
      scaleRatio < 0.8 ? "部分資料缺少完整規模校正" : null
    ].filter(Boolean);
    return { level: "medium", reason: limitations.length ? limitations.join("；") : "涵蓋率足夠，但仍有部分資料限制。" };
  }
  return { level: "low", reason: "ETF 涵蓋、規模校正或有效交易日資料不足，僅能作低可信度觀察。" };
}
