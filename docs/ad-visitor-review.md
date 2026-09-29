# ETF 持倉雷達：廣告訪客體驗與量測審閱紀錄

審閱基準：2026-09-29（Asia/Taipei）。本文件記錄可檢查的程式與本機預覽結果；正式網域尚未部署此版本。

## 改動與預覽

- 主站新增 `/start`。首屏直接呼叫公開比較 API，呈現 00981A／00982A 真實結果、資料日、覆蓋數、計算時間、缺漏 ETF 的最近資料日及發行商來源。主要入口通往原有 `/compare/etfs?type=tw&codes=00981A,00982A`。
- 比較頁在 API 成功回覆並顯示至少兩張結果卡後才記錄完成。選擇的 ETF 與指標由安全的返回網址保留。
- Skill 頁在安裝步驟之前加入研究工作、2026-09-24 範例、來源、簡單步驟及下載入口；原有帳號、OAuth 與各工具安裝說明仍在可展開區塊。
- 共用帳號提示顯示於落地頁、比較頁、會員遮隱卡與全站登入選單。登入成功、取消及錯誤均回到原研究頁並保留可用狀態；能否完成外部帳號系統的實際註冊往返仍需聯測。
- 本機預覽（此機器）：`http://127.0.0.1:4177/start`、`http://127.0.0.1:4177/zh-TW/mcp/skill`。預覽以本分支靜態建置執行，匿名 `/api` 代理正式站的公開 API。Skill 頁的帳號 API 不在此本機代理中。
- 重建方式：`VITE_MCP_SKILL_PUBLIC=true npm run web:build`，再以 `PREVIEW_API_TARGET=https://active-etf.inthewins.com npm run web:preview:static -- --port 4177` 啟動。主站 PR 預覽使用 CI 的 `VITE_MCP_SKILL_PUBLIC=false`；Skill 正式站由另一套 MCP gateway 發布，尚無本次修改的獨立 gateway 預覽部署。

## 現況與權限

- 原有主站 Vue SPA、公開比較 API、會員遮隱元件、Firebase ID token 換 HttpOnly session，以及獨立 MCP gateway 沿用。公開訪客可看到比較摘要與部分持股；遮隱內容由既有權限程式決定，未新增任何免費解鎖承諾。
- MCP `mongoStore.ts`、`store.ts` 的免費方案上限目前為每日 20 次；這是 MCP 工具用量，不是主站比較頁的免費次數。頁面沒有將它描述成主站額度。
- 原有 GA4 `G-DG02G9VVHY`、Meta Pixel `1811635619849853` 與 Consent Mode 繼續使用。程式庫中未找到主站或 MCP gateway 的 Meta CAPI 發送。未另外安裝第二個 Pixel。
- 共用帳號系統 `auth-app.gogowinners.me` 不在此 repo。本 repo 的 `authSession.ts` 僅驗證 ID token 與建立登入 session，無法證明帳號是當次新建。原先依 `authAction=sign_up` 回調發送註冊成功屬錯誤口徑，已移除；既有會員登入只發登入成功。
- 回調的 `idToken` 是舊有跨站合約；主站 HTML 在任何外部量測腳本載入前將它從可見網址移除，之後才送到同站 API 換 session。要完全取消 token 進入網址，帳號系統須改用一次性授權碼／後端交換合約。

## 事件定義

| 事件 / 平台映射 | 觸發條件 | 去重與參數 | 現狀 |
| --- | --- | --- | --- |
| `page_view` / Meta `PageView` | 首次載入或 SPA 路由變更／返回 | 每次路由變更一筆；GA4、Pixel 共用該次 `event_id`／`eventID`，只傳頁面類別與已允許的來源欄位 | 已實作；Pixel 須獲追蹤同意 |
| `active_etf_compare_started` | 按「立即比較 ETF」或比較工具的比較按鈕 | 每次明確操作一筆；無 ETF 代碼、金額 | 已實作 |
| `active_etf_compare_complete` | API 成功且至少兩張結果卡已顯示 | 以市場、ETF 組合、資料日於同分頁 session 去重；GA4／Pixel 同一 ID | 已實作；失敗及重整不計 |
| `active_etf_sign_up_started` | 訪客點擊免費建立帳號入口 | 只代表意圖；不代表新會員 | 已實作 |
| `active_etf_sign_up_success` / Meta `CompleteRegistration` | **帳號後端證實新會員建立**，且主站取得可驗證一次性回執 | 同一註冊回執只計一次；Meta Pixel 與未來 CAPI 應同用 `CompleteRegistration` 和同一 `event_id` | 前端映射已備妥；目前**不發送**，等待帳號系統回執與 CAPI 合約 |
| `active_etf_skill_download_started` | 使用者點擊下載，Skill 資源請求回覆成功後觸發瀏覽器下載 | 防止同時重複點擊；只代表下載請求／啟動，不代表安裝完成 | 已實作 |
| `active_etf_login_success` | ID token 經本服務後端驗證、session 確認 authenticated | 既有會員與新會員都可屬於登入；不算註冊 | 已實作 |
| `active_etf_login_failed` | session 換取失敗，或外部回調報告登入錯誤 | 取消單列 UI，不視作驗證失敗 | 已實作 |
| `active_etf_page_click` | SPA 內部導覽 | 僅 GA4 診斷；移除 Meta 投遞，無 `value`／`currency` | 已修正；需在 Meta Events Manager 確認舊警告是否消失 |

同意未給予時，Google 維持原站 Consent Mode denied 的受限行為，Pixel 不載入。未決定且點擊研究操作時，按原有機制升級同意；明確選擇「維持匿名量測」後，後續點擊不再覆寫拒絕。UTM、`gclid`／`gbraid`／`wbraid`／`fbclid` 僅在同意後存於 sessionStorage，至多 30 天且字元與長度受限；拒絕時清除。返回網址只允許本站、指定 Azure SWA 預覽主機及本機預覽，以及經列舉的研究路由與查詢欄位。GA4 的 `page_location` 使用去識別化頁面類別 URL，排除 Token、電子郵件與研究代碼；`fbclid` 不寫入該 GA4 URL。

**CAPI 語意**：目前只有 Pixel，不能宣稱「Pixel 與 CAPI 去重已通過」。若接入 CAPI，伺服器事件應沿用同一 Meta `event_name`（例如 `CompleteRegistration`）與 `event_id`，再以 Meta Test Events 的 Browser／Server 收據驗證 deduplication。若帳號系統在自身 Pixel/CAPI 也送註冊事件，必須先確認 Pixel ID、歸因網域、事件 ID 的唯一持有者，避免跨系統重複計入。

## 資料日期與來源調查

2026-09-29 12:10 讀取正式公開 API：`/api/market/dates?limit=7` 推薦 2026-09-24；該日 23／30（76.7%），2026-09-23 為 29／30，2026-09-25 與 09-28 均為 2／30，2026-09-29 為 4／30。原站預設選最近達 70% 覆蓋率的資料日，可避免尚未完成揭露的低覆蓋日期成為默認橫截面。比較 API 同日回覆 00981A 持股 50 檔、00982A 57 檔、共同 18 檔。

2026-09-24 的七檔缺口是 00988A、00997A、00990A、00983A、00402A、00996A、00409A；除 00996A 最新為 2026-09-18，其餘最新為 2026-09-23。Coverage API 僅標記 `stale`、最近資料日與更新時間，**不含來源未揭露／抓取錯誤／排程未跑的原因碼**；頁面將原因標為未知，不把缺口當零。同步函式在 `ENABLE_TIMER_TRIGGERS=true` 時註冊平日 08:30、16:30、18:00、21:00 的 cron 表達式，每檔錯誤記入 logger；實際觸發時區及環境開關尚未核對。台灣證交所行事曆顯示 09-25、09-28 休市，這可解釋市場沒有一般交易日更新，但 API 對兩日仍有少量日期列，須再核對來源日期映射及排程紀錄；不能僅以假日解釋全部缺口。

核對入口：[TWSE 休市行事曆](https://www.twse.com.tw/holidaySchedule/holidaySchedule?response=html)、[00981A 來源](https://www.ezmoney.com.tw/ETF/Fund/Info?fundCode=49YTW)、[00982A 來源](https://www.capitalfund.com.tw/etf/product/detail/399/basic)；各基金實際來源連結由 `configuredEtfs` 顯示於落地頁。資料為揭露與計算結果，無即時行情、保證報酬或個人買賣建議主張。

## 驗證結果與邊界

| 驗收項目 | 結果與證據 |
| --- | --- |
| 未登入研究示範 | **通過**。本機預覽實際讀取公開 API，首屏 23／30、兩檔共同 18；點擊後比較頁載入兩張卡與重疊矩陣。 |
| 返回研究頁與選擇 | **本專案部分通過**。攔截帳號跳轉驗證返回 URL 保留 `type=tw`、`codes=00981A,00982A`、`metric=holdings` 與已同意的 UTM／fbclid；真正的跨網域回調及註冊／取消要與帳號系統聯測。 |
| 新／既有會員區分 | **修正錯誤，聯測待辦**。不再把任何 `authAction=sign_up` 登入當新會員；缺帳號後端新建回執，因此註冊成功事件暫不發。 |
| Pixel／CAPI 去重 | **瀏覽器 ID 通過，CAPI 不適用**。本機截取 GA4 `event_id` 與 Pixel `eventID` 相同；重整不重複完成比較。服務端 CAPI 尚未實作。 |
| 來源保存 | **本機通過，外部回調待辦**。同意後 sessionStorage 與返回 URL 保留 UTM／fbclid；明確拒絕時返回 URL 不含來源。跨網域後端歸因收據仍需驗證。 |
| 桌面／手機／應用程式內瀏覽器 | **桌面與手機模擬通過**。Chrome 1365px、390px；以 Facebook／Instagram iPhone UA 模擬均無水平溢出或頁面例外。尚未在實際 FB／IG App 的 WebView 驗收。 |
| Skill 下載 | **本機通過**。靜態 Skill 取得成功後產生 `SKILL.md` 下載與一筆 `active_etf_skill_download_started`。 |

測試：`VITE_MCP_SKILL_PUBLIC=true npm run web:build`、`npm run functions:build`、`npm test`（299 通過、4 略過）與 prerender SEO 驗證；Playwright Chromium 手動流程。首次桌面 `page_view` 一筆；按比較後一筆 SPA `page_view`、一筆 compare start、完成後一筆 compare complete；重整後只有新的 page_view。FB／IG 模擬首屏 390px 寬無溢出，首次載入 `/assets/` 資源傳輸約 321 KB、DOM Content Loaded 分別 83ms／32ms，**僅是本機網路及快取條件，不代表廣告網路的實際速度**。第三方量測腳本在此測試中攔截為本地隊列，需於測試站 Test Events 與 GA4 DebugView 核對實際收據。

截圖位於本機 `~/.codex/visualizations/2026/09/29/01a0eb3b-dca1-7c13-9e5a-86fca381dab3/`：`start-desktop-clean.png`、`start-mobile-clean.png`、`start-facebook-mobile.png`、`start-instagram-mobile.png`、`compare-desktop.png`、`compare-mobile.png`、`skill-desktop.png`。前兩張為明確選擇匿名量測後的產品畫面；其餘 App UA 截圖顯示首次到站同意介面。截圖含公開資料，於 2026-09-29 取得；資料日期可能變動。

## 尚需其他系統與營運資料

1. **帳號系統**：提供「新帳號已建立」的後端簽章一次性回執（不可僅憑 `authAction`）、帳號建立時間與唯一事件鍵；回調採授權碼／後端交換，避免 ID token 入網址；設定正式與 PR 預覽返回來源白名單，定義取消、失敗、既有帳號登入回調，實測跨網域 UTM／click ID 的留存。此 repo 應在驗證回執後才啟用 `active_etf_sign_up_success`。
2. **Meta CAPI**：指定單一事件發送者與 Pixel ID。若以新會員作最佳化，Meta `CompleteRegistration` 應僅由已驗證新建會員觸發，Pixel 與 CAPI 使用同一 `event_id`；登入不能混入。新會員回執可用後，再於 Meta Test Events、Events Manager 與 GA4 對帳。
3. **舊廣告 227 次連外點擊／80 次到站**：這是舊廣告的原始敘述，比例約 35.2%，**無相同日期、時區、歸因窗的 Meta 與 GA4 明細及主站 HTTP 收據**，不能判斷 147 次差額是未載入或量測漏失。SWA 目前未設定 HTTP 診斷紀錄；已查的 App Insights 七日 117 個 request 屬 standalone MCP，非靜態主站訪問。需取得同一廣告／同一期間的 Meta outbound click、Landing Page View、Pixel PageView、GA4 session/page_view、SWA/CDN HTTP request 與 consent 分布，按 UTM／fbclid、時間和裝置對帳。追查 `active_etf_page_click` value／currency 警告也需 Meta 事件樣本；本 repo 的該事件沒有營收參數，現在亦不再送 Meta。
4. **資料缺口根因**：需核對七檔投信原始揭露、09-25／09-28 非交易日日期列、排程啟用值、逐檔抓取 logger／retry 和資料庫原始列，才能將 `stale` 分類為未揭露、假日、抓取或排程原因。現有公開 API 無該原因碼。

**Meta 最佳化建議**：目前先以公開比較完成事件 `active_etf_compare_complete` 作可驗證的研究行為觀測或次要目標；待帳號後端回執、Pixel/CAPI 去重與新／舊會員聯測通過後，改以標準事件 `CompleteRegistration` 作註冊廣告主要最佳化事件。不要把登入、開始註冊或 Skill 下載當成註冊成功，也不要為一般互動設定假 `value`／`currency`。
