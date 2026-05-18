import { z } from "zod";

export const activeEtfDiscoverySchema = z.object({
  etfCode: z.string(),
  stockName: z.string(),
  listingDate: z.string(),
  issuer: z.string(),
  indexName: z.string().nullable(),
  totalAssetValue: z.number().nullable(),
  closePrice: z.number().nullable(),
  holders: z.number().nullable(),
  valueYtd: z.number().nullable(),
  volumeYtd: z.number().nullable(),
  isTracked: z.boolean(),
  configuredProviderId: z.string().nullable(),
  suggestedProviderId: z.string().nullable(),
  discoveryStatus: z.enum(["tracked", "needs_provider_mapping", "needs_provider_reverse_engineering"]),
  sourceUrl: z.string().url(),
  rawSnapshotId: z.string(),
  firstDetectedAt: z.date(),
  lastSeenAt: z.date(),
  lastNotifiedAt: z.date().nullable()
});

export type ActiveEtfDiscovery = z.infer<typeof activeEtfDiscoverySchema>;
