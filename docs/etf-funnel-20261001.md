# ETF 導流修正及驗證紀錄 — 2026-10-01

## 版本、範圍與預覽

ETF 基底 `d8c5d1508a2090d5805d7824261b7bdd84b2851e`，分支 `codex/etf-funnel-followup`；Auth 基底 `a849a9a`，分支 `codex/active-etf-auth-funnel`。兩個專案均使用隔離 worktree，沒有納入原工作目錄未提交的變動，沒有修改 TSFunc。

本次先建立 GitHub PR／預覽及驗證，依使用者先前「先合併部署，注意要上github」授權，按 Auth → ETF 順序發布。沒有操作廣告、预算或關閉副本；NT$100／日是使用者提供的現況，本次未重讀 Meta 後台。此文件取代先前 `ad-visitor-review.md` 的註冊映射與最佳化建議。正式版本與發布後證據另記錄在交付驗證紀錄／PR。

GitHub：[ETF PR #23](https://github.com/windfaller/active-etf/pull/23)、[Auth PR #1](https://github.com/gogowinners/GoGoWinners-Auth/pull/1)。

遠端畫面預覽：[ETF 比較](https://kind-coast-08b07e900-23.eastasia.7.azurestaticapps.net/compare/etfs?type=tw&codes=00981A,00982A)、[Auth 註冊](https://black-desert-0cdbaeb00-1.eastasia.3.azurestaticapps.net/register?locale=zh-TW&redirect=https%3A%2F%2Factive-etf.inthewins.com%2Fcompare%2Fetfs%3Ftype%3Dtw%26codes%3D00981A%2C00982A%26metric%3Dholdings)。Auth 連結只供畫面審閱，不是有效後端 flow，請勿以此作真帳號聯測。最新部署 CI 見各 PR checks；真會員跨預覽驗收需下列配置。

本機畫面預覽：ETF `http://127.0.0.1:4175/compare/etfs?type=tw&codes=00981A,00982A`，Auth `http://127.0.0.1:5177/register`。

## 使用體驗與權限

- 合法预選2–4檔時，自動載入後優先呈現兩檔識別、共同資料日與既有 API 的共同持股／權重重疊。「更換 ETF」收合，原最多四檔、同市場及13F排除規則保留；未預選頁仍可先選股。
- 會員入口分成直接註冊與既有登入。解鎖文案僅描述已實作的主要／共同持股，每檔主要持股 UI 最多八筆，不新增權限或宣稱收藏、通知、買賣建議／收益。
- 解鎖 CTA 保留 `codes` 並先設定 `metric=holdings`，回來後就地取得會員資料。缺口、不同日期、載入與失敗狀態保留，未取得結果不計完成。
- Auth 只有「精確 ETF origin + 中央返回白名單」核准時顯示固定的 ETF 品牌及安全返回入口，不採外部品牌參數。繁中、簡中、英文有新增文案，其餘語言對新增鍵採英文 fallback。
- 畫面驗證採當次正式公開 API：00981A／00982A、共同資料日2026-09-30、18檔共同持股、35.64%權重重疊、覆蓋23/30。這是文件記錄的快照，UI 沒有硬編這些值。

## 安全返回與新會員判定

1. `POST /api/auth/start` 只接受核准 ETF Origin、login/sign_up intent 與白名單研究返回網址。僅保留合法 `type/codes/metric`；有同意才保留 allowlist UTM／點擊ID，移除其他 query 與 hash。
2. 後端產生24小時 flow，使用隨機 HttpOnly／Secure／SameSite=None 綁定 cookie；資料庫僅存其 SHA-256。代理 HTTPS 判斷沿用既有 session 邏輯。
3. Auth 沿用共用 redirect/authAction 儲存，另加獨立 session flow ID／redirect digest。註冊／登入、語言、Email 驗證 continuation、Email link 及社群成功出口保留返回狀態。
4. ETF 流程以表單 POST body 傳 `state`、安全 `returnUrl`、Token 或取消狀態至固定 `/api/auth/callback`，不把 Token 放進網址或分析。舊 ETF bookmark 會返回公開研究並提示重開新流程，也不生成 Token URL；其他產品 legacy callback 保留。
5. ETF 核對 Origin、綁定、有效 flow、Firebase JWT 簽章及受眾，再建立 HttpOnly session。取消、失敗、重複 callback 不新增註冊；失效 flow 只可返回重新白名單化的公開研究，不建 session，並移除來源參數。
6. 後端透過 [Firebase accounts:lookup](https://firebase.google.com/docs/reference/rest/auth#section-get-account-info) 核對同一 uid 的 `createdAt`、disabled 與 Email 驗證。只接受本 flow 啟動後、24小時內建立的新共用帳號。URL `authAction=sign_up` 不具判定權限；既有會員首次使用 ETF 不混入新帳號事件。
7. metadata 未設定／讀取失敗時，登入仍可成功，註冊分類**未核實**，不補造事件。拒絕追蹤不建註冊量測事件，因此事件數不是全部真實新帳號總數。
8. 以帳號／專案 SHA-256 唯一鍵保存一個後端 UUID；瀏覽器一次性 session 回執只含事件名、ID、scope，全帳號只領一次。刷新、重送不另建ID。身份資料不進分析或公開日誌。

回到 ETF 領取回執時會再次核對目前同意；若已拒絕，抑制瀏覽器註冊回執、清除 matching data 並停用該 CAPI 記錄。有同意才以原子更新將 awaiting_consent 改為 pending，避免等待登入期間的舊同意直接發送。
9. 新流程啟動前讀取 Auth `/.well-known/active-etf-auth-flow.json` 的 POST 版本宣告；舊 Auth／網路失敗會拒絕開始，以免回退成 query Token 流程。

正式匿名驗證曾遇到 capability readiness 503；新增防CDN快取的探測、一個有界重試，以及按Auth origin隔離、僅成功宣告的30秒快取。仍驗證version／return_mode／product，不快取失敗，不放寬不明來源。首次503的具體網路／快取原因未核實。

另確認正式Auth的 `Referrer-Policy: same-origin` 使跨網域表單 `Origin: null`，callback正確拒絕403。Auth僅在ETF POST提交時設 `strict-origin`，只傳Auth網域、不含path/query；後端精確Origin、cookie及state驗證維持。[Referrer-Policy 與 Origin](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Referrer-Policy#effect_on_the_origin_header)。

## 事件定義

沿用 GA4 `G-DG02G9VVHY`、Meta Pixel `1811635619849853`。Google 匿名 Consent Mode 與明確拒絕規則保留，Meta 必須同意；沒有新 Pixel 或 OpenAI Ads Pixel。

| GA4／邏輯事件 | 真實觸發 | Meta 瀏覽器／伺服器與去重 |
| --- | --- | --- |
| `page_view` | 初始化一次，SPA 實際改變路徑一次 | Pixel `PageView`；沒有 PageView CAPI |
| `active_etf_preview_loaded` | `/start` 預覽成功且至少兩張卡 | 同名 custom；不是完整比較完成 |
| `active_etf_compare_started` | 明確 CTA、選股、刷新或首次合法直接URL | 同名 custom；每次請求建立 `compare_id`；source=start_primary/comparison_builder/direct_url/refresh |
| `active_etf_compare_complete` | API 成功、所選卡全部有持股／日期、Vue 顯示結果；台灣須同日 | 同名 custom；共用 `compare_id`，開始ID=`<id>:started`，成功ID=`<id>:complete`；30分鐘 session 保存防重整／重繪重送，明確再比較是新請求；無比較CAPI |
| `active_etf_sign_up_started` | 使用者選擇建立帳號 | 同名 custom；只有意圖 |
| `active_etf_sign_up_success` | 後端證實新共用帳號，flow 已同意，取得可信回執 | **同名 custom，trackCustom**；Pixel/CAPI共用後端UUID，scope=shared_account_created；不映射或並送 CompleteRegistration |
| `active_etf_login_intent` | 既有會員選擇登入 | 同名 custom；非成功 |
| `active_etf_login_success` | 新 POST session 回執或舊 callback 經後端驗證 | 同名 custom；無登入CAPI，不能算註冊 |
| `active_etf_login_failed` | 回傳失敗狀態／Token 驗證失敗 | 同名 custom；取消不算失敗或註冊 |
| `active_etf_skill_download_started` | 使用者觸發既有下載請求 | 保留同名 custom；無CAPI，不表示完成安裝 |
| `active_etf_page_click` | SPA 內部導覽 | 僅GA4，沿用先前移除Meta投遞的修正；無假 value/currency |

- `/_measurement/start` 等是刻意去除研究與敏感 query 的 GA4 page_location，不是實際路由或待刪404。研究代碼不進分析，来源限白名單 campaign 值。
- 原 helper 映射 `CompleteRegistration` 與廣告使用的 custom 不一致。本次統一 custom 契約，沒有更換正在投遞的最佳化設定。
- 建議維持 `active_etf_sign_up_success` 名稱，待真會員／平台驗收後確認最佳化有效。比較完成作研究使用指標；不把登入、開始註冊或下載當成功。未來標準事件遷移須另用關閉副本驗證。
- 分開報告邏輯事件數、distinct 使用者數、Meta 歸因註冊數；Browser／Server接收是同一事件。CAPI events_received=1 只代表接受，不证明去重或廣告歸因。

## CAPI 與部署設定

此前已查 ETF／TSFunc 沒有找到這個 Pixel 的 ETF CAPI sender，不表示其他專案或平台零註冊；H8 CompleteRegistration 不屬本次來源。新增 registration outbox、原子lease、最多五次同ID退避重試，每輪最多三筆，只處理七日內待送事件；停用時建立的紀錄不回補。

主站採受管 Functions，依 [Azure HTTP 限制](https://learn.microsoft.com/en-us/azure/static-web-apps/apis-functions) 與 [45秒限制](https://learn.microsoft.com/en-us/azure/static-web-apps/apis-overview)，沿用既有 ADMIN_JOB_TOKEN 的 `POST /api/jobs/registration-meta/send`。GitHub排程每五分鐘但 **vars.ACTIVE_ETF_CAPI_SCHEDULE_ENABLED 預設不啟用**；尚未設定該變數。若使用獨立 Functions timer，還須 ENABLE_TIMER_TRIGGERS=true，主站不得開此開關。HTTP一次最多30秒網路等待，結果只含啟用狀態及計數。

**預設停用**，本次未設定正式憑證或啟用 sender。核准後需 `ACTIVE_ETF_CAPI_ENABLED=true`、受保護 `ACTIVE_ETF_META_ACCESS_TOKEN`、可用 `ACTIVE_ETF_META_API_VERSION`；測試另用 `ACTIVE_ETF_META_TEST_EVENT_CODE`。只用已同意且合法 `_fbp/_fbc` matching，缺少則記 no_matching_data，不捏造 email/IP；來源URL去query，日誌只記計數。

`FIREBASE_WEB_API_KEY` 已設定為 Auth 既有 `gogowinners-380206` 專案的 Web API key，未輸出憑證；正式 CAPI 明確設為 false。真帳號 accounts:lookup 的設定／限制仍待授權測試者驗收，未核實不宣稱零註冊。沿用 MongoDB；flow建TTL，ledger以_id唯一。

## 驗證紀錄

macOS／既有 Playwright Chromium；Browser plugin 不可用。桌面1365×844、390×844、360×844。測試替身不建會員；畫面另讀正式公開API，第三方廣告請求攔截以免污染報表。

| 檢查 | 結果 | 限制 |
| --- | --- | --- |
| ETF Web／Functions build | 通過 | 非正式部署 |
| ETF unit regression | 334通過，4項既有skip | 新舊會員、偽造action、拒絕、取消、失敗、重送、ledger／CAPI、admin job、精確QA配對、舊瀏覽器randomUUID fallback、capability短暫失敗與成功快取均用替身 |
| Auth build／unit | 通過／20項通過 | 含原有其他產品redirect regression及舊ETF無Token返回 |
| Chromium首屏／picker／解鎖 | 8項新漏斗測試及14項既有P1測試通過；三尺寸有產品識別、同日摘要、結果入口及CTA；無溢出、遮擋overlay或pageerror | 非實體WebView；首次測試CSS locator誤用，修正後通過 |
| 比較事件 | begin/complete共用ID；重整／分頁重繪不重送；失敗不完成；預覽另記 | 無平台receipt |
| Auth實際DOM | register→sign-in→en→register→refresh→取消POST通過，codes/metric/QA UTM保留，無pageerror | 中央白名單實際讀取，取消POST攔截；未填帳號欄 |
| 真新／既有Email、社群、驗證後返回 | **待授權測試者** | 代理未輸入個資或自建帳號 |
| Meta真去重／歸因、GA4 DebugView | **未核實** | 同名同ID payload及重試測試通過，未取得平台Browser/Server收據 |
| 實體Chrome／FB／IG瀏覽器 | **待授權測試者** | viewport不等同應用程式內瀏覽器 |
| 跨PR預覽真會員 | **尚未可驗收** | 中央白名單尚無Azure PR origin，須精確設定，不能放寬整個azurestaticapps.net |

390px修正前摘要分頁y=1238、矩陣y=1946；新版核心摘要y=267、底部553。元素不同，證據只说明承諾重點已提早可見。新版結果跳轉與解鎖CTA位於固定導覽上方。

最後一次 Auth 遠端檢查發現初始 lazy route 尚未就緒時，Firebase 匿名 callback 把 `/register` 視為 `/` 並跳到登入。已增加 `router.isReady()` 後再初始化；build、20項測試及匿名切換／返回重新通過，遠端直接註冊另於發布前核對。

2026-10-01 遠端 ETF 預覽版本 `9b0ac2c01c494cba042deb41ff7e80199713d7d6` 的 merge parent 包含來源 `b1e32e22e09086e6fb5272631e4b970f5b0af4b9`。三尺寸頁面200、實際公開API結果可見、無pageerror／溢出、CTA在導覽上方。`POST /api/auth/start` 回503 `auth_post_flow_not_ready`，符合未發布新版正式Auth／未配對QA時的防護，**不是註冊往返通過**。ETF遠端CI [36817464349](https://github.com/windfaller/active-etf/actions/runs/36817464349)成功；最新文件版CI請見PR。

截圖未提交二進位檔，目錄：`/Users/chi/.codex/visualizations/2026/09/29/01a0eb3b-dca1-7c13-9e5a-86fca381dab3/`。修正前 `funnel-before-{compare,auth}-{1365,390,360}.png`；本機修正後 `funnel-after-{compare,picker,unlock,auth}-{1365,390,360}.png`；遠端 `funnel-preview-{compare,picker,unlock,auth}-{1365,390,360}.png`。

## 到站與資料缺口

- 舊227次連外／80次到站缺同期間、時區、歸因窗與HTTP明細。35.2%只是舊數字之比，不能將147次差額視為載入失敗或比較漏斗。Meta、GA4與靜態站伺服器收據仍待對帳。
- 當次公開頁可載入；新比較chunk約14.34kB/gzip5.59kB，Auth vendor約373.53kB/gzip109.46kB。沿用lazy loading，沒有大型圖片／新增SDK，不代表所有網路到站率。
- page_click value/currency歷史診斷仍需Meta樣本；repo已不送這個Meta互動事件，不用假金額消警告。GA4 204是當次請求證據，非歸因。
- 當次共同日期覆蓋23/30，七檔延遲。揭露、假日、抓取及排程的確切原因仍須生產紀錄，未核實。沿用共同日期選擇，未改成今日或補零。

## 待協同、驗收與回復

1. 授權測試者以 `utm_source=qa&utm_medium=validation&utm_campaign=etf_funnel_20261001` 核對真新／既有Email、Email link、驗證信及Google/Facebook返回；測失敗、取消、拒絕、刷新及重複callback，不重放真Token。
2. 中央服務提供精確ETF預覽origin白名單，Auth build用 `VITE_ACTIVE_ETF_QA_ORIGIN`；ETF QA配對精確 `ACTIVE_ETF_AUTH_QA_ORIGIN`、`ACTIVE_ETF_AUTH_QA_AUTH_ORIGIN`，後者只能為已知 Auth SWA 預覽。僅指定的ETF QA來源可開啟QA Auth及callback，正式來源永遠不改道。Firebase維護者另核准Auth精確測試網域／驗證信continue URL及社群設定。生產不設QA override，本次未變更中央或Firebase白名單。
3. 依既有合併部署授權，先部署Auth並確認capability JSON及直接註冊，再部署ETF／核對Firebase lookup設定；Test Events通過且獲准才開CAPI。廣告事件與預算不隨發布改動。
4. Provider證據列同一event_name/event_id的Browser/Server接收、去重、GA4事件數／使用者數，另列平台歸因；現在均為**未核實**，不填零。
5. 回復先設 `ACTIVE_ETF_CAPI_ENABLED=false`、`ACTIVE_ETF_AUTH_STARTS_DISABLED=true`，保留24小時在途callback；前端回復時保留API契約，再回復Auth與API。保留ledger避免重送，不刪資料或撤銷其他會員。

## 修改檔案

- ETF UI/analytics：`src/web/views/{EtfCompareView,StartView}.vue`、`components/MemberLockedResult.vue`、`composables/{useAuth,useEtfComparison}.ts`、`auth/authService.ts`、`analytics.ts`、`consent.ts`。
- ETF API：`src/api/{authFlow,authSession,postEtfAdminJobs}.ts`、`src/services/auth/{authCapability,returnPolicy,firebaseAccount,flowStore,registrationMeta}.ts`、`src/functions/{apiRoutes,registrationMetaWorker}.ts`、`.github/workflows/registration-meta.yml`。
- ETF tests：`tests/api/{authFlow,registrationJob}.test.ts`、`tests/auth/{firebaseAccount,authCapability,returnPolicy,registrationLedger}.test.ts`、`tests/web/analytics.test.ts`、`tests/e2e/{etf-funnel,p1-intelligence}.spec.ts`。
- Auth：`src/App.vue`、`utils/{productFlow,common}.ts`、`views/{Register,SignIn}.vue`、`components/LanguageSwitcher.vue`、`style.css`、`plugins/i18n.ts`、`locales/{zh-TW,zh-CN,en}.json`、capability JSON、`test/product-flow.test.ts`、`docs/active-etf-post-flow.md`。
