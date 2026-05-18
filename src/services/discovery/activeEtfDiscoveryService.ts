import type { Db } from "mongodb";
import { configuredEtfs } from "../../config/etfs.js";
import type { ActiveEtfDiscovery } from "../../models/ActiveEtfDiscovery.js";
import { defaultCrawlerHeaders, fetchSource } from "../source/httpClient.js";
import { createRawSnapshot, saveRawSnapshot } from "../source/rawSnapshotService.js";
import { sendTelegramMessageToChatIds } from "../notify/telegramSubscriberService.js";
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
  if (/兆豐/u.test(issuer)) return "mega";
  if (/富邦/u.test(issuer)) return "fubon";
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

function parseChatIds(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function onboardingPrompt(newlyDetected: ActiveEtfDiscovery[]): string {
  const etfLines = newlyDetected
    .map((item) => {
      const providerHint = item.suggestedProviderId ? `建議 providerId: ${item.suggestedProviderId}` : "需要新增 provider";
      return `- ${item.etfCode} ${item.stockName}｜${item.issuer}｜上市日 ${item.listingDate}｜${providerHint}`;
    })
    .join("\n");

  return [
    "請使用 taiwan-active-etf-onboarding skill，處理以下新偵測到的台灣主動式 ETF：",
    "",
    etfLines,
    "",
    "要求：",
    "- 不要猜 API。",
    "- 必須 reverse engineer 真正 JSON/XHR/API/CSV/XLSX endpoint。",
    "- 優先 JSON，其次 CSV、XLSX、hidden table endpoint，HTML parser 只能當最後手段。",
    "- 必須保存 raw snapshot。",
    "- 新 provider 必須 fail in isolation，不得影響目前頁面與既有 ETF 資料。",
    "- 不要啟用新 ETF，直到 holdings 與 summary/NAV 都用真實 response 驗證。",
    "",
    "完成後請跑：",
    "PATH=/usr/local/bin:$PATH npm test -- --run",
    "PATH=/usr/local/bin:$PATH npm run functions:build",
    "PATH=/usr/local/bin:$PATH npm run build",
    "",
    "最後 commit 並 push 到 origin/main。"
  ].join("\n");
}

export function formatDiscoveryMessage(newlyDetected: ActiveEtfDiscovery[], allUntracked: ActiveEtfDiscovery[]): string {
  const lines = [
    "台灣主動式 ETF onboarding 通知",
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

  lines.push(
    "",
    "請手動觸發 Codex skill 處理；目前只通知 onboarding 管理者，不會廣播給一般訂閱者。",
    "",
    "可直接貼給 Codex 的 prompt：",
    onboardingPrompt(newlyDetected.length ? newlyDetected : allUntracked.slice(0, 12))
  );
  return lines.join("\n");
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

  const notification = {
    attempted: false,
    sent: false,
    reason: undefined as string | undefined
  };

  if (options.notify && newlyDetected.length) {
    try {
      const targetChatIds = parseChatIds(process.env.TELEGRAM_ETF_ONBOARDING_CHAT_IDS);
      const broadcast = await sendTelegramMessageToChatIds(targetChatIds, formatDiscoveryMessage(newlyDetected, allUntracked));
      notification.attempted = broadcast.attempted;
      notification.sent = broadcast.sent;
      notification.reason =
        broadcast.reason ??
        (!targetChatIds.length ? "TELEGRAM_ETF_ONBOARDING_CHAT_IDS is not configured" : undefined);
      if (broadcast.sent) {
        await collection.updateMany(
          { etfCode: { $in: newlyDetected.map((item) => item.etfCode) } },
          { $set: { lastNotifiedAt: new Date() } }
        );
      }
    } catch (error) {
      notification.attempted = true;
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
