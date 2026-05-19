import { app, type HttpRequest, type InvocationContext } from "@azure/functions";
import { jsonResponse } from "./response.js";

interface TelegramInfoCache {
  expiresAt: number;
  value: {
    configured: boolean;
    username: string | null;
    subscribeUrl: string | null;
  };
}

let cache: TelegramInfoCache | null = null;

function configuredTelegramUrl(username: string): string {
  return `https://t.me/${username.replace(/^@/u, "")}?start=subscribe`;
}

async function resolveBotUsername(): Promise<string | null> {
  const configuredUsername = process.env.TELEGRAM_BOT_USERNAME;
  if (configuredUsername) return configuredUsername.replace(/^@/u, "");

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;

  const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  if (!response.ok) return null;

  const body = (await response.json()) as { ok?: boolean; result?: { username?: string } };
  return body.ok ? body.result?.username ?? null : null;
}

export async function getTelegramInfo(_request: HttpRequest, _context: InvocationContext) {
  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    return jsonResponse(cache.value);
  }

  const username = await resolveBotUsername();
  const value = {
    configured: Boolean(username),
    username,
    subscribeUrl: username ? configuredTelegramUrl(username) : null
  };
  cache = {
    expiresAt: now + 15 * 60 * 1000,
    value
  };

  return jsonResponse(value);
}

app.http("getTelegramInfo", {
  methods: ["GET"],
  route: "telegram/info",
  authLevel: "anonymous",
  handler: getTelegramInfo
});
