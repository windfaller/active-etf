import type { Db } from "mongodb";
import type { EtfHoldingChange } from "../../models/EtfHoldingChange.js";
import type { StockSectorProfile } from "../../models/StockSectorProfile.js";
import { round } from "../../utils/number.js";
import { sectorProfileForStock } from "./sectorMapping.js";

export interface TagMovementStock {
  stockId: string;
  stockName: string;
  activeDiffLots: number;
  diffWeightPoint: number;
  currentWeight: number | null;
  status: string;
}

export interface TagMovementRow {
  tag: string;
  direction: "increase" | "decrease" | "mixed" | "flat";
  stockCount: number;
  increaseStockCount: number;
  decreaseStockCount: number;
  totalActiveDiffLots: number;
  totalDiffWeightPoint: number;
  totalCurrentWeight: number;
  movementScore: number;
  topStocks: TagMovementStock[];
}

function tagsForChange(change: EtfHoldingChange, profile?: StockSectorProfile): string[] {
  const fallback = sectorProfileForStock(change.stockId, change.stockName);
  const tags = profile?.themeTags?.length ? profile.themeTags : fallback.themeTags;
  if (tags.length) return tags;
  return fallback.sector === "其他" ? ["未分類"] : [fallback.sector];
}

export function buildTagMovementRows(
  changes: EtfHoldingChange[],
  profileByStockId: Map<string, StockSectorProfile> = new Map()
): TagMovementRow[] {
  const rowsByTag = new Map<string, TagMovementRow>();

  for (const change of changes) {
    const activeDiffLots = change.activeDiffLots ?? change.diffLots;
    const diffWeightPoint = change.diffWeightPoint ?? 0;
    if (activeDiffLots === 0 && diffWeightPoint === 0 && change.status === "unchanged") continue;

    const tags = tagsForChange(change, profileByStockId.get(change.stockId));
    for (const tag of tags) {
      const row =
        rowsByTag.get(tag) ??
        ({
          tag,
          direction: "flat",
          stockCount: 0,
          increaseStockCount: 0,
          decreaseStockCount: 0,
          totalActiveDiffLots: 0,
          totalDiffWeightPoint: 0,
          totalCurrentWeight: 0,
          movementScore: 0,
          topStocks: []
        } satisfies TagMovementRow);

      row.stockCount += 1;
      row.increaseStockCount += activeDiffLots > 0 || diffWeightPoint > 0 ? 1 : 0;
      row.decreaseStockCount += activeDiffLots < 0 || diffWeightPoint < 0 ? 1 : 0;
      row.totalActiveDiffLots = round(row.totalActiveDiffLots + activeDiffLots);
      row.totalDiffWeightPoint = round(row.totalDiffWeightPoint + diffWeightPoint);
      row.totalCurrentWeight = round(row.totalCurrentWeight + (change.currentWeight ?? 0));
      row.topStocks.push({
        stockId: change.stockId,
        stockName: change.stockName,
        activeDiffLots: round(activeDiffLots),
        diffWeightPoint: round(diffWeightPoint),
        currentWeight: change.currentWeight,
        status: change.status
      });
      rowsByTag.set(tag, row);
    }
  }

  return [...rowsByTag.values()]
    .map((row) => {
      const direction: TagMovementRow["direction"] =
        row.totalActiveDiffLots > 0 && row.increaseStockCount >= row.decreaseStockCount
          ? "increase"
          : row.totalActiveDiffLots < 0 && row.decreaseStockCount >= row.increaseStockCount
            ? "decrease"
            : row.increaseStockCount > 0 && row.decreaseStockCount > 0
              ? "mixed"
              : "flat";

      return {
        ...row,
        direction,
        movementScore: Math.round((Math.abs(row.totalActiveDiffLots) * 100 + Math.abs(row.totalDiffWeightPoint) * 10000) / 100),
        topStocks: row.topStocks.sort((a, b) => Math.abs(b.activeDiffLots) - Math.abs(a.activeDiffLots)).slice(0, 4)
      };
    })
    .sort((a, b) => {
      if (a.tag === "未分類" && b.tag !== "未分類") return 1;
      if (b.tag === "未分類" && a.tag !== "未分類") return -1;
      return b.movementScore - a.movementScore || Math.abs(b.totalDiffWeightPoint) - Math.abs(a.totalDiffWeightPoint);
    });
}

export async function tagMovementsForChanges(db: Db, changes: EtfHoldingChange[]): Promise<TagMovementRow[]> {
  const stockIds = [...new Set(changes.map((change) => change.stockId))];
  if (!stockIds.length) return [];

  const profiles = await db.collection<StockSectorProfile>("stock_sector_profiles").find({ stockId: { $in: stockIds } }).toArray();
  return buildTagMovementRows(changes, new Map(profiles.map((profile) => [profile.stockId, profile])));
}
