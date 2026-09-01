import { app, type HttpRequest, type InvocationContext } from "@azure/functions";
import { getDb } from "../db/mongo.js";
import type { EtfDailySummary } from "../models/EtfDailySummary.js";
import { maskMemberResults } from "../domain/memberAccess.js";
import { getOrSetDailyCache } from "../services/cache/dailyDataCache.js";
import { memberJsonResponse, memberRequestAccess } from "./memberResponse.js";
import { badRequest } from "./response.js";

export async function getEtfSummaryHistory(request: HttpRequest, _context: InvocationContext) {
  const etfCode = request.params.etfCode;
  const limitParam = request.query.get("limit");
  const limit = Math.min(180, Math.max(1, Number(limitParam ?? 90)));
  if (!etfCode || Number.isNaN(limit)) return badRequest("etfCode and numeric limit are required");

  const body = await getOrSetDailyCache(["etf", etfCode, "summary-history", limit], async () => {
    const db = await getDb();
    const summaries = await db
      .collection<EtfDailySummary>("etf_daily_summary")
      .find({ etfCode })
      .sort({ tradeDate: -1 })
      .limit(limit)
      .toArray();

    return { etfCode, summaries };
  });

  const access = await memberRequestAccess(request);
  return memberJsonResponse({ ...body, summaries: maskMemberResults(body.summaries, access.authenticated) });
}

app.http("getEtfSummaryHistory", {
  methods: ["GET"],
  route: "etf/{etfCode}/summary-history",
  authLevel: "anonymous",
  handler: getEtfSummaryHistory
});
