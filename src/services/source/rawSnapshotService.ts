import { randomUUID } from "node:crypto";
import type { Db } from "mongodb";
import type { RawSnapshot } from "../../models/RawSnapshot.js";
import type { SourceFetchResult } from "./httpClient.js";

export interface CreateRawSnapshotInput {
  source: RawSnapshot["source"];
  etfCode: string;
  fundCode?: string;
  dataType: RawSnapshot["dataType"];
  tradeDate?: string;
  fetchResult: SourceFetchResult;
  parsedOk?: boolean;
  parseError?: string;
}

export function createRawSnapshot(input: CreateRawSnapshotInput): RawSnapshot {
  return {
    snapshotId: randomUUID(),
    source: input.source,
    etfCode: input.etfCode,
    fundCode: input.fundCode,
    dataType: input.dataType,
    tradeDate: input.tradeDate,
    fetchedAt: new Date(),
    url: input.fetchResult.url,
    method: input.fetchResult.method,
    requestHeaders: input.fetchResult.requestHeaders,
    requestBody: input.fetchResult.requestBody,
    responseStatus: input.fetchResult.responseStatus,
    responseHeaders: input.fetchResult.responseHeaders,
    rawContentType: input.fetchResult.rawContentType,
    rawBody: input.fetchResult.rawBody,
    parsedOk: input.parsedOk ?? false,
    parseError: input.parseError
  };
}

export async function saveRawSnapshot(db: Db, snapshot: RawSnapshot): Promise<void> {
  await db.collection<RawSnapshot>("raw_snapshots").insertOne(snapshot);
}
