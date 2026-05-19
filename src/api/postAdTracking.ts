import { app, type HttpRequest, type InvocationContext } from "@azure/functions";
import { badRequest, jsonResponse } from "./response.js";

interface AdTrackingPayload {
  adId?: unknown;
  slot?: unknown;
  page?: unknown;
  timestamp?: unknown;
  etfCode?: unknown;
  provider?: unknown;
}

function parseTrackingPayload(body: AdTrackingPayload) {
  if (typeof body.adId !== "string" || !body.adId.trim()) return null;
  if (typeof body.slot !== "string" || !body.slot.trim()) return null;
  if (typeof body.page !== "string" || !body.page.trim()) return null;

  const timestamp =
    typeof body.timestamp === "string" && !Number.isNaN(Date.parse(body.timestamp))
      ? body.timestamp
      : new Date().toISOString();

  return {
    adId: body.adId,
    slot: body.slot,
    page: body.page,
    timestamp,
    etfCode: typeof body.etfCode === "string" ? body.etfCode : undefined,
    provider: typeof body.provider === "string" ? body.provider : undefined
  };
}

async function readPayload(request: HttpRequest) {
  try {
    return (await request.json()) as AdTrackingPayload;
  } catch {
    return null;
  }
}

async function handleAdTracking(request: HttpRequest, context: InvocationContext, eventType: "impression" | "click") {
  const body = await readPayload(request);
  if (!body) return badRequest("JSON body is required");

  const event = parseTrackingPayload(body);
  if (!event) return badRequest("adId, slot, and page are required");

  if (process.env.ENABLE_AD_TRACKING !== "true") {
    return jsonResponse({ ok: true, tracked: false, eventType, reason: "ad tracking disabled" });
  }

  context.log("ad_tracking_event", {
    eventType,
    ...event
  });

  return jsonResponse({ ok: true, tracked: true, eventType });
}

export async function postAdImpression(request: HttpRequest, context: InvocationContext) {
  return handleAdTracking(request, context, "impression");
}

export async function postAdClick(request: HttpRequest, context: InvocationContext) {
  return handleAdTracking(request, context, "click");
}

app.http("postAdImpression", {
  methods: ["POST"],
  route: "ad/impression",
  authLevel: "anonymous",
  handler: postAdImpression
});

app.http("postAdClick", {
  methods: ["POST"],
  route: "ad/click",
  authLevel: "anonymous",
  handler: postAdClick
});
