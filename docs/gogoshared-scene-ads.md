# GogoShared Scene Ads 接入

宿主為 Vue 3／Vite。固定 SDK **1.3.0**，原始碼位於 `public/vendor/gogoshared-ads/1.3.0/gogo-ads.js`，SHA256 為 `202503721b2adb4c9b0683ccebcfc191c8dd8c3390849a3b05536396dac72f82`，與固定發布網址相符，未修改或重複安裝。無 Unity 套件或 native plugin。

## 身份與控制

本地 `projectId=active-etf`，偏好鍵 `gogo.ads.active-etf`。遠端採 SDK 預設 `configProjectId=shared-webp`，只公開 GET 既有 `projects/shared-webp/config.json`，此次查核 revision=`20261016-clicks`、catalog SHA256=`e868d79d2a2c03ec3bac036ac1cb0dc9d728a1f78e4cd3b5116b543ae67968e5`。沒有 shared-default override，不建立專案政策、不需 Azure 權限。

依本次宿主要求，移除使用者的「顯示廣告」勾選。建立 client 時呼叫 `setEnabled(true)` 遷移舊 opt-out；保留原 projectId、all／games／h8-info 分類及其他偏好。宿主 `/api/config` 的 `ads.enabled` 和共用政策 `config.enabled` 仍優先，管理關閉不會被繞過。宿主設定讀取失敗則關閉，不預留空白側欄。這是宿主控制方式變更，不更動共用 SDK 或共用政策。

## 版位與載入

研究頁提供持續可見的合作廣告：桌面置於內容旁的 sticky 側欄，1180px 以下為內容前的短卡，600px 以下使用小型方形素材。涵蓋今日情報、研究示範、台灣／海外 ETF、機構、股票、比較、績效、訊號與風格頁。搜尋、方法論、法務、404 不新增版位；原有 FORVIX embed 與搜尋版位不變。

SDK 與資料獨立載入，靠近可視區 200px 才載入廣告，不等待廣告才呈現資料，不使用倒數、蓋板或自動開頁。慢速／失敗資料請求期間仍可查看合作內容。SPA 在研究頁之間保留同一個 client、圖集與 canvas；以 route path 取得穩定的 creative 索引，換頁重畫已驗證素材，不重新下載圖集或輪詢。完整離開研究區、卸載或 pagehide 時 dispose，bfcache 恢復再載入。

canvas 實際 draw 成功後明確 bindClick。分類與斷點改變會重畫同一畫布；點擊目標由驗證後的 `creative.clickUrl` 取得，不在宿主寫死。保留兩個 H8 HTTPS origin、query、noopener/noreferrer、留白命中檢查、檔頭／完整 SHA256／尺寸驗證、PNG 備援與 last-good。重試失敗不清除已驗證圖。沒有新增點擊／曝光遙測或付費廣告網路，操作仍排除既有的隱含同意量測。

## 驗證與交付邊界

固定文件：https://gogoshared.z23.web.core.windows.net/games/shared/ads/sdk/1.3.0/skill/SKILL.md 及相對 `references/integration.md`、`references/schema.md`。使用真實已驗證圖集驗證方／橫、分類、舊 opt-out 遷移、不同 projectId 偏好不變、遊戲／H8 資訊目標、Enter、新分頁、留白不誤開、管理關閉及 SPA 一份 SDK／一次圖集載入。

大型圖集與 QA 位於 `/Users/chi/My Projects/AI工作區/active-etf-ui-speed-20261017/`。Chromium 桌面與 390px 模擬通過；實體設備與 Safari 未驗。此修改僅為本地源碼與 build，不包含公開部署或廣告政策維護。
