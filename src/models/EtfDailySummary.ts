import { z } from "zod";

export const etfDailySummarySchema = z.object({
  etfCode: z.string(),
  tradeDate: z.string(),
  nav: z.number().nullable(),
  marketPrice: z.number().nullable(),
  premiumDiscount: z.number().nullable(),
  totalUnits: z.number().nullable(),
  fundSize: z.number().nullable(),
  netCreationUnits: z.number().nullable(),
  cashRatio: z.number().nullable(),
  stockRatio: z.number().nullable(),
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
    "first",
    "cathay",
    "fh"
  ]),
  rawSnapshotId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export type EtfDailySummary = z.infer<typeof etfDailySummarySchema>;
