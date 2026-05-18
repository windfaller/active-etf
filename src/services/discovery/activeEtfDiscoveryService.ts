import type { Db } from "mongodb";
import { configuredEtfs } from "../../config/etfs.js";
import type { ActiveEtfDiscovery } from "../../models/ActiveEtfDiscovery.js";
import { defaultCrawlerHeaders, fetchSource } from "../source/httpClient.js";
import { createRawSnapshot, saveRawSnapshot } from "../source/rawSnapshotService.js";
import { parseTwseActiveEtfProducts, type TwseActiveEtfProduct } from "./twseActiveEtfParser.js";

const twseProductsUrl = "https://wwwc.twse.com.tw/zh/ETFortune-institute/ajaxProducts";
const twseProductsReferer = "https://wwwc.twse.com.tw/zh/ETFortune-institute/products";

export interface ActiveEtfDiscoveryResult {
  totalOfficialActiveEtfs: number;
  trackedCount: number;
  untrackedCount: number;
  newlyDetected: ActiveEtfDiscovery[];
  allUntracked: ActiveEtfDiscovery[];
  notification: {
    attempted: boolean;
    sent: boolean;
    reason?: string;
  };
  rawSnapshotId: string;
}

function providerSuggestion(issuer: string): string | null {
  if (/統一/u.test(issuer)) return "uniPresident";
  if (/野村/u.test(issuer)) return "nomura";
  if (/群益/u.test(issuer)) return "capital";
  if (/國泰/u.test(issuer)) return "cathay";
  if (/摩根/u.test(issuer)) return "jpmorgan";
  if (/中國信託|中信/u.test(issuer)) return "ctbc";
  if (/台新/u.test(issuer)) return "taishin";
  if (/元大/u.test(issuer)) return "yuanta";
  if (/復華/u.test(issuer)) return "fh";
  if (/第一金/u.test(issuer)) return "first";
  if (/安聯/u.test(issuer)) return "allianz";
  return null;
}

function discoveryStatus(isTracked: boolean, suggestedProviderId: string | null): ActiveEtfDiscovery["discoveryStatus"] {
  if (isTracked) return "tracked";
  return suggestedProviderId ? "needs_provider_mapping" : "needs_provider_reverse_engineering";
}

async function fetchOfficialActiveEtfs() {
  return fetchSource({
    url: twseProductsUrl,
    method: "POST",
    headers: {
      ...defaultCrawlerHeaders(twseProductsReferer),
      Accept: "application/json, text/javascript, */*; q=0.01",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest"
    },
    body: "managerType=Active&sort=listingDate&orderBy=DESC"
  });
}

function buildDiscovery(
  product: TwseActiveEtfProduct,
  trackedCodes: Set<string>,
  rawSnapshotId: string,
  now: Date
): ActiveEtfDiscovery {
  const configured = configuredEtfs.find((etf) => etf.etfCode === product.etfCode);
  const suggestedProviderId = providerSuggestion(product.issuer);
  const isTracked = trackedCodes.has(product.etfCode);

  return {
    etfCode: product.etfCode,
    stockName: product.stockName,
    listingDate: product.listingDate,
    issuer: product.issuer,
    indexName: product.indexName,
    totalAssetValue: product.totalAssetValue,
    closePrice: product.closePrice,
    holders: product.holders,
    valueYtd: product.valueYtd,
    volumeYtd: product.volumeYtd,
    isTracked,
    configuredProviderId: configured?.source.providerId ?? null,
    suggestedProviderId,
    discoveryStatus: discoveryStatus(isTracked, suggestedProviderId),
    sourceUrl: twseProductsUrl,
    rawSnapshotId,
    firstDetectedAt: now,
    lastSeenAt: now,
    lastNotifiedAt: null
  };
}

function formatDiscoveryMessage(newlyDetected: ActiveEtfDiscovery[], allUntracked: ActiveEtfDiscovery[]): string {
  const lines = [
    "台灣主動式 ETF 偵測通知",
    `新發現未追蹤：${newlyDetected.length} 檔`,
    `目前未追蹤總數：${allUntracked.length} 檔`,
    ""
  ];

  const list = newlyDetected.length ? newlyDetected : allUntracked.slice(0, 12);
  for (const item of list) {
    const provider = item.suggestedProviderId ? `建議 provider: ${item.suggestedProviderId}` : "需新增 provider";
    lines.push(`- ${item.etfCode} ${item.stockName}｜${item.listingDate}｜${item.issuer}｜${provider}`);
  }

  if (!newlyDetected.length && allUntracked.length) {
    lines.push("", "註：沒有新發現，但仍有未追蹤清單待處理。");
  }

  lines.push("", "下一步：先 reverse engineer 官網持股/PCF endpoint，再啟用 provider。");
  return lines.join("\n");
}

async function sendTelegramText(text: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) {
    throw new Error("TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are required");
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text
    })
  });

  if (!response.ok) {
    throw new Error(`Telegram send failed: ${response.status} ${await response.text()}`);
  }
}

export async function runActiveEtfDiscovery(
  db: Db,
  options: { notify?: boolean } = {}
): Promise<ActiveEtfDiscoveryResult> {
  const fetchResult = await fetchOfficialActiveEtfs();
  const products = parseTwseActiveEtfProducts(fetchResult.rawBody);
  const snapshot = createRawSnapshot({
    source: "twse_etfortune",
    etfCode: "__ACTIVE_ETF_LIST__",
    dataType: "api_response",
    fetchResult,
    parsedOk: true
  });
  await saveRawSnapshot(db, snapshot);

  const configuredCodes = new Set(configuredEtfs.filter((etf) => etf.enabled).map((etf) => etf.etfCode));
  const masterCodes = new Set(await db.collection("etf_master").distinct("etfCode", { enabled: true }));
  const trackedCodes = new Set([...configuredCodes, ...masterCodes].map((code) => String(code)));
  const now = new Date();
  const collection = db.collection<ActiveEtfDiscovery>("active_etf_discoveries");
  const newlyDetected: ActiveEtfDiscovery[] = [];
  const discoveries = products.map((product) => buildDiscovery(product, trackedCodes, snapshot.snapshotId, now));

  for (const discovery of discoveries) {
    const existing = await collection.findOne({ etfCode: discovery.etfCode });
    const { firstDetectedAt: _firstDetectedAt, lastNotifiedAt: _lastNotifiedAt, ...updateFields } = discovery;

    await collection.updateOne(
      { etfCode: discovery.etfCode },
      {
        $set: updateFields,
        $setOnInsert: {
          firstDetectedAt: discovery.firstDetectedAt,
          lastNotifiedAt: discovery.lastNotifiedAt
        }
      },
      { upsert: true }
    );

    if (!discovery.isTracked && (!existing || !existing.lastNotifiedAt)) {
      newlyDetected.push(discovery);
    }
  }

  const allUntracked = await collection
    .find({ isTracked: false })
    .sort({ listingDate: -1, etfCode: 1 })
    .toArray();

  const telegramConfigured = Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
  const notification = {
    attempted: Boolean(options.notify && newlyDetected.length && telegramConfigured),
    sent: false,
    reason:
      options.notify && newlyDetected.length && !telegramConfigured
        ? "TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are not configured"
        : undefined
  };

  if (notification.attempted) {
    try {
      await sendTelegramText(formatDiscoveryMessage(newlyDetected, allUntracked));
      await collection.updateMany(
        { etfCode: { $in: newlyDetected.map((item) => item.etfCode) } },
        { $set: { lastNotifiedAt: new Date() } }
      );
      notification.sent = true;
    } catch (error) {
      notification.reason = error instanceof Error ? error.message : String(error);
    }
  }

  return {
    totalOfficialActiveEtfs: products.length,
    trackedCount: discoveries.filter((item) => item.isTracked).length,
    untrackedCount: allUntracked.length,
    newlyDetected,
    allUntracked,
    notification,
    rawSnapshotId: snapshot.snapshotId
  };
}
