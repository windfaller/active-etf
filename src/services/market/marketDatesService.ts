import type { Db } from "mongodb";
import { configuredEtfs } from "../../config/etfs.js";
import type { EtfHoldingChange } from "../../models/EtfHoldingChange.js";

export function safeMarketDateLimit(limit = 180): number {
  return Math.max(1, Math.min(Math.trunc(limit) || 180, 365));
}

export async function availableMarketDates(db: Db, limit = 180): Promise<string[]> {
  const enabledCodes = configuredEtfs.filter((etf) => etf.enabled).map((etf) => etf.etfCode);
  const rows = await db
    .collection<EtfHoldingChange>("etf_holding_changes")
    .aggregate<{ _id: string }>([
      {
        $match: {
          etfCode: { $in: enabledCodes },
          tradeDate: { $regex: "^\\d{4}-\\d{2}-\\d{2}$" }
        }
      },
      { $group: { _id: "$tradeDate" } },
      { $sort: { _id: -1 } },
      { $limit: safeMarketDateLimit(limit) }
    ])
    .toArray();

  return rows.map((row) => row._id);
}
