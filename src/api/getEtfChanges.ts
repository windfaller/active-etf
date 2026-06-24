import { app, type HttpRequest, type InvocationContext } from "@azure/functions";
import { getDb } from "../db/mongo.js";
import type { EtfHoldingChange } from "../models/EtfHoldingChange.js";
import { getOrSetDailyCache } from "../services/cache/dailyDataCache.js";
import { tagMovementsForChanges } from "../services/sector/tagMovementService.js";
import { badRequest, jsonResponse } from "./response.js";

export async function getEtfChanges(request: HttpRequest, _context: InvocationContext) {
  const etfCode = request.params.etfCode;
  const date = request.query.get("date");
  if (!etfCode || !date) return badRequest("etfCode and date are required");

  const body = await getOrSetDailyCache(["etf", etfCode, "changes", date], async () => {
    const db = await getDb();
    const changes = await db
      .collection<EtfHoldingChange>("etf_holding_changes")
      .find({ etfCode, tradeDate: date })
      .toArray();

    return {
      etfCode,
      date,
      topIncreases: changes.filter((change) => change.diffShares > 0).sort((a, b) => b.diffShares - a.diffShares),
      topDecreases: changes.filter((change) => change.diffShares < 0).sort((a, b) => a.diffShares - b.diffShares),
      topActiveIncreases: changes
        .filter((change) => (change.activeDiffShares ?? 0) > 0)
        .sort((a, b) => (b.activeDiffShares ?? 0) - (a.activeDiffShares ?? 0)),
      topActiveDecreases: changes
        .filter((change) => (change.activeDiffShares ?? 0) < 0)
        .sort((a, b) => (a.activeDiffShares ?? 0) - (b.activeDiffShares ?? 0)),
      newHoldings: changes.filter((change) => change.status === "new" || (change.prevShares === 0 && change.currentShares > 0)),
      exitedHoldings: changes.filter(
        (change) => change.status === "exit" || (change.prevShares > 0 && change.currentShares === 0)
      ),
      tagMovements: await tagMovementsForChanges(db, changes)
    };
  });

  return jsonResponse(body);
}

app.http("getEtfChanges", {
  methods: ["GET"],
  route: "etf/{etfCode}/changes",
  authLevel: "anonymous",
  handler: getEtfChanges
});
