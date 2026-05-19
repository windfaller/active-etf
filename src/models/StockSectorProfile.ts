import { z } from "zod";
import { sectorNameSchema } from "./EtfSectorFlow.js";

export const stockSectorProfileSchema = z.object({
  stockId: z.string(),
  stockName: z.string().optional(),
  sector: sectorNameSchema,
  themeTags: z.array(z.string()),
  source: z.enum(["static", "heuristic", "unknown"]),
  createdAt: z.date(),
  updatedAt: z.date()
});

export type StockSectorProfile = z.infer<typeof stockSectorProfileSchema>;
