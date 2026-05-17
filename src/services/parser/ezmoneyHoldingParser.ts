import type { EtfDailyHolding } from "../../models/EtfDailyHolding.js";
import { sourceDateToIsoDate } from "../../utils/date.js";
import { toLots } from "../../utils/number.js";

export interface ParseHoldingInput {
  etfCode: string;
  tradeDate: string;
  rawSnapshotId: string;
  rawBody: string;
  contentType: string;
}

export function parseEzmoneyHoldings(_input: ParseHoldingInput): EtfDailyHolding[] {
  const input = _input;
  const parsed = JSON.parse(input.rawBody) as {
    asset?: Array<{
      AssetCode?: string;
      Details?: Array<{
        DetailCode?: string;
        DetailName?: string;
        Share?: number;
        NavRate?: number;
        Amount?: number;
        TranDate?: string;
      }>;
    }>;
  };
  const stockAsset = parsed.asset?.find((asset) => asset.AssetCode === "ST");
  const details = stockAsset?.Details;

  if (!details?.length) {
    throw new Error("Ezmoney PCF response is missing asset[AssetCode=ST].Details");
  }

  const now = new Date();
  return details.map((item) => {
    if (!item.DetailCode || !item.DetailName || typeof item.Share !== "number") {
      throw new Error(`Invalid holding row: ${JSON.stringify(item)}`);
    }

    const tradeDate = item.TranDate ? sourceDateToIsoDate(item.TranDate) : input.tradeDate;
    if (tradeDate !== input.tradeDate) {
      throw new Error(`Holding tradeDate mismatch: expected ${input.tradeDate}, got ${tradeDate}`);
    }

    return {
      etfCode: input.etfCode,
      tradeDate,
      stockId: item.DetailCode,
      stockName: item.DetailName,
      shares: item.Share,
      lots: toLots(item.Share),
      weight: typeof item.NavRate === "number" ? item.NavRate : null,
      marketValue: typeof item.Amount === "number" ? item.Amount : null,
      source: "ezmoney",
      rawSnapshotId: input.rawSnapshotId,
      createdAt: now,
      updatedAt: now
    };
  });
}
