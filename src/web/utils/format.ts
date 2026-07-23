import type { NullableNumber } from "../contracts/dashboard";

export type ValueTone = "positive" | "negative" | "neutral";

export function valueTone(value: NullableNumber | undefined): ValueTone {
  if (value === null || value === undefined || Number.isNaN(value) || value === 0) return "neutral";
  return value > 0 ? "positive" : "negative";
}

export function directionTone(direction: string | null | undefined): ValueTone {
  if (direction === "increase") return "positive";
  if (direction === "decrease") return "negative";
  return "neutral";
}

export function formatNumber(value: NullableNumber | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("zh-TW", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

export function formatSigned(value: NullableNumber | undefined, digits = 0): string {
  if (value === null || value === undefined) return "-";
  return `${value > 0 ? "+" : ""}${formatNumber(value, digits)}`;
}

export function formatLots(value: NullableNumber | undefined): string {
  return formatSigned(value, 0);
}

export function formatWeight(value: NullableNumber | undefined, digits = 2): string {
  if (value === null || value === undefined) return "-";
  return value === 0 ? "<0.01%" : `${formatNumber(value, digits)}%`;
}

export function formatSignedPp(value: NullableNumber | undefined, digits = 2): string {
  if (value === null || value === undefined) return "-";
  return `${value > 0 ? "+" : ""}${formatNumber(value, digits)} pp`;
}

export function formatMoney(value: NullableNumber | undefined): string {
  if (value === null || value === undefined) return "-";
  if (Math.abs(value) >= 100_000_000) return `${formatNumber(value / 100_000_000, 2)} 億`;
  if (Math.abs(value) >= 10_000) return `${formatNumber(value / 10_000, 1)} 萬`;
  return formatNumber(value);
}

export function directionLabel(value: NullableNumber | undefined, positive = "加碼", negative = "減碼"): string {
  if (value === null || value === undefined || value === 0) return "持平";
  return value > 0 ? positive : negative;
}

export function delayDays(from: string | undefined, to: string | undefined): number | null {
  if (!from || !to) return null;
  const fromDate = new Date(`${from.slice(0, 10)}T00:00:00Z`);
  const toDate = new Date(`${to.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return null;
  return Math.max(0, Math.floor((toDate.getTime() - fromDate.getTime()) / 86_400_000));
}
