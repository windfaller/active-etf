import { app, type HttpRequest, type InvocationContext } from "@azure/functions";
import { getDb } from "../db/mongo.js";
import { handleTelegramUpdate, type TelegramUpdate } from "../services/notify/telegramSubscriberService.js";
import { jsonResponse, serverError, unauthorized } from "./response.js";

function validateTelegramSecret(request: HttpRequest) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) return serverError("TELEGRAM_WEBHOOK_SECRET is required");

  const actual = request.headers.get("x-telegram-bot-api-secret-token");
  if (actual !== expected) return unauthorized();
  return null;
}

export async function postTelegramWebhook(request: HttpRequest, _context: InvocationContext) {
  const authError = validateTelegramSecret(request);
  if (authError) return authError;

  const update = await request.json();
  const db = await getDb();
  const result = await handleTelegramUpdate(db, update as TelegramUpdate);
  return jsonResponse(result);
}

app.http("postTelegramWebhook", {
  methods: ["POST"],
  route: "telegram/webhook",
  authLevel: "anonymous",
  handler: postTelegramWebhook
});
