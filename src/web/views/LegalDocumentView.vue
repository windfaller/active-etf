<script setup lang="ts">
defineProps<{ kind: "privacy" | "terms" }>();
const updatedAt = "2026 年 9 月 30 日";
</script>

<template>
  <article class="legal-view">
    <header>
      <span>{{ kind === 'privacy' ? 'PRIVACY' : 'TERMS' }}</span>
      <h1>{{ kind === 'privacy' ? '隱私政策' : '服務條款' }}</h1>
      <p>最後更新：{{ updatedAt }}</p>
    </header>

    <section><h2>營運者與聯絡方式 / Publisher and contact</h2><p>ETF 持倉雷達由 IN THE WIN LIMITED（英國公司編號 <a href="https://find-and-update.company-information.service.gov.uk/company/14533535" target="_blank" rel="noopener noreferrer">14533535</a>）提供，客服信箱為 <a href="mailto:service@inthewins.com">service@inthewins.com</a>。ETF Holdings Radar is provided by IN THE WIN LIMITED (UK company no. <a href="https://find-and-update.company-information.service.gov.uk/company/14533535" target="_blank" rel="noopener noreferrer">14533535</a>). For support, email <a href="mailto:service@inthewins.com">service@inthewins.com</a>.</p></section>

    <template v-if="kind === 'privacy'">
      <section><h2>適用範圍</h2><p>本政策適用於 ETF 持倉雷達（active-etf.inthewins.com）。本站整理公開市場與 ETF 資料，並使用 GoGoWinners 共用登入服務驗證會員身分。</p></section>
      <section><h2>會員 MCP 服務 / Member MCP</h2>
        <p>會員授權 AI 用戶端連接 MCP 時，本站處理會員識別碼、已授權用戶端名稱與回呼網址、OAuth 憑證的雜湊值、工具請求、研究結果及每日研究點數，用於身分驗證、資料查詢、配額計算、短期快取與防濫用。本站不保存登入密碼，也不向廣告平台提供 MCP 查詢內容。</p>
        <p>資料由 Azure Functions 處理，MongoDB 保存授權、配額與短期查詢快取；Redis 可能快取公開研究資料。GoGoWinners 提供會員登入；你授權的 AI 用戶端會收到要求取得的研究結果，並依該用戶端的隱私政策處理。</p>
        <p>保留期間依資料類別而異：瀏覽器工作階段與存取憑證最長 1 小時、更新憑證 30 天、短期研究結果快取約 11 分鐘、每日點數紀錄最多 90 天、OAuth 用戶端註冊最多 365 天、安全撤銷標記最多 366 天。到期紀錄由資料庫清理。你可以在會員連接頁撤銷授權、登出，或寄信至 <a href="mailto:service@inthewins.com">service@inthewins.com</a> 請求查詢或刪除本服務範圍內的會員資料。</p>
        <p>For member MCP access, we process a member identifier, authorized client details, hashed OAuth credentials, tool requests, research results, and daily usage to authenticate users, answer requests, enforce quotas, cache results briefly, and prevent abuse. Azure Functions processes requests; MongoDB stores authorization, usage, and short-lived results; Redis may cache public research data. GoGoWinners handles sign-in, and an AI client you authorize receives the requested results. We do not send MCP query content to advertising platforms. Session and access credentials last up to one hour, refresh credentials 30 days, research-result cache about 11 minutes, usage ledgers up to 90 days, client registrations up to 365 days, and security revocation markers up to 366 days. You can revoke access, sign out, or contact the support email above about your data.</p>
      </section>
      <section><h2>必要資料與儲存</h2><p>為提供登入、會員內容與安全控制，本站會使用 HttpOnly 會員工作階段 Cookie；瀏覽器端另保存深色模式及你的追蹤同意選擇。本站不接收或保存你的登入密碼。</p></section>
      <section><h2>進站匿名量測</h2><p>尚未同意完整追蹤時，本站會以 Google Consent Mode denied 傳送無 Cookie 的受限量測，用來統計初始頁面目的地等整體使用狀況，不載入 Meta Pixel。這不代表零資料傳輸：瀏覽器連線仍可能包含時間、裝置與來源頁等一般請求資訊，但本站會將頁面位置轉為分類網址，不傳送實際股票或 ETF 代碼、搜尋字串及會員識別資料。</p></section>
      <section><h2>互動即升級同意</h2><p>當你操作分頁、點擊內容或功能，或進入登入／加入會員流程，即視為同意完整成效分析。Google 的分析與廣告儲存權限會更新為 granted，並開始載入 Meta Pixel；你也可以直接按下「同意完整量測」。傳送事件限於頁面目的地類別、登入生命週期、比較檔數及互動類型，不傳送電子郵件、會員 ID、Token、股票或 ETF 代碼、搜尋字串等識別或投資內容。</p></section>
      <section><h2>Meta 進階配對</h2><p>本站目前未啟用 Meta 進階配對，也不會將共用登入服務中的電子郵件或其他會員識別資料提供給 Meta 進行配對。</p></section>
      <section><h2>第三方服務</h2><p>匿名量測資料由 Google 依其服務設定與隱私政策處理；升級完整追蹤後，相關資料也可能由 Google 或 Meta 處理，並開始載入 Forvix 跨站延伸閱讀。本站亦會連結投信、證交所、SEC、海外 ETF 發行商與 Telegram 等外部服務；離開本站後適用各服務自己的政策。</p></section>
      <section><h2>你的選擇</h2><p>你可以選擇「維持匿名量測」，仍可使用公開資料與會員功能；也可隨時由頁尾「追蹤設定」變更選擇。從完整追蹤改回匿名量測時，本站會將 Google 同意狀態更新為 denied，並重新載入頁面以移除已載入的 Meta Pixel。</p></section>
      <section><h2>會員資料請求</h2><p>會員帳號由 GoGoWinners 共用登入服務管理。需要查詢、更正或刪除會員帳號資料時，請使用該會員服務所提供的聯絡或帳號管理管道；本站會依可驗證的請求協助處理本服務範圍內的資料。</p></section>
    </template>

    <template v-else>
      <section><h2>服務性質</h2><p>ETF 持倉雷達整理公開資訊並提供可重現的資料比較、研究摘要與方法說明。所有內容僅供資訊研究，不構成投資建議、招攬、報價或任何保證。</p></section>
      <section><h2>會員 MCP 使用</h2><p>MCP 只提供已收錄 ETF 的唯讀研究資料，需完成會員授權並遵守每日研究點數與合理使用限制；不提供交易執行或個人化投資建議。</p></section>
      <section><h2>資料限制</h2><p>ETF、投信、證交所、SEC 與發行商資料可能有公告時差、缺值、修正或來源中斷。本站會揭露資料日期、涵蓋率與已知限制，但不保證資料即時、完整或適合特定目的。</p></section>
      <section><h2>會員與帳號</h2><p>會員登入由 GoGoWinners 共用登入服務提供。你應妥善保護登入方式，不得冒用他人身分、繞過會員限制、自動化大量擷取、干擾服務或嘗試存取未授權資料。</p></section>
      <section><h2>成效量測</h2><p>進站會先使用無 Cookie 的受限匿名量測；操作分頁、點擊內容或功能，或進入登入／加入會員流程，即依隱私政策視為同意完整成效分析。你可以隨時由頁尾「追蹤設定」調整選擇。</p></section>
      <section><h2>使用責任</h2><p>任何投資或交易決策均由使用者自行判斷並承擔風險。本站的拉推、共識、加減碼、產業或績效資訊描述歷史或公開資料，不代表未來報酬。</p></section>
      <section><h2>智慧財產與外部連結</h2><p>原始公開資料仍依各來源規範；本站的介面、整理方式、程式與文字說明受相關權利保護。外部連結僅供查核來源或使用第三方服務，不代表本站控制或保證其內容。</p></section>
      <section><h2>服務調整</h2><p>本站可能因來源、法規、安全或產品需求調整功能與條款。重大變更會更新本頁日期；繼續使用服務前請重新確認最新內容。</p></section>
    </template>
  </article>
</template>

<style scoped>
.legal-view{display:grid;gap:12px;max-width:920px;width:100%;margin:0 auto;color:var(--theme-text)}.legal-view header{padding:28px;border-radius:15px;background:linear-gradient(135deg,#17364c,#0c6b65);color:#fff}.legal-view header span{color:#72e0d6;font-size:11px;font-weight:850;letter-spacing:.14em}.legal-view h1{margin:8px 0 4px;font-size:34px}.legal-view header p{margin:0;color:#d9e8ea}.legal-view section{padding:20px;border:1px solid var(--theme-border);border-radius:12px;background:var(--theme-surface)}.legal-view h2{margin:0 0 8px;color:var(--theme-text-strong);font-size:18px}.legal-view section p{margin:0;color:var(--theme-text-muted);line-height:1.8}.legal-view section p+p{margin-top:12px}.legal-view section a{color:var(--theme-negative);text-decoration:underline;text-underline-offset:2px}
@media(max-width:760px){.legal-view header{padding:22px}.legal-view h1{font-size:28px}.legal-view section{padding:17px}}
</style>
