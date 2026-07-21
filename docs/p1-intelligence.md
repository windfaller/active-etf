# P1 情報產品升級

P1 延續「主動 ETF 機構調倉情報」定位，將可觀察事實、系統計算與研究解讀分開呈現。所有輸出只供研究，不預測價格或報酬。

## 產品路由

- 股票：`/stocks`、`/stocks/tw/:symbol`、`/stocks/us/:symbol`
- ETF 比較：`/compare/etfs?type=tw|global&codes=...`
- 訊號：`/signals`、`/signals/consecutive`、`/signals/reversals`、`/signals/divergence`
- 經理人風格：`/etf/:code/style`
- 搜尋：`/search?q=...` 與 Cmd/Ctrl+K
- 方法論：`/methodology`

帶有比較 codes 的 URL 與搜尋結果使用 `noindex`。穩定工具頁、主要股票頁（2330、MU）及已啟用台灣 ETF 的風格頁納入 build-time prerender。

## API

| Endpoint | 邊界 |
| --- | --- |
| `GET /api/stocks/search` | q、market、limit 驗證 |
| `GET /api/stocks/:market/:symbol/overview` | 股票摘要與日／季資料區隔 |
| `GET /api/stocks/:market/:symbol/history` | window 只允許 3、5、20 |
| `GET /api/stocks/:market/:symbol/etfs` | 有界 ETF 明細 |
| `GET /api/stocks/:market/:symbol/institutions` | 未知法人資料保留為 null |
| `GET /api/compare/etfs` | 同類 2–4 檔；排除 13F |
| `GET /api/signals` | kind、window、limit 驗證 |
| `GET /api/etf/:code/style` | 只允許已啟用台灣 ETF 與 20／60 日 |
| `GET /api/search` | 至少 2 字、限定 types 與 limit |

成功 response 使用 `Cache-Control` 與 `stale-while-revalidate`。查詢只使用標準化代碼與 escape 後的有限 regex，不接受任意 MongoDB 運算子。

## 計算規則

- neutral：主動張數絕對值低於 0.01 且權重變化低於 0.0001 percentage point。
- 共識：同方向至少 2 檔、超過反方向，且佔 directional ETF 至少 60%；neutral 另列但不稀釋分母。
- 連續訊號：只讀有效交易日序列；每筆都需超過 neutral 門檻。
- 反轉：反轉前至少 2 個有效交易日同方向，反轉日也需達門檻。
- ETF／法人：方向相同為一致、方向相反為分歧；任一側缺資料為資料不足。
- 集合重疊：`intersection / union`（Jaccard）。
- 權重重疊：`Σ min(weightA, weightB)`；identity 同時包含 ticker 與 exposure type。
- 集中度：前 5、前 10 與 `Σ weight²`（HHI）。
- 調整強度：`Σ |weight change| / 2`。
- 百分位：同類有效樣本至少 5 檔才顯示。
- 可信度：由涵蓋率、延遲、規模資料完整度、觀察日完整度、單一 ETF 主導程度及同方向比例給出高／中／低與文字原因。

## MongoDB 與部署

P1 沒有新增 collection、欄位 migration、materialized snapshot 或 backfill。沿用 `etf_daily_holdings`、`etf_daily_summary`、`global_etf_snapshots`、`institutional_trading_daily`、`stock_sector_profiles` 等既有資料。

新增三個查詢索引：

- `etf_daily_holdings: { stockId: 1, tradeDate: -1, etfCode: 1 }`
- `global_etf_snapshots: { etfCode: 1, sourceAsOf: -1, fetchedAt: -1 }`
- `global_etf_snapshots: { "holdings.ticker": 1, sourceAsOf: -1, etfCode: 1 }`

索引透過既有、可重跑的 `ensureIndexes` 建立；部署後需確認 `syncEtfMaster` 已在啟用 timer 的環境執行一次。沒有無界限 backfill 或 deploy-time 資料寫入。

## 效能基準（2026-07-21，本地 production preview + 實際開發資料庫）

- 首頁主要 JS：173.46 kB → 184.72 kB（gzip 54.31 kB → 58.53 kB）。
- P1 view 均 lazy load；股票 view chunk 10.63 kB（gzip 4.32 kB）。
- 台股股票初始資料：4 個平行 request，共 21,069 bytes；warm response 約 0.22–0.61 秒。
- 台灣 ETF compare：1 request、2,950 bytes、warm 0.27 秒。
- signals／style：各 1 request；warm 約 1.03／1.06 秒，是目前需持續觀察的較慢聚合查詢。
- Lighthouse mobile（`/stocks/tw/2330`）：Performance 95、Accessibility 95、Best Practices 100、SEO 100；FCP 2.2 s、LCP 2.4 s、TBT 30 ms、CLS 0。

Lighthouse 使用 production build、static preview proxy 與本地實際 API。第三方 FORVIX iframe 保持 lazy load，股票 async route 先保留內容空間，避免資料載入時將頁尾推移。

## 已知資料限制

- 法人資料缺少時顯示「資料不足」，不以零補值。
- 13F 保留 period of report、filedAt、capturedAt 三個時間欄位，永不併入每日 ETF 淨變動。
- 海外 ETF ticker 相同但 Equity／Swap／Cash 類型不同時不靜默合併。
- 60 日保留率、平均新增持股維持時間或頻繁進出比例在歷史不足時維持 null。
- signals 與 style 目前由既有資料即時計算；若 production latency 持續超過門檻，再考慮可重建、冪等的每日 snapshot。
