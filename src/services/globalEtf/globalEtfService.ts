import { randomUUID } from "node:crypto";
import type { Db, Filter } from "mongodb";
import { enabledGlobalEtfs, findGlobalEtfConfig, type GlobalEtfConfig } from "../../config/globalEtfs.js";
import type { GlobalEtfCommonHolding, GlobalEtfDailyReport, GlobalEtfReportSection, GlobalEtfSnapshot } from "../../models/GlobalEtf.js";
import { fetchGlobalEtfSnapshot } from "../../providers/globalEtf/provider.js";
import { invalidateGlobalEtfCache } from "../cache/dailyDataCache.js";
import { createRawSnapshot } from "../source/rawSnapshotService.js";
import { calculateGlobalEtfAggregateChanges, calculateGlobalEtfChanges, splitGlobalEtfChanges } from "./changeCalculator.js";
import { buildGlobalEtfDailyReport, buildTakeaway } from "./reportGenerator.js";

function sampleHolding(etfCode: string, ticker: string, name: string, weightPercent: number, sector: string, marketValue = 1_000_000) {
  const etf = findGlobalEtfConfig(etfCode);
  if (!etf) throw new Error(`${etfCode} missing`);
  return {
    etfCode,
    fundName: etf.fundName,
    issuer: etf.issuer,
    sourceAsOf: "2026-06-23",
    fetchedAt: new Date("2026-06-24T00:00:00.000Z"),
    sourceUrl: etf.holdingsUrl ?? etf.sourceUrl,
    sourceStatus: "ok" as const,
    productGroup: "global_etf" as const,
    market: "US" as const,
    strategyType: etf.strategyType,
    positionKey: `ticker:${ticker}`,
    ticker,
    name,
    weightPercent,
    shares: Math.round((marketValue / 100) * weightPercent),
    marketValue: (marketValue / 100) * weightPercent,
    sector,
    assetType: "Equity"
  };
}

function sampleSnapshot(etfCode: string, weights: Array<[string, string, number, string]>): GlobalEtfSnapshot {
  const etf = findGlobalEtfConfig(etfCode);
  if (!etf) throw new Error(`${etfCode} missing`);
  const holdings = weights.map(([ticker, name, weight, sector]) => sampleHolding(etfCode, ticker, name, weight, sector));
  return {
    snapshotId: `demo-${etfCode}`,
    etfCode,
    fundName: etf.fundName,
    issuer: etf.issuer,
    sourceAsOf: "2026-06-23",
    fetchedAt: new Date("2026-06-24T00:00:00.000Z"),
    sourceUrl: etf.holdingsUrl ?? etf.sourceUrl,
    sourceStatus: "ok",
    productGroup: "global_etf",
    market: "US",
    strategyType: etf.strategyType,
    rowCount: holdings.length,
    rawRowCount: holdings.length,
    signature: `demo-${etfCode}`,
    holdings
  };
}

function samplePrevious(snapshot: GlobalEtfSnapshot): GlobalEtfSnapshot {
  return {
    ...snapshot,
    snapshotId: `${snapshot.snapshotId}-previous`,
    sourceAsOf: "2026-06-20",
    holdings: snapshot.holdings.map((holding, index) => ({
      ...holding,
      sourceAsOf: "2026-06-20",
      weightPercent: holding.weightPercent === undefined ? undefined : Math.max(0.1, holding.weightPercent + (index % 2 === 0 ? -0.35 : 0.22))
    }))
  };
}

function usableSnapshotClauses(): Filter<GlobalEtfSnapshot>[] {
  return [
    { unusableReason: { $exists: false } },
    { unusableReason: null } as unknown as Filter<GlobalEtfSnapshot>
  ];
}

function normalizeCommonHoldingKey(holding: GlobalEtfSnapshot["holdings"][number]): string {
  const normalizedName = holding.name
    .trim()
    .toUpperCase()
    .replace(/&/gu, " AND ")
    .replace(/[^A-Z0-9]+/gu, " ")
    .replace(/\b(CLASS|CL|COM|COMMON|SHS|SHARES|INCORPORATED)\b/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
  if (normalizedName) return `name:${normalizedName}`;
  const ticker = holding.ticker?.trim().toUpperCase();
  if (ticker) return `ticker:${ticker.replace(/\.(?:KS|TW|T|JP)$/u, "")}`;
  return `name:${holding.name.trim().toUpperCase().replace(/\s+/gu, " ")}`;
}

function isCommonHoldingCandidate(holding: GlobalEtfSnapshot["holdings"][number]): boolean {
  const normalizedName = holding.name.toUpperCase();
  if (holding.assetType === "Cash") return false;
  if (normalizedName.includes("SWAP")) return false;
  if (normalizedName.includes("BLK CSH FND") || normalizedName.includes("MONEY MARKET")) return false;
  if (holding.weightPercent === undefined || holding.weightPercent <= 0) return false;
  return Boolean(holding.ticker || holding.name);
}

function calculateCommonHoldings(snapshots: GlobalEtfSnapshot[]): GlobalEtfCommonHolding[] {
  const byPosition = new Map<
    string,
    Omit<GlobalEtfCommonHolding, "etfCount" | "etfs"> & {
      etfs: Map<string, { etfCode: string; weightPercent?: number }>;
    }
  >();

  for (const snapshot of snapshots) {
    const bestHoldingByKey = new Map<string, GlobalEtfSnapshot["holdings"][number]>();
    for (const holding of snapshot.holdings) {
      if (!isCommonHoldingCandidate(holding)) continue;
      const key = normalizeCommonHoldingKey(holding);
      const existing = bestHoldingByKey.get(key);
      if (!existing || (holding.weightPercent ?? 0) > (existing.weightPercent ?? 0)) {
        bestHoldingByKey.set(key, holding);
      }
    }

    for (const [key, holding] of bestHoldingByKey) {
      const weightPercent = holding.weightPercent ?? 0;
      const existing = byPosition.get(key) ?? {
        positionKey: key,
        ticker: holding.ticker,
        name: holding.name,
        sector: holding.sector,
        assetType: holding.assetType,
        totalWeightPercent: 0,
        maxWeightPercent: 0,
        etfs: new Map()
      };
      existing.ticker ||= holding.ticker;
      existing.sector ||= holding.sector;
      existing.assetType ||= holding.assetType;
      existing.totalWeightPercent += weightPercent;
      existing.maxWeightPercent = Math.max(existing.maxWeightPercent, weightPercent);
      existing.etfs.set(snapshot.etfCode, { etfCode: snapshot.etfCode, weightPercent: holding.weightPercent });
      byPosition.set(key, existing);
    }
  }

  return [...byPosition.values()]
    .map((row) => {
      const etfs = [...row.etfs.values()].sort((a, b) => (b.weightPercent ?? 0) - (a.weightPercent ?? 0));
      return {
        ...row,
        etfCount: etfs.length,
        etfs
      };
    })
    .filter((row) => row.etfCount >= 2)
    .sort((a, b) => {
      if (b.etfCount !== a.etfCount) return b.etfCount - a.etfCount;
      if (b.totalWeightPercent !== a.totalWeightPercent) return b.totalWeightPercent - a.totalWeightPercent;
      return b.maxWeightPercent - a.maxWeightPercent;
    })
    .slice(0, 40);
}

export function demoGlobalEtfSnapshots(): GlobalEtfSnapshot[] {
  return [
    sampleSnapshot("DRAM", [
      ["005930.KS", "Samsung Electronics Co Ltd", 27.1, "Memory & Storage"],
      ["000660.KS", "SK Hynix Inc", 24.6, "Memory & Storage"],
      ["MU", "Micron Technology Inc", 22.8, "Memory & Storage"],
      ["SNDK", "SanDisk Corp", 6.4, "Memory & Storage"],
      ["WDC", "Western Digital Corp", 5.8, "Memory & Storage"],
      ["STX", "Seagate Technology Holdings", 5.1, "Memory & Storage"],
      ["285A.T", "Kioxia Holdings Corp", 4.6, "Memory & Storage"],
      ["SIMO", "Silicon Motion Technology Corp", 1.8, "Storage Controllers"],
      ["2344.TW", "Winbond Electronics Corp", 1.2, "Memory & Storage"],
      ["2408.TW", "Nanya Technology Corp", 0.9, "Memory & Storage"]
    ]),
    sampleSnapshot("NASA", [
      ["RKLB", "Rocket Lab USA Inc", 9.6, "Aerospace & Defense"],
      ["LMT", "Lockheed Martin Corp", 7.1, "Aerospace & Defense"],
      ["NOC", "Northrop Grumman Corp", 6.9, "Aerospace & Defense"],
      ["BA", "Boeing Co", 5.8, "Aerospace & Defense"],
      ["IRDM", "Iridium Communications Inc", 5.4, "Telecommunications"],
      ["VSAT", "Viasat Inc", 4.9, "Telecommunications"],
      ["TRMB", "Trimble Inc", 4.5, "Technology"],
      ["HON", "Honeywell International Inc", 4.0, "Industrials"],
      ["TDY", "Teledyne Technologies Inc", 3.7, "Technology"],
      ["HEI", "HEICO Corp", 3.4, "Aerospace & Defense"]
    ]),
    sampleSnapshot("BAI", [
      ["NVDA", "NVIDIA Corp", 8.7, "Information Technology"],
      ["MSFT", "Microsoft Corp", 7.9, "Information Technology"],
      ["AVGO", "Broadcom Inc", 6.8, "Information Technology"],
      ["TSM", "Taiwan Semiconductor Manufacturing", 5.9, "Information Technology"],
      ["AMZN", "Amazon.com Inc", 5.1, "Consumer Discretionary"],
      ["META", "Meta Platforms Inc", 4.7, "Communication Services"],
      ["ASML", "ASML Holding NV", 4.1, "Information Technology"],
      ["ANET", "Arista Networks Inc", 3.7, "Information Technology"],
      ["AMD", "Advanced Micro Devices Inc", 3.5, "Information Technology"],
      ["NOW", "ServiceNow Inc", 3.2, "Information Technology"]
    ]),
    sampleSnapshot("EUV", [
      ["ASML", "ASML Holding NV", 14.2, "Semiconductor Equipment"],
      ["LRCX", "Lam Research Corp", 8.4, "Semiconductor Equipment"],
      ["AMAT", "Applied Materials Inc", 8.2, "Semiconductor Equipment"],
      ["KLAC", "KLA Corp", 7.7, "Semiconductor Equipment"],
      ["TER", "Teradyne Inc", 5.6, "Semiconductor Equipment"],
      ["ENTG", "Entegris Inc", 5.2, "Semiconductor Materials"],
      ["MKSI", "MKS Instruments Inc", 4.6, "Semiconductor Equipment"],
      ["ONTO", "Onto Innovation Inc", 4.1, "Semiconductor Equipment"],
      ["ACLS", "Axcelis Technologies Inc", 3.8, "Semiconductor Equipment"],
      ["COHU", "Cohu Inc", 3.4, "Semiconductor Equipment"]
    ])
  ];
}

const ISO_SOURCE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

function normalizeGlobalSourceDate(value?: string): string | undefined {
  if (!value) return undefined;
  return ISO_SOURCE_DATE_PATTERN.test(value) ? value : undefined;
}

export function sec13fMetadataFromSubmissions(
  rawBody: string,
  filedAtHint?: string
): { sourceAsOf: string; filedAt: string } | null {
  try {
    const recent = (JSON.parse(rawBody) as {
      filings?: { recent?: { form?: string[]; filingDate?: string[]; reportDate?: string[] } };
    }).filings?.recent;
    const forms = recent?.form ?? [];
    const indexes = forms
      .map((form, index) => ({ form, index }))
      .filter(({ form }) => form === "13F-HR" || form === "13F-HR/A")
      .map(({ index }) => index);
    const index = indexes.find((candidate) => recent?.filingDate?.[candidate] === filedAtHint) ?? indexes[0] ?? -1;
    const sourceAsOf = index >= 0 ? recent?.reportDate?.[index] : undefined;
    const filedAt = index >= 0 ? recent?.filingDate?.[index] : undefined;
    return sourceAsOf && filedAt ? { sourceAsOf, filedAt } : null;
  } catch {
    return null;
  }
}

function capturedAtFromSnapshot(snapshot: GlobalEtfSnapshot): string | undefined {
  if (snapshot.capturedAt) return snapshot.capturedAt;
  const fetchedAt = snapshot.fetchedAt instanceof Date ? snapshot.fetchedAt : new Date(snapshot.fetchedAt);
  return Number.isNaN(fetchedAt.getTime()) ? undefined : fetchedAt.toISOString();
}

async function recoverSec13fMetadata(db: Db, snapshots: GlobalEtfSnapshot[]): Promise<GlobalEtfSnapshot[]> {
  const rawSnapshotIds = snapshots
    .filter((snapshot) => snapshot.strategyType === "13f" && !snapshot.filedAt && snapshot.rawSnapshotId)
    .map((snapshot) => snapshot.rawSnapshotId as string);
  const rawRows = rawSnapshotIds.length
    ? await db
        .collection<{ snapshotId: string; rawBody?: string }>("global_etf_raw_snapshots")
        .find({ snapshotId: { $in: rawSnapshotIds } }, { projection: { _id: 0, snapshotId: 1, rawBody: 1 } })
        .toArray()
    : [];
  const rawById = new Map(rawRows.map((row) => [row.snapshotId, row.rawBody]));

  return snapshots.map((snapshot) => {
    const capturedAt = capturedAtFromSnapshot(snapshot);
    if (snapshot.strategyType !== "13f" || snapshot.filedAt || !snapshot.rawSnapshotId) {
      return capturedAt && !snapshot.capturedAt ? { ...snapshot, capturedAt } : snapshot;
    }
    const rawBody = rawById.get(snapshot.rawSnapshotId);
    const recovered = rawBody ? sec13fMetadataFromSubmissions(rawBody, snapshot.sourceAsOf) : null;
    return {
      ...snapshot,
      sourceAsOf: recovered?.sourceAsOf ?? snapshot.sourceAsOf,
      filedAt: recovered?.filedAt,
      capturedAt
    };
  });
}

async function latestSnapshotsFromDb(db: Db, sourceDate?: string): Promise<GlobalEtfSnapshot[]> {
  const normalizedSourceDate = normalizeGlobalSourceDate(sourceDate);
  const usableSnapshotsFilter: Filter<GlobalEtfSnapshot> = {
    etfCode: { $in: enabledGlobalEtfs.map((etf) => etf.etfCode) },
    sourceAsOf: normalizedSourceDate ? { $regex: "^\\d{4}-\\d{2}-\\d{2}$", $lte: normalizedSourceDate } : { $regex: "^\\d{4}-\\d{2}-\\d{2}$" },
    $or: usableSnapshotClauses()
  };
  const rows = await db
    .collection<GlobalEtfSnapshot>("global_etf_snapshots")
    .aggregate<GlobalEtfSnapshot>([
      { $match: usableSnapshotsFilter },
      {
        $set: {
          selectionDate: {
            $cond: [
              { $eq: ["$strategyType", "13f"] },
              { $ifNull: ["$filedAt", "$sourceAsOf"] },
              "$sourceAsOf"
            ]
          }
        }
      },
      { $sort: { selectionDate: -1, fetchedAt: -1 } },
      { $group: { _id: "$etfCode", doc: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$doc" } },
      { $unset: "selectionDate" }
    ])
    .toArray();

  return recoverSec13fMetadata(db, rows);
}

export async function availableGlobalEtfSourceDates(db: Db, limit = 180): Promise<string[]> {
  const safeLimit = Math.max(1, Math.min(Math.trunc(limit) || 180, 365));
  const rows = await db
    .collection<GlobalEtfSnapshot>("global_etf_snapshots")
    .aggregate<{ _id: string }>([
      {
        $match: {
          etfCode: { $in: enabledGlobalEtfs.map((etf) => etf.etfCode) },
          sourceAsOf: { $regex: "^\\d{4}-\\d{2}-\\d{2}$" },
          $or: usableSnapshotClauses()
        }
      },
      { $group: { _id: "$sourceAsOf" } },
      { $sort: { _id: -1 } },
      { $limit: safeLimit }
    ])
    .toArray();

  return rows.map((row) => row._id);
}

async function previousSnapshotFromDb(db: Db, current: GlobalEtfSnapshot): Promise<GlobalEtfSnapshot | null> {
  const filter: Filter<GlobalEtfSnapshot> = {
    etfCode: current.etfCode,
    sourceAsOf: { $lt: current.sourceAsOf },
    $or: usableSnapshotClauses()
  };

  const previous = await db
    .collection<GlobalEtfSnapshot>("global_etf_snapshots")
    .find(filter)
    .sort({ sourceAsOf: -1, fetchedAt: -1 })
    .limit(1)
    .next();
  if (!previous) return null;
  return (await recoverSec13fMetadata(db, [previous]))[0] ?? null;
}

async function reportFromSnapshots(db: Db | null, snapshots: GlobalEtfSnapshot[], demoMode = false, selectedDate?: string): Promise<GlobalEtfDailyReport> {
  const sections: GlobalEtfReportSection[] = [];
  const globalMovers = [];

  for (const snapshot of snapshots) {
    const previous = db ? await previousSnapshotFromDb(db, snapshot) : samplePrevious(snapshot);
    const changes = calculateGlobalEtfChanges(snapshot, previous);
    const split = splitGlobalEtfChanges(changes);
    const section = {
      etfCode: snapshot.etfCode,
      fundName: snapshot.fundName,
      issuer: snapshot.issuer,
      strategyType: snapshot.strategyType,
      sourceAsOf: snapshot.sourceAsOf,
      filedAt: snapshot.filedAt,
      capturedAt: capturedAtFromSnapshot(snapshot),
      sourceUrl: snapshot.sourceUrl,
      sourceStatus: snapshot.sourceStatus,
      rowCount: snapshot.rowCount,
      topHoldings: snapshot.holdings
        .filter((holding) => holding.assetType !== "Cash" && !holding.name.toUpperCase().includes("SWAP"))
        .slice(0, 10),
      ...split,
      sectorChanges: calculateGlobalEtfAggregateChanges(snapshot, previous, "sector"),
      countryChanges: calculateGlobalEtfAggregateChanges(snapshot, previous, "country"),
      takeaway: ""
    };
    section.takeaway = buildTakeaway(section);
    sections.push(section);
    globalMovers.push(...split.weightChanges.map((change) => ({ ...change, etfCode: snapshot.etfCode })));
  }

  const coveredCodes = new Set(sections.map((section) => section.etfCode));
  for (const etf of enabledGlobalEtfs) {
    if (coveredCodes.has(etf.etfCode)) continue;
    sections.push(emptyGlobalEtfSection(etf));
  }

  const orderByCode = new Map(enabledGlobalEtfs.map((etf, index) => [etf.etfCode, index]));
  sections.sort((a, b) => (orderByCode.get(a.etfCode) ?? Number.MAX_SAFE_INTEGER) - (orderByCode.get(b.etfCode) ?? Number.MAX_SAFE_INTEGER));

  const sortedMovers = globalMovers.sort((a, b) => Math.abs(b.deltaPp ?? 0) - Math.abs(a.deltaPp ?? 0)).slice(0, 8);
  const successCount = sections.filter((section) => section.sourceStatus === "ok").length;
  const unavailable = sections.filter((section) => section.sourceStatus !== "ok");
  const biggest = sortedMovers[0];
  const highlights = [
    `官方來源成功 ${successCount}/${sections.length} 檔。`,
    biggest ? `全體最大權重變化：${biggest.etfCode} ${biggest.ticker ?? biggest.name} ${biggest.deltaPp && biggest.deltaPp >= 0 ? "+" : ""}${biggest.deltaPp?.toFixed(1)}pp。` : "尚無前後期可比較的權重變化。",
    unavailable.length ? `需留意 ${unavailable.map((section) => section.etfCode).join("、")} 來源狀態。` : "所有啟用海外 ETF 來源目前皆可用。",
    demoMode ? "本地尚未有 global_etf_snapshots，畫面先使用標示的示範資料；執行同步 job 後會切換為官方快照。" : "資料與台灣主動式 ETF collections 分開保存。"
  ].slice(0, 4);

  return buildGlobalEtfDailyReport({
    productGroup: "global_etf",
    reportDate: normalizeGlobalSourceDate(selectedDate) ?? new Date().toISOString().slice(0, 10),
    coveredEtfs: sections.map((section) => section.etfCode),
    successCount,
    totalCount: sections.length,
    highlights,
    statusRows: sections.map((section) => ({
      etfCode: section.etfCode,
      sourceAsOf: section.sourceAsOf,
      rowCount: section.rowCount,
      sourceStatus: section.sourceStatus
    })),
    commonHoldings: calculateCommonHoldings(snapshots),
    globalMovers: sortedMovers,
    sections,
    adContext: {
      tags: ["global-etf", "us-market", "ai", "semiconductor", "crypto", "macro", "active-etf"]
    },
    demoMode
  });
}

function emptyGlobalEtfSection(etf: GlobalEtfConfig): GlobalEtfReportSection {
  return {
    etfCode: etf.etfCode,
    fundName: etf.fundName,
    issuer: etf.issuer,
    strategyType: etf.strategyType,
    sourceAsOf: "",
    sourceUrl: etf.holdingsUrl ?? etf.sourceUrl,
    sourceStatus: "unavailable",
    rowCount: 0,
    topHoldings: [],
    newPositions: [],
    exitedPositions: [],
    weightChanges: [],
    shareChanges: [],
    marketValueChanges: [],
    sectorChanges: [],
    countryChanges: [],
    takeaway:
      etf.sourceStatus === "verified"
        ? "已在追蹤清單中，尚未有可顯示的持股快照；同步完成後會自動更新。"
        : "已在追蹤清單中，等待官方持股 endpoint 驗證後啟用持股同步。"
  };
}

export async function getGlobalEtfDailyReport(db?: Db, sourceDate?: string): Promise<GlobalEtfDailyReport> {
  if (db) {
    const snapshots = await latestSnapshotsFromDb(db, sourceDate);
    if (snapshots.length) return reportFromSnapshots(db, snapshots, false, sourceDate);
    return reportFromSnapshots(db, [], false, sourceDate);
  }
  return reportFromSnapshots(null, demoGlobalEtfSnapshots(), true, sourceDate);
}

export async function syncGlobalEtfHoldings(db: Db, etfCode: string) {
  const { snapshot, raw } = await fetchGlobalEtfSnapshot(etfCode);
  const rawItems = Array.isArray(raw) ? raw : [raw];
  const rawSnapshotIds = [];

  for (const rawItem of rawItems) {
    const rawSnapshot = createRawSnapshot({
      source: "global_etf",
      etfCode: snapshot.etfCode,
      dataType: "holdings",
      tradeDate: snapshot.sourceAsOf,
      fetchResult: rawItem,
      parsedOk: !snapshot.unusableReason,
      parseError: snapshot.unusableReason
    });
    rawSnapshotIds.push(rawSnapshot.snapshotId);
    await db.collection("global_etf_raw_snapshots").insertOne(rawSnapshot);
  }

  snapshot.rawSnapshotId = rawSnapshotIds[0];
  const current = await db
    .collection<GlobalEtfSnapshot>("global_etf_snapshots")
    .find({ etfCode: snapshot.etfCode })
    .sort(snapshot.strategyType === "13f" ? { fetchedAt: -1 } : { sourceAsOf: -1, fetchedAt: -1 })
    .limit(1)
    .next();

  if (current?.signature === snapshot.signature) {
    return { etfCode: snapshot.etfCode, sourceAsOf: snapshot.sourceAsOf, changed: false, rowCount: current.rowCount };
  }

  await db.collection<GlobalEtfSnapshot>("global_etf_snapshots").insertOne(snapshot);

  const previous = current?.unusableReason ? await previousSnapshotFromDb(db, snapshot) : current;
  const changes = calculateGlobalEtfChanges(snapshot, previous ?? null);
  await db.collection("global_etf_holding_changes").deleteMany({ etfCode: snapshot.etfCode, sourceAsOf: snapshot.sourceAsOf });
  if (changes.length) await db.collection("global_etf_holding_changes").insertMany(changes.map((change) => ({ ...change, changeId: randomUUID(), createdAt: new Date() })));
  await invalidateGlobalEtfCache();

  return {
    etfCode: snapshot.etfCode,
    sourceAsOf: snapshot.sourceAsOf,
    changed: true,
    rowCount: snapshot.rowCount,
    rawRowCount: snapshot.rawRowCount,
    changeCount: changes.length
  };
}

export async function syncAllGlobalEtfHoldings(db: Db) {
  const results = [];
  for (const etf of enabledGlobalEtfs) {
    if (etf.sourceStatus !== "verified") {
      results.push({
        etfCode: etf.etfCode,
        ok: true,
        skipped: true,
        reason: "Official holdings endpoint is not verified yet."
      });
      continue;
    }

    try {
      results.push({ etfCode: etf.etfCode, ok: true, result: await syncGlobalEtfHoldings(db, etf.etfCode) });
    } catch (error) {
      results.push({ etfCode: etf.etfCode, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return results;
}
