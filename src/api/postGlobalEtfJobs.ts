import { app, type HttpRequest, type InvocationContext } from "@azure/functions";
import { getDb } from "../db/mongo.js";
import { syncAllGlobalEtfHoldings, syncGlobalEtfHoldings } from "../services/globalEtf/globalEtfService.js";
import { badRequest, jsonResponse, serverError, unauthorized } from "./response.js";

function validateAdminToken(request: HttpRequest) {
  const expected = process.env.ADMIN_JOB_TOKEN;
  if (!expected) return serverError("ADMIN_JOB_TOKEN is required");
  if (request.headers.get("x-admin-token") !== expected) return unauthorized();
  return null;
}

export async function postAllGlobalEtfsSyncHoldings(request: HttpRequest, _context: InvocationContext) {
  const authError = validateAdminToken(request);
  if (authError) return authError;
  const db = await getDb();
  const results = await syncAllGlobalEtfHoldings(db);
  return jsonResponse({ ok: results.every((result) => result.ok), job: "globalEtfsSyncHoldings", results });
}

export async function postGlobalEtfSyncHoldings(request: HttpRequest, _context: InvocationContext) {
  const authError = validateAdminToken(request);
  if (authError) return authError;
  const etfCode = request.params.etfCode?.toUpperCase();
  if (!etfCode) return badRequest("etfCode is required");
  const db = await getDb();
  const result = await syncGlobalEtfHoldings(db, etfCode);
  return jsonResponse({ ok: true, job: "globalEtfSyncHoldings", result });
}

app.http("postAllGlobalEtfsSyncHoldings", {
  methods: ["POST"],
  route: "jobs/global-etfs/sync-holdings",
  authLevel: "anonymous",
  handler: postAllGlobalEtfsSyncHoldings
});

app.http("postGlobalEtfSyncHoldings", {
  methods: ["POST"],
  route: "jobs/global-etf/{etfCode}/sync-holdings",
  authLevel: "anonymous",
  handler: postGlobalEtfSyncHoldings
});
