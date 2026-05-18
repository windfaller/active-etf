import type { Db } from "mongodb";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  broadcastTelegramMessage,
  handleTelegramUpdate,
  telegramWebhookUrl,
  type TelegramUpdate
} from "../../src/services/notify/telegramSubscriberService.js";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("telegram subscriber service", () => {
  it("uses the production custom domain for webhook registration", () => {
    delete process.env.PUBLIC_BASE_URL;
    expect(telegramWebhookUrl()).toBe("https://active-etf.chicoo.co/api/telegram/webhook");

    process.env.PUBLIC_BASE_URL = "https://active-etf.chicoo.co/";
    expect(telegramWebhookUrl()).toBe("https://active-etf.chicoo.co/api/telegram/webhook");
  });

  it("stores /start subscriber data and sends status text", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    const updates: unknown[] = [];
    const collection = {
      findOne: vi.fn(async () => null),
      updateOne: vi.fn(async (_filter: unknown, update: unknown) => {
        updates.push(update);
        return {};
      })
    };
    const db = {
      collection: vi.fn(() => collection)
    } as unknown as Db;
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await handleTelegramUpdate(db, {
      update_id: 1,
      message: {
        message_id: 10,
        date: 1779091200,
        text: "/start",
        from: {
          id: 123,
          is_bot: false,
          first_name: "Chi",
          username: "chi"
        },
        chat: {
          id: 456,
          type: "private",
          first_name: "Chi",
          username: "chi"
        }
      }
    } satisfies TelegramUpdate);

    expect(result).toEqual({ ok: true, message: "/start" });
    expect(collection.updateOne).toHaveBeenCalledWith(
      { chatId: "456" },
      expect.objectContaining({
        $set: expect.objectContaining({
          telegramUserId: 123,
          username: "chi",
          enabled: true,
          allowed: true,
          subscriptions: { discovery: true, dailyDigest: true }
        })
      }),
      { upsert: true }
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(updates).toHaveLength(1);
  });

  it("broadcasts only to enabled subscribers for the requested subscription", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    const collection = {
      find: vi.fn(() => ({
        toArray: async () => [
          {
            chatId: "456",
            enabled: true,
            allowed: true,
            subscriptions: { discovery: true, dailyDigest: false }
          }
        ]
      }))
    };
    const db = {
      collection: vi.fn(() => collection)
    } as unknown as Db;
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await broadcastTelegramMessage(db, "hello", { subscription: "discovery" });

    expect(result).toMatchObject({ attempted: true, sent: true, recipientCount: 1 });
    expect(collection.find).toHaveBeenCalledWith({
      enabled: true,
      allowed: true,
      "subscriptions.discovery": true
    });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, { body: string }];
    expect(JSON.parse(init.body)).toMatchObject({
      chat_id: "456",
      text: "hello"
    });
  });

  it("replies with latest ETF changes from /latest etfCode", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    const subscriberCollection = {
      findOne: vi.fn(async () => ({
        chatId: "456",
        chatType: "private",
        telegramUserId: 123,
        isBot: false,
        username: "chi",
        firstName: "Chi",
        lastName: null,
        languageCode: "zh-hant",
        chatTitle: null,
        enabled: true,
        allowed: true,
        blockedReason: null,
        subscriptions: { discovery: true, dailyDigest: true },
        lastCommand: "/start",
        lastMessageAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      })),
      updateOne: vi.fn(async () => ({}))
    };
    const changes = [
      {
        etfCode: "00981A",
        tradeDate: "2026-05-15",
        stockId: "2303",
        stockName: "聯電",
        diffShares: 9793000,
        diffLots: 9793,
        diffWeightPoint: 0.53,
        activeDiffLots: 9793,
        status: "increase"
      },
      {
        etfCode: "00981A",
        tradeDate: "2026-05-15",
        stockId: "2357",
        stockName: "華碩",
        diffShares: -293000,
        diffLots: -293,
        diffWeightPoint: -0.09,
        activeDiffLots: -293,
        status: "decrease"
      }
    ];
    const holdingChangeCollection = {
      find: vi.fn((_query: unknown) => ({
        sort: () => ({
          limit: () => ({
            toArray: async () => [changes[0]]
          })
        }),
        toArray: async () => changes
      }))
    };
    const db = {
      collection: vi.fn((name: string) => (name === "telegram_subscribers" ? subscriberCollection : holdingChangeCollection))
    } as unknown as Db;
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await handleTelegramUpdate(db, {
      update_id: 2,
      message: {
        message_id: 11,
        date: 1779091200,
        text: "/latest 00981A",
        from: {
          id: 123,
          is_bot: false,
          first_name: "Chi",
          username: "chi"
        },
        chat: {
          id: 456,
          type: "private",
          first_name: "Chi",
          username: "chi"
        }
      }
    } satisfies TelegramUpdate);

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, { body: string }];
    const body = JSON.parse(init.body);
    expect(result).toEqual({ ok: true, message: "/latest" });
    expect(body.text).toContain("00981A 主動統一台股增長");
    expect(body.text).toContain("最新操作日報：2026-05-15");
    expect(body.text).toContain("聯電 2303");
    expect(body.text).toContain("華碩 2357");
  });
});
