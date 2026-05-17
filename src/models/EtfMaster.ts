import { z } from "zod";

export const etfMasterSchema = z.object({
  etfCode: z.string(),
  fundCode: z.string(),
  name: z.string(),
  issuer: z.string(),
  type: z.enum(["active_etf", "passive_etf"]),
  currency: z.enum(["TWD", "USD"]),
  enabled: z.boolean(),
  source: z.object({
    infoUrl: z.string().url().optional(),
    pcfUrl: z.string().url().optional(),
    unitMarketRatioUrl: z.string().url().optional()
  }),
  createdAt: z.date(),
  updatedAt: z.date()
});

export type EtfMaster = z.infer<typeof etfMasterSchema>;
