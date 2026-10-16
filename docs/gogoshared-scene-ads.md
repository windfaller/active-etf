# GogoShared Scene Ads 接入

Web 宿主接入；共用政策維護與部署由既有流程處理。宿主是 Vue 3／Vite，沒有 Unity 套件或 native plugin。原有 FORVIX registry、搜尋彈窗廣告、內容末端 embed 與追蹤政策保持原狀。

## 身份與設定

- SDK：固定 **1.3.0**，從 https://gogoshared.z23.web.core.windows.net/games/shared/ads/sdk/1.3.0/web/gogo-ads.js 原封不動放在 `public/vendor/gogoshared-ads/1.3.0/gogo-ads.js`。
- SDK SHA256：`202503721b2adb4c9b0683ccebcfc191c8dd8c3390849a3b05536396dac72f82`。
- 本地 `projectId=active-etf`；首次接入前沒有 GogoShared projectId／偏好鍵。偏好由 SDK 保存於 `gogo.ads.active-etf`，不碰登入、會員資料或其他 localStorage。
- 遠端採 SDK 預設 `configProjectId=shared-webp`，只公開 GET https://gogoshared.z23.web.core.windows.net/games/shared/ads/projects/shared-webp/config.json 。沒有 shared-default override，不建立專案政策、不需 Azure 權限。
- 原有 `/api/config` 的 `ads.enabled` 是宿主第一道管理開關，預設關閉／讀取失敗亦關閉；未改動 `ENABLE_ADS` 或 `VITE_ENABLE_ADS`。SDK 共用政策 `enabled` 仍優先於使用者開關，使用者原有偏好不因管理關閉被覆寫。
- 開放 all／games／h8-info 選擇，預設由共用政策決定。目標由驗證後的 creative.clickUrl 取得，不在宿主寫死。SDK 限定兩個 H8 HTTPS origin、保留 query，以 noopener/noreferrer 開新分頁。

## 版位規劃

只在股票清單／個股、績效排行、ETF 比較、訊號、ETF 風格頁的內容末端放一個卡片。這些頁面未放既有 FORVIX 內容 embed。主資料、表格、導覽、搜尋結果均先於廣告；首頁、市場總覽、單檔報告、搜尋彈窗、法務與方法論頁不增加此版位。

靠近可視區 200px 才載入 SDK 與廣告；沒有輪播、背景輪詢或強制開頁。桌面畫布 1200×628、視覺最大寬 520px；600px 以下採方形 640×640、視覺最大寬 280px。素材依 SDK 原分類與比例規則等比置中，留白不當作連結。

canvas 實際 draw 成功後明確 bindClick；分類／開關／斷點改變均重畫同一畫布。SDK 內建驗證檔頭、完整 SHA256、尺寸、PNG 備援與 last-good；更新失敗時保留有效素材並提供手動重試。首次失敗只顯示簡短狀態，不擋研究內容。

一個頁面只載入一份 SDK、一個版位 client。Vue 卸載及 pagehide dispose；bfcache 恢復才重新載入。新增廣告區排除既有「操作即同意」及功能互動量測；沒有廣告點擊／曝光遙測。

## 驗證資料位置

圖集、QA 腳本、截圖、執行證據與修改前基準放在 `/Users/chi/My Projects/AI工作區/主動式ETF/`。專案只保存輕量 SDK 原始碼、宿主接入、文件與必要測試。驗證須分開說明實際公開 GET、使用真實已驗證圖集的本機瀏覽器操作、失敗注入、build 與未驗裝置，不以 SDK 發布代表宿主通過。

固定文件入口：https://gogoshared.z23.web.core.windows.net/games/shared/ads/sdk/1.3.0/skill/SKILL.md ，以及其 `references/integration.md`、`references/schema.md`。

## 本次修改檔案

- `public/vendor/gogoshared-ads/1.3.0/gogo-ads.js`：固定 SDK 原始碼，無修改。
- `src/ads/gogoSceneAds.ts`：型別、單一 script 載入與本地 projectId。
- `src/web/components/SceneAdsPlacement.vue`：單一延遲載入版位、使用者控制、canvas 點擊及生命週期。
- `src/web/App.vue`：只新增兩行，接入指定研究頁。
- `src/web/consent.ts`：廣告區操作不觸發既有隱含同意／功能互動量測。
- `tests/web/consent.test.ts`：檢查上述量測邊界，保留原本產品操作行為。
- `docs/gogoshared-scene-ads.md`：接入與版位說明。
