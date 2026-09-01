import { app, type HttpRequest, type InvocationContext } from "@azure/functions";
import { getDb } from "../db/mongo.js";
import type { EtfHoldingChange } from "../models/EtfHoldingChange.js";
import { maskMemberResults } from "../domain/memberAccess.js";
import { getOrSetDailyCache } from "../services/cache/dailyDataCache.js";
import { memberJsonResponse, memberRequestAccess } from "./memberResponse.js";
import { badRequest } from "./response.js";

export async function getEtfRanking(request: HttpRequest, _context: InvocationContext) {
  const date = request.query.get("date");
  if (!date) return badRequest("date is required");

  const body = await getOrSetDailyCache(["etf", "active", "ranking", date], async () => {
    const db = await getDb();
    const ranking = await db
      .collection<EtfHoldingChange>("etf_holding_changes")
      .find({ tradeDate: date, activeSignalScore: { $ne: null } })
      .sort({ activeSignalScore: -1, activeDiffShares: -1 })
      .limit(100)
      .toArray();

    return { date, ranking };
  });

  const access = await memberRequestAccess(request);
  return memberJsonResponse({ ...body, ranking: maskMemberResults(body.ranking, access.authenticated) });
}

app.http("getEtfRanking", {
  methods: ["GET"],
  route: "etf/active/ranking",
  authLevel: "anonymous",
  handler: getEtfRanking
});
