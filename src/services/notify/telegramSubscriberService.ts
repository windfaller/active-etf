import type { Db } from "mongodb";
import type { TelegramSubscriber } from "../../models/TelegramSubscriber.js";

export type TelegramSubscriptionKind = "discovery" | "dailyDigest";

interface TelegramUser {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

interface TelegramChat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  title?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
}

interface TelegramMessage {
  message_id: number;
  date: number;
  text?: string;
  from?: TelegramUser;
  chat: TelegramChat;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

export interface TelegramBroadcastResult {
  attempted: boolean;
  sent: boolean;
  recipientCount: number;
  reason?: string;
  errors?: string[];
}

function parseAllowedSet(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function subscriberAllowed(userId: number | null, chatId: string): { allowed: boolean; reason: string | null } {
  const allowedUsers = parseAllowedSet(process.env.TELEGRAM_ALLOWED_USER_IDS);
  const allowedChats = parseAllowedSet(process.env.TELEGRAM_ALLOWED_CHAT_IDS);
  if (!allowedUsers.size && !allowedChats.size) {
    return { allowed: true, reason: null };
  }

  if (userId !== null && allowedUsers.has(String(userId))) {
    return { allowed: true, reason: null };
  }

  if (allowedChats.has(chatId)) {
    return { allowed: true, reason: null };
  }

  return { allowed: false, reason: "not_in_allowlist" };
}

function commandFromText(text: string | undefined): string {
  const token = text?.trim().split(/\s+/u)[0]?.toLowerCase() ?? "";
  return token.replace(/@.+$/u, "");
}

function subscriberFromMessage(message: TelegramMessage, command: string): TelegramSubscriber {
  const user = message.from;
  const chatId = String(message.chat.id);
  const allowed = subscriberAllowed(user?.id ?? null, chatId);
  const now = new Date();

  return {
    chatId,
    chatType: message.chat.type,
    telegramUserId: user?.id ?? null,
    isBot: user?.is_bot ?? null,
    username: user?.username ?? message.chat.username ?? null,
    firstName: user?.first_name ?? message.chat.first_name ?? null,
    lastName: user?.last_name ?? message.chat.last_name ?? null,
    languageCode: user?.language_code ?? null,
    chatTitle: message.chat.title ?? null,
    enabled: allowed.allowed,
    allowed: allowed.allowed,
    blockedReason: allowed.reason,
    subscriptions: {
      discovery: allowed.allowed,
      dailyDigest: allowed.allowed
    },
    lastCommand: command || null,
    lastMessageAt: now,
    createdAt: now,
    updatedAt: now
  };
}

async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is required");
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text
    })
  });

  if (!response.ok) {
    throw new Error(`Telegram send failed for ${chatId}: ${response.status} ${await response.text()}`);
  }
}

function helpText(subscriber: TelegramSubscriber): string {
  const status = subscriber.enabled ? "通知已開啟" : "通知已暫停";
  const discovery = subscriber.subscriptions.discovery ? "開" : "關";
  const dailyDigest = subscriber.subscriptions.dailyDigest ? "開" : "關";

  return [
    "主動式 ETF 雷達",
    status,
    `新 ETF 偵測：${discovery}`,
    `每日摘要：${dailyDigest}`,
    "",
    "可用指令：",
    "/status 查詢訂閱狀態",
    "/subscribe 開啟全部通知",
    "/unsubscribe 暫停全部通知",
    "/toggle 切換全部通知",
    "/discover_on 開啟新 ETF 偵測",
    "/discover_off 關閉新 ETF 偵測",
    "/digest_on 開啟每日摘要",
    "/digest_off 關閉每日摘要"
  ].join("\n");
}

async function updateSubscriber(db: Db, message: TelegramMessage, command: string): Promise<TelegramSubscriber> {
  const incoming = subscriberFromMessage(message, command);
  const collection = db.collection<TelegramSubscriber>("telegram_subscribers");
  const existing = await collection.findOne({ chatId: incoming.chatId });
  const baseSubscriptions = existing?.subscriptions ?? incoming.subscriptions;
  let enabled = existing?.enabled ?? incoming.enabled;
  let subscriptions = baseSubscriptions;

  if (!incoming.allowed) {
    enabled = false;
    subscriptions = { discovery: false, dailyDigest: false };
  } else if (["/start", "/subscribe", "/notify_on"].includes(command)) {
    enabled = true;
    subscriptions = { discovery: true, dailyDigest: true };
  } else if (["/stop", "/unsubscribe", "/notify_off"].includes(command)) {
    enabled = false;
  } else if (command === "/toggle") {
    enabled = !enabled;
    if (enabled) subscriptions = { discovery: true, dailyDigest: true };
  } else if (command === "/discover_on") {
    enabled = true;
    subscriptions = { ...baseSubscriptions, discovery: true };
  } else if (command === "/discover_off") {
    subscriptions = { ...baseSubscriptions, discovery: false };
  } else if (command === "/digest_on") {
    enabled = true;
    subscriptions = { ...baseSubscriptions, dailyDigest: true };
  } else if (command === "/digest_off") {
    subscriptions = { ...baseSubscriptions, dailyDigest: false };
  }

  const update = {
    ...incoming,
    enabled,
    subscriptions,
    createdAt: existing?.createdAt ?? incoming.createdAt
  };

  const { createdAt, ...setFields } = update;
  await collection.updateOne(
    { chatId: incoming.chatId },
    {
      $set: setFields,
      $setOnInsert: { createdAt }
    },
    { upsert: true }
  );

  return update;
}

export async function handleTelegramUpdate(db: Db, update: TelegramUpdate): Promise<{ ok: boolean; message?: string }> {
  const message = update.message;
  if (!message) {
    return { ok: true, message: "ignored_non_message_update" };
  }

  const command = commandFromText(message.text);
  const subscriber = await updateSubscriber(db, message, command);
  if (!subscriber.allowed) {
    await sendTelegramMessage(subscriber.chatId, "你目前沒有訂閱權限。");
    return { ok: true, message: "subscriber_not_allowed" };
  }

  await sendTelegramMessage(subscriber.chatId, helpText(subscriber));
  return { ok: true, message: command || "message_saved" };
}

export async function broadcastTelegramMessage(
  db: Db,
  text: string,
  options: { subscription: TelegramSubscriptionKind }
): Promise<TelegramBroadcastResult> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return { attempted: false, sent: false, recipientCount: 0, reason: "TELEGRAM_BOT_TOKEN is not configured" };
  }

  const subscribers = await db
    .collection<TelegramSubscriber>("telegram_subscribers")
    .find({
      enabled: true,
      allowed: true,
      [`subscriptions.${options.subscription}`]: true
    })
    .toArray();
  const legacyChatId = process.env.TELEGRAM_CHAT_ID;
  const chatIds = [...new Set(subscribers.map((subscriber) => subscriber.chatId))];
  if (!chatIds.length && legacyChatId) {
    chatIds.push(legacyChatId);
  }

  if (!chatIds.length) {
    return { attempted: false, sent: false, recipientCount: 0, reason: "No enabled Telegram subscribers" };
  }

  const errors: string[] = [];
  for (const chatId of chatIds) {
    try {
      await sendTelegramMessage(chatId, text);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  return {
    attempted: true,
    sent: errors.length === 0,
    recipientCount: chatIds.length,
    errors: errors.length ? errors : undefined,
    reason: errors.length ? "One or more Telegram sends failed" : undefined
  };
}

export function telegramWebhookUrl(): string {
  const baseUrl = (process.env.PUBLIC_BASE_URL ?? "https://active-etf.chicoo.co").replace(/\/+$/u, "");
  return `${baseUrl}/api/telegram/webhook`;
}

export async function setTelegramWebhook(): Promise<unknown> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!botToken || !secretToken) {
    throw new Error("TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET are required");
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: telegramWebhookUrl(),
      secret_token: secretToken,
      allowed_updates: ["message"]
    })
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`Telegram setWebhook failed: ${response.status} ${JSON.stringify(body)}`);
  }

  return body;
}
