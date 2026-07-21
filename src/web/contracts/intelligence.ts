export type ConfidenceLevel = "high" | "medium" | "low";
export type SignalDirection = "increase" | "decrease" | "neutral" | "unknown";

export interface IntelligenceCoverage {
  tracked: number;
  available: number;
  delayed: number;
}

export interface IntelligenceConfidence {
  level: ConfidenceLevel;
  reason: string;
}

export interface IntelligenceMeta {
  generatedAt: string;
  sourceAsOf: string | null;
  coverage: IntelligenceCoverage;
  confidence: IntelligenceConfidence;
}
