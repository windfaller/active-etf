import type { ObjectId } from "mongodb";
import type { GlobalEtfSnapshot } from "../../models/GlobalEtf.js";

export type SnapshotReadMetadata = Pick<GlobalEtfSnapshot, "etfCode" | "sourceAsOf" | "fetchedAt" | "strategyType" | "filedAt" | "unusableReason" | "sourceStatus"> & { _id: ObjectId };
export const snapshotReadMetadataProjection = { _id: 1, etfCode: 1, sourceAsOf: 1, fetchedAt: 1, strategyType: 1, filedAt: 1, unusableReason: 1, sourceStatus: 1 } as const;
const isoDate = /^\d{4}-\d{2}-\d{2}$/u;
function selectionDate(row: SnapshotReadMetadata): string {
  return row.strategyType === "13f" ? row.filedAt ?? row.sourceAsOf : row.sourceAsOf;
}
function fetchedAt(row: SnapshotReadMetadata): number {
  const value = row.fetchedAt instanceof Date ? row.fetchedAt.getTime() : new Date(row.fetchedAt).getTime();
  return Number.isFinite(value) ? value : 0;
}
// Select from index-only metadata. Source-status semantics match the existing
// report: unusable rows and malformed dates are excluded, not other statuses.
export function selectLatestSnapshotIds(rows: SnapshotReadMetadata[], sourceDate?: string): ObjectId[] {
  const selected = new Map<string, SnapshotReadMetadata>();
  for (const row of rows) {
    if (!isoDate.test(row.sourceAsOf) || (sourceDate && row.sourceAsOf > sourceDate) || row.unusableReason != null) continue;
    const current = selected.get(row.etfCode);
    if (!current || selectionDate(row) > selectionDate(current) || (selectionDate(row) === selectionDate(current) && fetchedAt(row) > fetchedAt(current))) selected.set(row.etfCode, row);
  }
  return [...selected.values()].map(row => row._id);
}
