import { z } from "zod";

export const etfDailyHoldingSchema = z.object({
  etfCode: z.string(),
  tradeDate: z.string(),
  stockId: z.string(),
  stockName: z.string(),
  shares: z.number(),
  lots: z.number(),
  weight: z.number().nullable(),
  marketValue: z.number().nullable(),
  source: z.enum([
    "ezmoney",
    "backup",
    "nomura",
    "capital",
    "yuanta",
    "taishin",
    "ctbc",
    "jpmorgan",
    "allianz",
    "mega",
    "first",
    "cathay",
    "fh"
  ]),
  rawSnapshotId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export type EtfDailyHolding = z.infer<typeof etfDailyHoldingSchema>;
