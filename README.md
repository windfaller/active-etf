# 台灣主動式 ETF 每日持股追蹤系統

這個專案用 TypeScript、Azure Functions 與 MongoDB 建立「台灣主動式 ETF Intelligence Platform」。目前 production sync 追蹤已驗證來源的股票型主動 ETF：統一投信 `00981A`、`00988A`、`00403A`、野村投信 `00980A`、`00985A`、`00999A`、群益投信 `00997A`、`00982A`、`00992A`、元大投信 `00990A`、中信投信 `00995A`、`00983A`、`00406A`、富邦投信 `00405A`、台新投信 `00986A`、`00987A`、國泰投信 `00400A`、安聯投信 `00984A`、`00993A`、`00402A`、聯博投信 `00404A`、兆豐投信 `00996A`、摩根投信 `00989A`、`00401A`、復華投信 `00991A`，以及第一金投信 `00994A`。富邦投信 `00982D`、`00983D` 與聯博投信 `00984D` 的債券型 provider 已完成驗證，但目前保持 disabled，避免混入股票型排名與頁面。凱基投信 `00407A` 已由 TWSE discovery 偵測到，但仍需完成新 provider 反查後才可啟用。

本系統只整理公開資料並做研究分析，不構成投資建議。

## 專案用途

- 保存官方來源 raw response，避免解析邏輯污染原始證據。
- 解析每日持股、張數、權重、ETF summary。
- 計算每日增減、清倉、新增持股。
- 依 ETF 發行單位數變化校正，判斷真正主動加碼或減碼。
- 產生跨 ETF consensus 與 sector flow 聚合資料。
- 提供 API 與 Telegram digest。

## 海外 ETF 熱門持倉雷達

本專案另有第二產品線「海外 ETF 熱門持倉雷達」，入口為 `/global-etfs` 與 `/global-etfs/{etfCode}`。海外 ETF 使用 `src/config/globalEtfs.ts` 與 `global_etf_*` collections，和台灣主動式 ETF 的首頁、ranking、sector flow、stock-impact 聚合分開。

海外產品線啟用官方可同步持倉的主題 ETF、主動式 ETF 與 SEC 13F 組合。13F filing 不提供 exchange ticker，系統只會用保守的 CUSIP 對照表補上高信心 ticker；未對照或私募/SPV exposure 仍顯示 `-`，避免把不確定代號展示給使用者。

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
mega/
fubon/
allianceBernstein/
```

每個 provider 保留：

- `provider.ts`
- `parser.ts`
- `normalizer.ts`
- `types.ts`

目前 `uniPresident`、`nomura`、`capital`、`yuanta`、`ctbc`、`taishin`、`cathay`、`allianz`、`mega`、`jpmorgan`、`fh` 與 `first` 是股票型主動 ETF production daily refresh 來源。`fubon` 與 `allianceBernstein` 已驗證債券型 ETF endpoint，但目前設定為 disabled。其他 provider 是 `pending_reverse_engineering`，不會被 production sync 使用。

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
TELEGRAM_BOT_USERNAME=
TELEGRAM_WEBHOOK_SECRET=
TELEGRAM_ALLOWED_USER_IDS=
TELEGRAM_ALLOWED_CHAT_IDS=
TELEGRAM_ETF_ONBOARDING_CHAT_IDS=
TELEGRAM_CHAT_ID=
PUBLIC_BASE_URL=https://active-etf.inthewins.com
ADMIN_JOB_TOKEN=
ENABLE_TIMER_TRIGGERS=false
ENABLE_ADS=false
VITE_ENABLE_ADS=false
ENABLE_AD_TRACKING=false
REDIS_GOGOWINNERS_HOST=
REDIS_GOGOWINNERS_PORT=6380
REDIS_GOGOWINNERS_KEY=
REDIS_DAILY_CACHE_TTL_SECONDS=86400
CRAWLER_TIMEOUT_MS=30000
ENABLE_BACKUP_SOURCES=true
```

廣告系統預設關閉，並透過 runtime config 控制。正式站請到 Azure Static Web Apps 的 Configuration / Application settings 設定 `ENABLE_ADS=true` 後重啟 Functions runtime 或等待設定生效；`VITE_ENABLE_ADS=true` 也會被 `/api/config` 接受作為相容舊設定的 alias。追蹤事件仍由 `ENABLE_AD_TRACKING=true` 另外控制，預設不送真實 tracking。

Azure Functions 本機也可用 `local.settings.json` 管理相同設定。Redis 是每日 API response cache；若未設定 Redis，API 會自動回到直接查 MongoDB。

Telegram 多用戶通知使用 webhook。`PUBLIC_BASE_URL` 預設為 `https://active-etf.inthewins.com`，`TELEGRAM_WEBHOOK_SECRET` 會用來驗證 Telegram header。前端的 Telegram 訂閱按鈕會呼叫 `/api/telegram/info` 取得 bot link；可設定 `TELEGRAM_BOT_USERNAME`，若未設定則 server 會用 `TELEGRAM_BOT_TOKEN` 呼叫 Telegram `getMe` 取得 username。若 `TELEGRAM_ALLOWED_USER_IDS` 與 `TELEGRAM_ALLOWED_CHAT_IDS` 都留空，任何對 bot 發送 `/start` 的用戶或群組都能訂閱；若有填 allowlist，只有清單內的 user id 或 chat id 會收到通知。`TELEGRAM_ETF_ONBOARDING_CHAT_IDS` 是新主動式 ETF 偵測後的管理通知對象，會收到可直接貼給 Codex 的 `taiwan-active-etf-onboarding` prompt；這類通知不會廣播給一般訂閱者。`TELEGRAM_CHAT_ID` 僅作為尚未有訂閱者時的舊版 fallback。

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

正式 API 的 keep-warm 由 `cloudflare/azure-warmup` Worker 每 5 分鐘呼叫 Azure origin：

```txt
POST /api/health/warmup
x-warmup-token: <WARMUP_TOKEN>
```

Azure Static Web Apps App Settings 與 Cloudflare Worker Secret 必須設定相同的 `WARMUP_TOKEN`。該 endpoint 只會初始化 Functions runtime、MongoDB 與 Redis 連線，不會執行資料同步或寫入業務資料。同一個 Worker 也會平行呼叫 Forvix staging 與 production 的 `/api/health?source=cloudflare-warmup&ts=<timestamp>`，每個目標皆有獨立 timeout 與結果日誌。

若 `daily-refresh` 在 SWA/Cloudflare 路徑被 5 分鐘左右的 backend timeout 中斷，請改用拆分式 Logic App：

```txt
POST /api/jobs/discover-active-etfs?notify=true
POST /api/jobs/etfs/enabled
POST /api/jobs/etf/{etfCode}/sync-holdings
POST /api/jobs/etf/{etfCode}/calculate-changes
POST /api/jobs/aggregates
```

Logic App 應從 `etfs/enabled` 的 `result.etfs` 動態 foreach，不需要在 workflow 裡列舉 ETF code；未來新增或停用 ETF 只要更新程式設定並部署。

必須在 SWA App Settings 設定 `ADMIN_JOB_TOKEN`，並讓 Logic App 帶 header：

```txt
x-admin-token: <ADMIN_JOB_TOKEN>
```

`daily-refresh` 會先執行證交所 e 添富主動式 ETF 偵測，再跑既有持股同步與計算，最後同步海外 ETF 官方持股快照；未追蹤的新上市 ETF 會寫入 `active_etf_discoveries`，若設定 Telegram 變數且偵測到新項目，會主動通知。

若 Logic App 要在每日資料更新後發送 Telegram 每日日報，請在 `daily-refresh` 成功後接著呼叫：

```txt
POST /api/jobs/telegram/daily-digest
```

同樣必須帶 `x-admin-token`。可選參數：`etfCode=00981A`、`date=YYYY-MM-DD`。若未帶 `date`，系統會使用該 ETF 最新可用的 `etf_holding_changes.tradeDate`，避免假日或揭露延遲時查不到「今天」資料。

股票主題 tag 可每週刷新一次，讓 `stock_sector_profiles.themeTags` 跟最新 mapping 規則同步。SWA / Logic App 可排程呼叫：

```txt
POST /api/jobs/sector-profiles/refresh
```

同樣必須帶 `x-admin-token`。若部署到獨立 Azure Functions App 並設定 `ENABLE_TIMER_TRIGGERS=true`，`refreshSectorProfiles` Timer 會每週一 07:00 執行。

設定 Telegram webhook 可呼叫一次：

```txt
POST /api/jobs/telegram/set-webhook
```

同樣必須帶 `x-admin-token`。成功後 Telegram 會把 `/start`、`/subscribe`、`/unsubscribe`、`/toggle`、`/discover_on`、`/discover_off`、`/digest_on`、`/digest_off`、`/status`、`/latest` 等訊息送到 `https://active-etf.inthewins.com/api/telegram/webhook`。用戶基本資料與通知狀態會存入 `telegram_subscribers`。`/latest` 會回覆最新跨 ETF 個股影響排行，`/latest 00981A` 會回覆單檔 ETF 最新操作日報。

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
- `POST /api/jobs/discover-active-etfs?notify=true`
- `POST /api/jobs/telegram/set-webhook`
- `POST /api/jobs/telegram/daily-digest?etfCode=00981A&date=YYYY-MM-DD`
- `POST /api/telegram/webhook`

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

前端支援可分享與可索引的 SPA RESTful routes：

```txt
/
/market
/etf/{etfCode}
/etf/{etfCode}/changes
/etf/{etfCode}/premium-history
/global-etfs
/global-etfs/{etfCode}
/institutions
/institutions/{portfolioCode}
/active-etfs/
/data-usage/
```

Vite build 會依 `src/config/etfs.ts` 與 `src/config/globalEtfs.ts` 產生每個已知路由的獨立靜態 HTML，原始 HTML 已包含專屬 title、description、canonical、H1、Breadcrumb JSON-LD 與可讀說明；每日資料仍由 Vue/API 載入，不需每日 rebuild。`/sitemap.xml` 與 `/robots.txt` 固定使用 `https://active-etf.inthewins.com`。未知 ETF 代碼不在 SPA fallback 範圍，不會自動切到預設 ETF。

舊網域的跨網域 301 需在可依 hostname 判斷的 Azure Front Door、Cloudflare 或獨立 redirect site 設定；詳見 [`docs/production-domain-migration.md`](docs/production-domain-migration.md)。

SEO 產物可使用以下指令驗證：

```sh
npm run test:seo
```

## 已知限制

- 已確認統一投信 `GetPCF` JSON endpoint 可取得 PCF、持股股數、持股權重、基金淨資產與已發行單位數。
- 折溢價 / 市價頁目前會先進風險揭露頁，尚需補完整 risk-disclosure flow。
- 歷史多日持股尚未回填；目前先同步官方 endpoint 回傳的最新 PCF 交易日。
- Codex 桌面環境的預設 `PATH` 可能沒有 `/usr/local/bin`，執行 npm scripts 時建議使用 `PATH=/usr/local/bin:$PATH npm ...`。
- Azure Static Web Apps managed Functions 只支援 HTTP triggers；排程請用 Logic App 呼叫 admin POST API，或改用獨立 Azure Functions App 並設定 `ENABLE_TIMER_TRIGGERS=true`。

## 免責聲明

本資料根據公開資訊整理，僅供資訊研究使用，不構成投資建議。ETF 持股揭露可能有時間差，請以投信與交易所公告為準。
