import { randomUUID } from "node:crypto";
import type { Db } from "mongodb";
import { enabledGlobalEtfs, findGlobalEtfConfig } from "../../config/globalEtfs.js";
import type { GlobalEtfDailyReport, GlobalEtfSnapshot } from "../../models/GlobalEtf.js";
import { fetchGlobalEtfSnapshot } from "../../providers/globalEtf/provider.js";
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

export function demoGlobalEtfSnapshots(): GlobalEtfSnapshot[] {
  return [
    sampleSnapshot("DRAM", [
      ["MU", "Micron Technology Inc", 12.4, "Semiconductors"],
      ["WDC", "Western Digital Corp", 10.8, "Technology Hardware"],
      ["STX", "Seagate Technology Holdings", 8.1, "Technology Hardware"],
      ["NVDA", "NVIDIA Corp", 7.2, "Semiconductors"],
      ["AVGO", "Broadcom Inc", 6.5, "Semiconductors"],
      ["LRCX", "Lam Research Corp", 5.2, "Semiconductor Equipment"],
      ["KLAC", "KLA Corp", 4.7, "Semiconductor Equipment"],
      ["AMAT", "Applied Materials Inc", 4.3, "Semiconductor Equipment"],
      ["ASML", "ASML Holding NV", 4.0, "Semiconductor Equipment"],
      ["TSM", "Taiwan Semiconductor Manufacturing", 3.8, "Semiconductors"]
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

async function latestSnapshotsFromDb(db: Db): Promise<GlobalEtfSnapshot[]> {
  const rows = await db
    .collection<GlobalEtfSnapshot>("global_etf_snapshots")
    .aggregate<GlobalEtfSnapshot>([
      { $match: { etfCode: { $in: enabledGlobalEtfs.map((etf) => etf.etfCode) }, unusableReason: { $exists: false } } },
      { $sort: { sourceAsOf: -1, fetchedAt: -1 } },
      { $group: { _id: "$etfCode", doc: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$doc" } }
    ])
    .toArray();

  return rows;
}

async function previousSnapshotFromDb(db: Db, current: GlobalEtfSnapshot): Promise<GlobalEtfSnapshot | null> {
  return db
    .collection<GlobalEtfSnapshot>("global_etf_snapshots")
    .find({ etfCode: current.etfCode, sourceAsOf: { $lt: current.sourceAsOf }, unusableReason: { $exists: false } })
    .sort({ sourceAsOf: -1, fetchedAt: -1 })
    .limit(1)
    .next();
}

async function reportFromSnapshots(db: Db | null, snapshots: GlobalEtfSnapshot[], demoMode = false): Promise<GlobalEtfDailyReport> {
  const sections = [];
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
      sourceUrl: snapshot.sourceUrl,
      sourceStatus: snapshot.sourceStatus,
      rowCount: snapshot.rowCount,
      topHoldings: snapshot.holdings.slice(0, 10),
      ...split,
      sectorChanges: calculateGlobalEtfAggregateChanges(snapshot, previous, "sector"),
      countryChanges: calculateGlobalEtfAggregateChanges(snapshot, previous, "country"),
      takeaway: ""
    };
    section.takeaway = buildTakeaway(section);
    sections.push(section);
    globalMovers.push(...split.weightChanges.map((change) => ({ ...change, etfCode: snapshot.etfCode })));
  }

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
    reportDate: new Date().toISOString().slice(0, 10),
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
    globalMovers: sortedMovers,
    sections,
    adContext: {
      tags: ["global-etf", "us-market", "ai", "semiconductor", "crypto", "macro", "active-etf"]
    },
    demoMode
  });
}

export async function getGlobalEtfDailyReport(db?: Db): Promise<GlobalEtfDailyReport> {
  if (db) {
    const snapshots = await latestSnapshotsFromDb(db);
    if (snapshots.length) return reportFromSnapshots(db, snapshots, false);
  }
  return reportFromSnapshots(null, demoGlobalEtfSnapshots(), true);
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
    .sort({ sourceAsOf: -1, fetchedAt: -1 })
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
    try {
      results.push({ etfCode: etf.etfCode, ok: true, result: await syncGlobalEtfHoldings(db, etf.etfCode) });
    } catch (error) {
      results.push({ etfCode: etf.etfCode, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return results;
}
