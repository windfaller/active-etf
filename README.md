# 統一投信主動式 ETF 每日持股追蹤系統

這個專案用 TypeScript、Azure Functions 與 MongoDB 建立「台股主動式 ETF 每日調倉雷達」。MVP 先追蹤統一投信 `00981A`，但 ETF 清單放在 `src/config/etfs.ts`，後續可擴充 `00403A`、`00988A` 或其他主動式 ETF。

本系統只整理公開資料並做研究分析，不構成投資建議。

## 專案用途

- 保存官方來源 raw response，避免解析邏輯污染原始證據。
- 解析每日持股、張數、權重、ETF summary。
- 計算每日增減、清倉、新增持股。
- 依 ETF 發行單位數變化校正，判斷真正主動加碼或減碼。
- 提供 API 與 Telegram digest。

## 安裝方式

安裝依賴：

```bash
pnpm install
```

或：

```bash
npm install
```

在 Codex 桌面環境中，若 shell 沒有載入 `/usr/local/bin`，請使用：

```bash
PATH=/usr/local/bin:$PATH npm install
```

## 環境變數

複製 `.env.example` 並設定：

```env
MONGODB_URI=
MONGODB_DB_NAME=taiwan_active_etf
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
CRAWLER_TIMEOUT_MS=30000
ENABLE_BACKUP_SOURCES=true
```

Azure Functions 本機也可用 `local.settings.json` 管理相同設定。

## 本機執行

```bash
pnpm build
pnpm start
```

## 部署 Azure Functions

1. 建立 Azure Functions v4 Node.js app。
2. 在 Azure App Settings 設定 `.env.example` 中的變數。
3. 設定 MongoDB 連線與網路允許清單。
4. 部署：

```bash
func azure functionapp publish <FUNCTION_APP_NAME>
```

## 手動 sync 00981A

```bash
pnpm build
node dist/src/cli/manualSync.js 00981A
```

手動 sync 會呼叫統一投信官方 `GetPCF` JSON endpoint，保存 raw snapshot，並 upsert `etf_daily_holdings` 與 `etf_daily_summary`。

## 回填與計算變化

回填最近 10 個日曆日可用：

```bash
pnpm build
node dist/src/cli/backfillPcf.js 00981A 10
```

計算最新交易日相對前一交易日的變化：

```bash
node dist/src/cli/calculateChanges.js 00981A
```

`GetPCF` 的歷史查詢需使用 `specificDate=true`，且查詢日期是公告日期；真正交易日會從官方 response 的 `P_UNIT.ValueDate` 偵測。

## 查看 raw snapshots

MongoDB collection：

```txt
raw_snapshots
```

常用查詢條件：

```js
db.raw_snapshots.find({ etfCode: "00981A" }).sort({ fetchedAt: -1 }).limit(10)
```

## 執行 tests

```bash
pnpm test
```

已建立 calculator tests，覆蓋普通加碼、普通減碼、新增、清倉、規模變化校正、表面加碼但實際減碼、表面減碼但實際加碼。

## API

- `GET /api/etf/{etfCode}/holdings?date=YYYY-MM-DD`
- `GET /api/etf/{etfCode}/changes?date=YYYY-MM-DD`
- `GET /api/etf/{etfCode}/summary?date=YYYY-MM-DD`
- `GET /api/etf/active/ranking?date=YYYY-MM-DD`
- `POST /api/admin/etf/{etfCode}/sync-holdings`
- `POST /api/admin/etf/{etfCode}/calculate-changes?date=YYYY-MM-DD`

詳細規格見 `docs/api-spec.md`。

兩個 admin POST API 與 Azure Timer Trigger 共用同一批 job 邏輯；部署到 Azure Functions 時使用 `authLevel: "function"`，需帶 function key。

若本機沒有 Azure Functions Core Tools，可以先用 dev API 驗證 MongoDB 查詢：

```bash
pnpm build
node dist/src/cli/devApi.js
```

## Vue Dashboard

本機網頁使用 Vue 3 + TypeScript + `<script setup>`：

```bash
pnpm build
PORT=7072 node dist/src/cli/devApi.js
pnpm web:dev
```

預設前端網址：

```txt
http://127.0.0.1:5173/
```

前端預設 API base URL 是 `http://127.0.0.1:7072`，可用 `VITE_API_BASE_URL` 覆蓋。

## 已知限制

- 已確認統一投信 `GetPCF` JSON endpoint 可取得 PCF、持股股數、持股權重、基金淨資產與已發行單位數。
- 折溢價 / 市價頁目前會先進風險揭露頁，尚需補完整 risk-disclosure flow。
- 歷史多日持股尚未回填；目前先同步官方 endpoint 回傳的最新 PCF 交易日。
- Codex 桌面環境的預設 `PATH` 可能沒有 `/usr/local/bin`，執行 npm scripts 時建議使用 `PATH=/usr/local/bin:$PATH npm ...`。
- Azure Timer cron 預設依 host 時區運作，部署時需確認 `WEBSITE_TIME_ZONE` 或改用 UTC 對應時間。

## 免責聲明

本資料根據公開資訊整理，僅供資訊研究使用，不構成投資建議。ETF 持股揭露可能有時間差，請以投信與交易所公告為準。
