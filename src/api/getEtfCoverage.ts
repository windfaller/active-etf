import { app, type HttpRequest, type InvocationContext } from "@azure/functions";
import { configuredEtfs } from "../config/etfs.js";
import { getDb } from "../db/mongo.js";
import type { EtfDailySummary } from "../models/EtfDailySummary.js";
import { assertTradeDate } from "../utils/date.js";
import { badRequest, jsonResponse } from "./response.js";

export async function getEtfCoverage(request: HttpRequest, _context: InvocationContext) {
  const dateParam = request.query.get("date");
  const date = dateParam ? assertTradeDate(dateParam) : null;
  const enabledEtfs = configuredEtfs.filter((etf) => etf.enabled);
  const etfCodes = enabledEtfs.map((etf) => etf.etfCode);

  if (!etfCodes.length) return badRequest("No enabled ETFs are configured");

  const db = await getDb();
  const latestRows = await db
    .collection<EtfDailySummary>("etf_daily_summary")
    .aggregate<{ etfCode: string; latestTradeDate: string; updatedAt: Date }>([
      { $match: { etfCode: { $in: etfCodes } } },
      { $sort: { tradeDate: -1 } },
      {
        $group: {
          _id: "$etfCode",
          latestTradeDate: { $first: "$tradeDate" },
          updatedAt: { $first: "$updatedAt" }
        }
      },
      { $project: { _id: 0, etfCode: "$_id", latestTradeDate: 1, updatedAt: 1 } }
    ])
    .toArray();

  const availableOnDate = date
    ? new Set(
        (
          await db
            .collection<EtfDailySummary>("etf_daily_summary")
            .find({ etfCode: { $in: etfCodes }, tradeDate: date }, { projection: { _id: 0, etfCode: 1 } })
            .toArray()
        ).map((row) => row.etfCode)
      )
    : new Set<string>();

  const latestByCode = new Map(latestRows.map((row) => [row.etfCode, row]));
  const etfs = enabledEtfs.map((etf) => {
    const latest = latestByCode.get(etf.etfCode);
    const hasSelectedDate = date ? availableOnDate.has(etf.etfCode) : false;
    const latestTradeDate = latest?.latestTradeDate ?? null;
    const status =
      !date || hasSelectedDate
        ? "available"
        : latestTradeDate === null
          ? "missing"
          : latestTradeDate < date
            ? "stale"
            : "newer_available";

    return {
      etfCode: etf.etfCode,
      name: etf.name,
      issuer: etf.issuer,
      providerId: etf.source.providerId ?? "ezmoney",
      latestTradeDate,
      hasSelectedDate,
      status,
      updatedAt: latest?.updatedAt ?? null
    };
  });

  return jsonResponse({
    date,
    trackedCount: etfs.length,
    availableCount: date ? etfs.filter((etf) => etf.hasSelectedDate).length : 0,
    staleCount: date ? etfs.filter((etf) => etf.status === "stale" || etf.status === "missing").length : 0,
    etfs
  });
}

app.http("getEtfCoverage", {
  methods: ["GET"],
  route: "etfs/coverage",
  authLevel: "anonymous",
  handler: getEtfCoverage
});
