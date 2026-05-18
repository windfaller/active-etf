import { z } from "zod";

export const telegramSubscriberSchema = z.object({
  chatId: z.string(),
  chatType: z.enum(["private", "group", "supergroup", "channel"]),
  telegramUserId: z.number().nullable(),
  isBot: z.boolean().nullable(),
  username: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  languageCode: z.string().nullable(),
  chatTitle: z.string().nullable(),
  enabled: z.boolean(),
  allowed: z.boolean(),
  blockedReason: z.string().nullable(),
  subscriptions: z.object({
    discovery: z.boolean(),
    dailyDigest: z.boolean()
  }),
  lastCommand: z.string().nullable(),
  lastMessageAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export type TelegramSubscriber = z.infer<typeof telegramSubscriberSchema>;
