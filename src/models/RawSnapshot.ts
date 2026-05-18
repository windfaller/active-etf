import { z } from "zod";

export const rawSnapshotSchema = z.object({
  snapshotId: z.string(),
  source: z.enum([
    "ezmoney",
    "twse",
    "moneydj",
    "wantgoo",
    "nomura",
    "capital",
    "yuanta",
    "taishin",
    "ctbc",
    "jpmorgan",
    "allianz",
    "first",
    "cathay",
    "fh",
    "twse_etfortune"
  ]),
  etfCode: z.string(),
  fundCode: z.string().optional(),
  dataType: z.enum(["holdings", "summary", "pcf", "nav", "html", "api_response"]),
  tradeDate: z.string().optional(),
  fetchedAt: z.date(),
  url: z.string().url(),
  method: z.enum(["GET", "POST"]),
  requestHeaders: z.record(z.string()).optional(),
  requestBody: z.unknown().optional(),
  responseStatus: z.number(),
  responseHeaders: z.record(z.string()).optional(),
  rawContentType: z.string(),
  rawBody: z.string(),
  parsedOk: z.boolean(),
  parseError: z.string().optional()
});

export type RawSnapshot = z.infer<typeof rawSnapshotSchema>;
