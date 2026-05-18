# 台灣主動式 ETF 每日持股追蹤系統

這個專案用 TypeScript、Azure Functions 與 MongoDB 建立「台灣主動式 ETF Intelligence Platform」。目前 production sync 追蹤已驗證來源的統一投信 `00981A`、`00988A`、`00403A`、野村投信 `00980A`、`00985A`、`00999A`，以及群益投信 `00982A`、`00992A`。Provider registry 已納入第一階段其他投信 ETF，但在沒有 reverse engineer 到真正 endpoint 前保持 disabled，避免污染資料。

本系統只整理公開資料並做研究分析，不構成投資建議。

## 專案用途

- 保存官方來源 raw response，避免解析邏輯污染原始證據。
- 解析每日持股、張數、權重、ETF summary。
- 計算每日增減、清倉、新增持股。
- 依 ETF 發行單位數變化校正，判斷真正主動加碼或減碼。
- 產生跨 ETF consensus 與 sector flow 聚合資料。
- 提供 API 與 Telegram digest。

## Provider 架構

Provider 介面與 registry 位於：

```txt
src/providers/
```

已建立資料夾：

```txt
uniPresident/
nomura/
capital/
ctbc/
cathay/
yuanta/
taishin/
jpmorgan/
fh/
first/
allianz/
```

每個 provider 保留：

- `provider.ts`
- `parser.ts`
- `normalizer.ts`
- `types.ts`

目前 `uniPresident`、`nomura` 與 `capital` 是 verified provider，會被 production daily refresh 使用。其他 provider 是 `pending_reverse_engineering`，不會被 production sync 使用。

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
ADMIN_JOB_TOKEN=
ENABLE_TIMER_TRIGGERS=false
REDIS_GOGOWINNERS_HOST=
REDIS_GOGOWINNERS_PORT=6380
REDIS_GOGOWINNERS_KEY=
REDIS_DAILY_CACHE_TTL_SECONDS=86400
CRAWLER_TIMEOUT_MS=30000
ENABLE_BACKUP_SOURCES=true
```

Azure Functions 本機也可用 `local.settings.json` 管理相同設定。Redis 是每日 API response cache；若未設定 Redis，API 會自動回到直接查 MongoDB。

## 本機執行

```bash
pnpm functions:build
PORT=7072 pnpm api:dev
pnpm web:dev
```

## 部署 Azure Static Web Apps

此專案預設以 Azure Static Web Apps 部署前端，`npm run build` 會產生 `dist/index.html`，對應 SWA workflow 的：

```yaml
app_location: "/"
output_location: "dist"
app_build_command: "npm run build"
```

Azure Static Web Apps managed Functions 只支援 HTTP triggers，因此本專案在 SWA 模式不註冊 Timer Trigger。排程請用 Logic App / Automation / GitHub Actions 呼叫：

```txt
POST /api/jobs/daily-refresh
```

必須在 SWA App Settings 設定 `ADMIN_JOB_TOKEN`，並讓 Logic App 帶 header：

```txt
x-admin-token: <ADMIN_JOB_TOKEN>
```

## 部署獨立 Azure Functions App

若要使用真正的 Timer Trigger，請部署到獨立 Azure Functions App，而不是 SWA managed Functions。

1. 建立 Azure Functions v4 Node.js app。
2. 在 Azure App Settings 設定 `.env.example` 中的變數。
3. 設定 `ENABLE_TIMER_TRIGGERS=true`。
4. 設定 MongoDB 連線與網路允許清單。
5. 部署：

```bash
pnpm functions:build
func azure functionapp publish <FUNCTION_APP_NAME>
```

## 手動 sync 00981A

```bash
pnpm functions:build
node dist-api/src/cli/manualSync.js 00981A
```

手動 sync 會呼叫統一投信官方 `GetPCF` JSON endpoint，保存 raw snapshot，並 upsert `etf_daily_holdings` 與 `etf_daily_summary`。
其他已設定 ETF 也可把 CLI 參數改成 `00988A` 或 `00403A`。

## 回填與計算變化

回填最近 10 個日曆日可用：

```bash
pnpm functions:build
node dist-api/src/cli/backfillPcf.js 00981A 10
```

計算最新交易日相對前一交易日的變化：

```bash
node dist-api/src/cli/calculateChanges.js 00981A
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
- `GET /api/etf/{etfCode}/summary-history?limit=90`
- `GET /api/etf/active/ranking?date=YYYY-MM-DD`
- `GET /api/market/stock-impact?date=YYYY-MM-DD`
- `POST /api/jobs/etf/{etfCode}/sync-holdings`
- `POST /api/jobs/etf/{etfCode}/calculate-changes?date=YYYY-MM-DD`
- `POST /api/jobs/etfs/sync-holdings`
- `POST /api/jobs/etfs/calculate-changes?date=YYYY-MM-DD`
- `POST /api/jobs/daily-refresh`

詳細規格見 `docs/api-spec.md`。
Mongo schema 見 `docs/mongo-schema.md`。
Provider endpoint 狀態見 `docs/provider-reverse-engineering.md`。
Troubleshooting 見 `docs/troubleshooting.md`。

admin POST API 與 Timer Trigger 共用同一批 job 邏輯；SWA managed Functions 環境請由 Logic App 排程觸發 `POST /api/jobs/daily-refresh`。

若本機沒有 Azure Functions Core Tools，可以先用 dev API 驗證 MongoDB 查詢：

```bash
pnpm functions:build
node dist-api/src/cli/devApi.js
```

## Vue Dashboard

本機網頁使用 Vue 3 + TypeScript + `<script setup>`：

```bash
pnpm functions:build
PORT=7072 node dist-api/src/cli/devApi.js
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
- Azure Static Web Apps managed Functions 只支援 HTTP triggers；排程請用 Logic App 呼叫 admin POST API，或改用獨立 Azure Functions App 並設定 `ENABLE_TIMER_TRIGGERS=true`。

## 免責聲明

本資料根據公開資訊整理，僅供資訊研究使用，不構成投資建議。ETF 持股揭露可能有時間差，請以投信與交易所公告為準。
