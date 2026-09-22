export const agentLocales = ["en", "zh-TW", "zh-CN", "ja", "ko"] as const;
export type AgentLocale = (typeof agentLocales)[number];
export const localeNames: Record<AgentLocale, string> = {
  en: "English",
  "zh-TW": "繁體中文",
  "zh-CN": "简体中文",
  ja: "日本語",
  ko: "한국어",
};
export function agentLocale(value: string | null | undefined): AgentLocale {
  return agentLocales.includes(value as AgentLocale)
    ? (value as AgentLocale)
    : "zh-TW";
}
const en = {
  brand: "ETF Holdings Radar",
  home: "Market website",
  overview: "Member MCP",
  skill: "Skill guide",
  account: "Connections & usage",
  language: "Language",
  title: "Your ETF research. In your AI.",
  intro:
    "Connect your AI to sourced ETF holdings, portfolio changes and comparisons. Free membership. No credit card.",
  scope:
    "The first release covers supported Taiwan-listed ETFs, including Taiwan-listed funds investing overseas. It does not yet cover US-listed ETFs or 13F portfolios.",
  daily: "Research points / day",
  history: "Days of holding changes",
  compare: "ETFs per comparison",
  start: "Set up your connection",
  guide: "Read the Skill guide",
  tools: "Research tools",
  tool: "Tool",
  cost: "Points",
  search: "Find an ETF",
  snapshot: "Complete latest holdings",
  changes: "Recent holding changes",
  comparison: "Compare ETF holdings",
  stock: "Stock ownership across ETFs",
  brief: "Daily research brief",
  usage: "Your remaining points",
  quotaTitle: "Enough room to explore every day",
  quota:
    "20 points reset at 00:00 Asia/Taipei. All connected clients share one balance. Unused points do not roll over. Website browsing does not spend MCP points.",
  example:
    "A daily brief (3), two comparisons (4), and three stock lookups (6) use 13 points. You still have 7 points left.",
  fair: "Failed or empty queries do not consume points. Repeating the same query within 10 minutes returns the same cached snapshot without charging again. Maximum 20 calls per minute and 2 concurrent queries.",
  platforms: "Connect your preferred AI",
  chatgpt:
    "In ChatGPT, use the available developer/custom connector interface, add the MCP URL and choose OAuth. Availability depends on your account and workspace. This service is not yet listed in the public directory.",
  grok: "In Grok, open Connectors → New Connector → Custom, paste the MCP URL, and complete authorization. This adds your own connector; it is not a public catalog listing.",
  endpoint: "MCP server URL",
    testEndpoint: "MCP URL · beta validation",
  copy: "Copy",
  copied: "Copied",
  copyError: "Copy failed. Select and copy the text manually.",
  unavailable:
    "The MCP endpoint is not configured for this website yet. The guide and Skill download remain available.",
  skillTitle: "A repeatable research workflow",
  skillIntro:
    "The Skill helps your AI choose the right tools, check dates, and turn observations into a clear research note. MCP provides the data; the Skill provides the workflow.",
  download: "Download SKILL.md",
  install: "Install the Skill",
  installText:
    "Download the file and save it as active-etf-research/SKILL.md in a skill directory supported by your AI client. Connect the MCP server separately. A Skill file alone does not sign you in or grant data access.",
  installChat:
    "For ChatGPT, use its supported Skill/plugin installation workflow if available on your account. Adding a custom MCP connector does not automatically install this Skill. You can still use the research prompts below with MCP alone.",
  installGrok:
    "For Grok Build, save the folder under ~/.grok/skills/. The Grok chat website uses the MCP connector; do not assume it imports local Skill files.",
  workflow: "How the Skill works",
  step1: "Identify the ETF or stock and the observation period.",
  step2:
    "Use the smallest set of tools that answers the question. Prefer a single comparison or brief over repeated snapshots.",
  step3:
    "Check source dates, missing observations and differences between raw and scale-adjusted changes.",
  step4:
    "Present facts, uncertainty and source links in your language. Never turn missing data into zero or promise a return.",
  prompts: "Try asking",
  prompt1:
    "Compare 00981A and 00991A: shared holdings, different exposures, and source dates.",
  prompt2:
    "Summarize the last 7 days of holding changes for 00981A. Separate raw changes from scale-adjusted changes.",
  prompt3:
    "Which tracked ETFs hold 2330? Show their source dates and recent observed changes.",
  limits: "What this service does not do",
  limitsText:
    "No trading, personalized buy/sell instructions or advertising. A data date is not a real-time quote. Company and fund names remain in their source language.",
  signIn: "Sign in as a free member",
  signOut: "Sign out",
  loading: "Loading…",
  retry: "Retry",
  balance: "Available today",
  reset: "Next reset",
  revoke: "Revoke all AI connections",
  revoked:
    "All AI connections have been revoked. Reconnect in your AI client to grant access again.",
  consentTitle: "Authorize read-only research",
  consentText:
    "This client can query ETF research data and your research-point balance. It cannot trade, access your payment details, or modify your watchlists.",
  client: "Requesting client",
  destination: "Return destination",
  allow: "Authorize",
  deny: "Cancel",
  done: "Connection management",
  loginNotice:
    "Sign in to review and approve this connection. Your AI client receives an access token, not your website login token.",
  error: "Something went wrong. Please retry.",
  expired:
    "This authorization request has expired. Start the connection again from your AI client.",
  restricted:
    "This account is not enabled for the current invitation-only test.",
  signedOut: "Sign in to view your usage and manage connections.",
  disclaimer:
    "Public-source research data. Not personalized investment advice.",
  privacy: "Privacy",
  terms: "Terms",
  back: "Back to overview",
  points: "points",
  privacyNote:
    "The gateway stores a member identifier, authorized clients, hashed credentials and usage counts. Query-result caching lasts 10 minutes; usage totals are retained for up to 90 days. Raw chat conversations are not requested.",
  platformCosts:
    "Our research allowance is free. Your AI platform may have separate subscription or API charges.",
  notLive:
    "Connection testing is in progress. Public directory approval is not claimed.",
};
export type AgentCopy = { [K in keyof typeof en]: string };
export const agentCopy: Record<AgentLocale, AgentCopy> = {
  en,
  "zh-TW": {
    brand: "ETF 持倉雷達",
    home: "市場網站",
    overview: "會員 MCP",
    skill: "Skill 說明",
    account: "連接與用量",
    language: "語言",
    title: "在你的 AI 裡，完成 ETF 研究。",
    intro:
      "連接有來源的 ETF 持股、調倉與比較資料。免費會員即可使用，不需信用卡。",
    scope:
      "首版支援已收錄的台灣掛牌 ETF，包含投資海外的台灣掛牌基金；尚不包含美國掛牌 ETF 與 13F 機構資料。",
    daily: "每日研究點",
    history: "日持股變化",
    compare: "檔 ETF 同時比較",
    start: "設定連接",
    guide: "閱讀 Skill 說明",
    tools: "研究工具",
    tool: "功能",
    cost: "點數",
    search: "搜尋 ETF",
    snapshot: "最新完整持股",
    changes: "近期持股變化",
    comparison: "ETF 持股比較",
    stock: "個股跨 ETF 持有脈絡",
    brief: "每日研究簡報",
    usage: "查詢剩餘額度",
    quotaTitle: "每天都能完成一輪研究",
    quota:
      "每日 20 點，台北時間 00:00 重置。所有 AI 連接共用同一份額度，未用完不累積；瀏覽網站不扣 MCP 點數。",
    example:
      "一份每日簡報（3 點）、兩次比較（4 點）、三次個股查詢（6 點），共 13 點，還有 7 點可以繼續探索。",
    fair: "失敗或查無資料不扣點。10 分鐘內重複相同查詢會回傳同一份快取快照，不重複扣點。每分鐘最多 20 次呼叫，同時最多 2 次查詢。",
    platforms: "連接慣用的 AI",
    chatgpt:
      "在 ChatGPT 可用的開發者／自訂連接介面新增 MCP 網址，選擇 OAuth 並完成授權。可用性依帳號及工作區而異；目前尚未列入公開目錄。",
    grok: "在 Grok 開啟 Connectors → New Connector → Custom，貼上 MCP 網址並完成授權。這是個人自訂連接，不代表已上架公開目錄。",
    endpoint: "MCP 伺服器網址",
    testEndpoint: "MCP 網址・測試驗證中",
    copy: "複製",
    copied: "已複製",
    copyError: "複製失敗，請選取文字後手動複製。",
    unavailable: "此網站尚未設定 MCP 連接網址；仍可閱讀說明與下載 Skill。",
    skillTitle: "讓每次研究都有依據",
    skillIntro:
      "Skill 引導 AI 選擇工具、核對資料日期，並整理成清楚的研究摘要。MCP 提供資料，Skill 提供研究流程。",
    download: "下載 SKILL.md",
    install: "安裝 Skill",
    installText:
      "下載檔案，存為 active-etf-research/SKILL.md，放入你的 AI 支援的 Skill 目錄，再另外連接 MCP。只有 Skill 檔案不會自動登入或取得資料權限。",
    installChat:
      "ChatGPT 請使用帳號目前支援的 Skill／Plugin 安裝流程。新增自訂 MCP 不會自動安裝本 Skill；也可以只接 MCP，使用下方範例提問。",
    installGrok:
      "Grok Build 可將資料夾放在 ~/.grok/skills/。Grok 聊天網頁使用 MCP 連接，不應假設它會載入電腦上的 Skill 檔案。",
    workflow: "Skill 如何運作",
    step1: "確認 ETF 或個股代碼，以及觀察期間。",
    step2: "用能回答問題的最少工具，優先使用一次比較或簡報，避免重複查快照。",
    step3: "核對来源日期、資料缺口，以及表面變化與規模校正後變化的差異。",
    step4:
      "用你的語言呈現事實、不確定性與來源連結，不把缺值當零，也不承諾報酬。",
    prompts: "試著這樣問",
    prompt1: "比較 00981A 和 00991A 的共同持股、配置差異，並列出資料日期。",
    prompt2: "整理 00981A 最近 7 天持股變化，區分表面變化與規模校正後變化。",
    prompt3:
      "目前追蹤的 ETF 中，哪些持有 2330？列出資料日期與近期觀察到的變化。",
    limits: "服務範圍",
    limitsText:
      "不提供交易、個人化買賣指示或廣告。資料日期不等於即時報價；公司與基金名稱保留來源語言。",
    signIn: "免費會員登入",
    signOut: "登出",
    loading: "載入中…",
    retry: "重試",
    balance: "今日可用",
    reset: "下次重置",
    revoke: "撤銷所有 AI 連接",
    revoked: "所有 AI 連接已撤銷。需要使用時，請從 AI 平台重新連接授權。",
    consentTitle: "授權唯讀研究",
    consentText:
      "此用戶端可查詢 ETF 研究資料與你的研究點數，不能交易、存取付款資料或修改觀察清單。",
    client: "要求授權的用戶端",
    destination: "授權後返回位置",
    allow: "同意授權",
    deny: "取消",
    done: "連接管理",
    loginNotice:
      "請先登入，再檢視並同意連接。AI 用戶端取得的是存取權杖，不是你的網站登入權杖。",
    error: "發生錯誤，請重試。",
    expired: "授權要求已過期，請從 AI 平台重新開始連接。",
    restricted: "此帳號尚未加入目前的邀請測試。",
    signedOut: "登入後即可查看用量與管理連接。",
    disclaimer: "依公開來源整理，僅供研究，不構成個人化投資建議。",
    privacy: "隱私政策",
    terms: "服務條款",
    back: "回到介紹",
    points: "點",
    privacyNote:
      "服務儲存會員識別、授權用戶端、雜湊憑證與用量。查詢結果快取 10 分鐘，用量總計最多保留 90 天；不要求取得完整聊天對話。",
    platformCosts: "本站研究額度免費；AI 平台的訂閱或 API 可能另有費用。",
    notLive: "連接測試進行中，目前未宣稱通過公開目錄審核。",
  },
  "zh-CN": {
    brand: "ETF 持仓雷达",
    home: "市场网站",
    overview: "会员 MCP",
    skill: "Skill 说明",
    account: "连接与用量",
    language: "语言",
    title: "在你的 AI 中，完成 ETF 研究。",
    intro:
      "连接有来源的 ETF 持仓、调仓与比较数据。免费会员即可使用，无需信用卡。",
    scope:
      "首版支持已收录的台湾上市 ETF，包括投资海外的台湾上市基金；暂不包含美国上市 ETF 和 13F 机构数据。",
    daily: "每日研究点",
    history: "天持仓变化",
    compare: "只 ETF 同时比较",
    start: "设置连接",
    guide: "阅读 Skill 说明",
    tools: "研究工具",
    tool: "功能",
    cost: "点数",
    search: "搜索 ETF",
    snapshot: "最新完整持仓",
    changes: "近期持仓变化",
    comparison: "ETF 持仓比较",
    stock: "个股跨 ETF 持有情况",
    brief: "每日研究简报",
    usage: "查询剩余额度",
    quotaTitle: "每天都能完成一轮研究",
    quota:
      "每日 20 点，台北时间 00:00 重置。所有 AI 连接共用同一份额度，未用完不累积；浏览网站不扣 MCP 点数。",
    example:
      "一份每日简报（3 点）、两次比较（4 点）、三次个股查询（6 点），共 13 点，还剩 7 点。",
    fair: "失败或无数据不扣点。10 分钟内重复相同查询会返回同一份缓存快照，不重复扣点。每分钟最多 20 次调用，同时最多 2 次查询。",
    platforms: "连接常用的 AI",
    chatgpt:
      "在 ChatGPT 可用的开发者／自定义连接界面添加 MCP 地址，选择 OAuth 并授权。可用性取决于账号及工作区；目前尚未列入公开目录。",
    grok: "在 Grok 打开 Connectors → New Connector → Custom，粘贴 MCP 地址并授权。这是个人自定义连接，不代表已上架公开目录。",
    endpoint: "MCP 服务器地址",
    testEndpoint: "MCP 地址・测试验证中",
    copy: "复制",
    copied: "已复制",
    copyError: "复制失败，请选中文字后手动复制。",
    unavailable: "此网站尚未配置 MCP 连接地址；仍可阅读说明与下载 Skill。",
    skillTitle: "让每次研究都有依据",
    skillIntro:
      "Skill 引导 AI 选择工具、核对数据日期，并整理清晰的研究摘要。MCP 提供数据，Skill 提供研究流程。",
    download: "下载 SKILL.md",
    install: "安装 Skill",
    installText:
      "下载文件，保存为 active-etf-research/SKILL.md，放入 AI 支持的 Skill 目录，再单独连接 MCP。Skill 文件不会自动登录或授予数据权限。",
    installChat:
      "ChatGPT 请使用账号支持的 Skill／Plugin 安装流程。添加自定义 MCP 不会自动安装本 Skill；也可以只连接 MCP，使用下方示例提问。",
    installGrok:
      "Grok Build 可将文件夹放入 ~/.grok/skills/。Grok 聊天网页使用 MCP 连接，不应假设它会加载电脑上的 Skill 文件。",
    workflow: "Skill 如何工作",
    step1: "确认 ETF 或个股代码，以及观察期间。",
    step2: "使用能回答问题的最少工具，优先一次比较或简报，避免重复查询快照。",
    step3: "核对来源日期、数据缺口，以及表面变化与规模调整后变化的差异。",
    step4:
      "用你的语言呈现事实、不确定性与来源链接，不把缺失值当成零，也不承诺收益。",
    prompts: "试着这样问",
    prompt1: "比较 00981A 和 00991A 的共同持仓、配置差异，并列出数据日期。",
    prompt2: "整理 00981A 最近 7 天持仓变化，区分表面变化与规模调整后变化。",
    prompt3:
      "目前跟踪的 ETF 中，哪些持有 2330？列出数据日期与近期观察到的变化。",
    limits: "服务范围",
    limitsText:
      "不提供交易、个性化买卖指令或广告。数据日期不等于实时报价；公司与基金名称保留来源语言。",
    signIn: "免费会员登录",
    signOut: "退出登录",
    loading: "加载中…",
    retry: "重试",
    balance: "今日可用",
    reset: "下次重置",
    revoke: "撤销所有 AI 连接",
    revoked: "所有 AI 连接已撤销。如需使用，请从 AI 平台重新连接授权。",
    consentTitle: "授权只读研究",
    consentText:
      "此客户端可查询 ETF 研究数据与你的研究点数，不能交易、访问付款数据或修改观察列表。",
    client: "请求授权的客户端",
    destination: "授权后返回地址",
    allow: "同意授权",
    deny: "取消",
    done: "连接管理",
    loginNotice:
      "请先登录，再查看并同意连接。AI 客户端获得的是访问令牌，而非网站登录令牌。",
    error: "发生错误，请重试。",
    expired: "授权请求已过期，请从 AI 平台重新开始连接。",
    restricted: "此账号尚未加入当前邀请测试。",
    signedOut: "登录后即可查看用量与管理连接。",
    disclaimer: "根据公开来源整理，仅供研究，不构成个性化投资建议。",
    privacy: "隐私政策",
    terms: "服务条款",
    back: "返回介绍",
    points: "点",
    privacyNote:
      "服务存储会员标识、授权客户端、哈希凭证与用量。查询结果缓存 10 分钟，用量总计最多保留 90 天；不要求获取完整聊天记录。",
    platformCosts: "本站研究额度免费；AI 平台订阅或 API 可能另行收费。",
    notLive: "连接测试进行中，目前未宣称通过公开目录审核。",
  },
  ja: {
    brand: "ETF 保有銘柄レーダー",
    home: "市場サイト",
    overview: "会員 MCP",
    skill: "Skill ガイド",
    account: "接続と利用状況",
    language: "言語",
    title: "いつもの AI で、ETF を調べる。",
    intro:
      "出典付きの保有銘柄、保有変動、ETF 比較データに接続。会員登録で無料利用。クレジットカードは不要です。",
    scope:
      "初版は収録済みの台湾上場 ETF が対象です。海外に投資する台湾上場ファンドも含みます。米国上場 ETF と 13F はまだ対象外です。",
    daily: "1 日のリサーチポイント",
    history: "日間の保有変動",
    compare: "同時比較できる ETF",
    start: "接続を設定",
    guide: "Skill ガイドを読む",
    tools: "リサーチツール",
    tool: "機能",
    cost: "ポイント",
    search: "ETF を検索",
    snapshot: "最新の全保有銘柄",
    changes: "最近の保有変動",
    comparison: "ETF の保有銘柄を比較",
    stock: "銘柄を保有する ETF",
    brief: "デイリーリサーチ",
    usage: "残りポイントを確認",
    quotaTitle: "毎日、ひと通り調べられる枠を",
    quota:
      "毎日 20 ポイント。台北時間 00:00 にリセットされます。全 AI 接続で共通の残高を使用し、繰り越しはありません。サイト閲覧では消費しません。",
    example:
      "デイリーリサーチ 1 回（3）、比較 2 回（4）、個別銘柄の照会 3 回（6）で計 13 ポイント。あと 7 ポイント使えます。",
    fair: "エラーやデータなしの場合は消費しません。同じ照会を 10 分以内に繰り返すと同じキャッシュ結果を返し、再度消費しません。毎分 20 回、同時 2 件まで。",
    platforms: "使いたい AI に接続",
    chatgpt:
      "ChatGPT の利用可能な開発者／カスタム接続画面で MCP URL を追加し、OAuth を選んで認可します。アカウントやワークスペースによって利用可否が異なります。公開ディレクトリには未掲載です。",
    grok: "Grok の Connectors → New Connector → Custom で MCP URL を貼り付け、認可を完了します。これは個人のカスタム接続であり、公開カタログへの掲載ではありません。",
    endpoint: "MCP サーバー URL",
    testEndpoint: "MCP URL・ベータ検証中",
    copy: "コピー",
    copied: "コピーしました",
    copyError: "コピーできませんでした。テキストを選択してコピーしてください。",
    unavailable:
      "このサイトには MCP 接続先がまだ設定されていません。ガイドの閲覧と Skill のダウンロードは利用できます。",
    skillTitle: "根拠を確認するリサーチ手順",
    skillIntro:
      "Skill は AI にツールの選択、データ日付の確認、調査結果の整理を案内します。MCP がデータを、Skill が手順を提供します。",
    download: "SKILL.md をダウンロード",
    install: "Skill をインストール",
    installText:
      "ファイルを active-etf-research/SKILL.md として保存し、AI が対応する Skill ディレクトリに配置してください。MCP は別途接続します。Skill だけではログインやデータアクセスはできません。",
    installChat:
      "ChatGPT ではアカウントが対応する Skill／Plugin のインストール手順を利用してください。カスタム MCP の追加だけでは Skill は入りません。MCP と下記の質問例だけでも利用できます。",
    installGrok:
      "Grok Build ではフォルダーを ~/.grok/skills/ に配置できます。Grok のチャットサイトは MCP 接続を使い、ローカルの Skill が自動で読み込まれるわけではありません。",
    workflow: "Skill の使い方",
    step1: "ETF・銘柄コードと観察期間を確認します。",
    step2:
      "必要最小限のツールを使います。個別の保有情報を何度も取得するより、比較やリサーチ要約を優先します。",
    step3:
      "出典の日付、欠測、実際の保有変動とファンド規模調整後の変動を確認します。",
    step4:
      "利用者の言語で事実、不確実性、出典を示します。欠測をゼロに置き換えず、収益を約束しません。",
    prompts: "質問してみましょう",
    prompt1:
      "00981A と 00991A の共通保有銘柄、配分の違い、データ日付を比較してください。",
    prompt2:
      "00981A の直近 7 日間の保有変動を、実際の変動と規模調整後の変動に分けて整理してください。",
    prompt3:
      "追跡中の ETF のうち、2330 を保有するものは？データ日付と最近の変動を示してください。",
    limits: "サービスの範囲",
    limitsText:
      "取引、個別の売買指示、広告は提供しません。データ日付はリアルタイム価格ではありません。会社名・ファンド名は原語を保持します。",
    signIn: "無料会員としてログイン",
    signOut: "ログアウト",
    loading: "読み込み中…",
    retry: "再試行",
    balance: "本日の残り",
    reset: "次回リセット",
    revoke: "すべての AI 接続を解除",
    revoked:
      "すべての AI 接続を解除しました。再利用するには AI 側から接続して認可してください。",
    consentTitle: "読み取り専用リサーチを認可",
    consentText:
      "このクライアントは ETF データとポイント残高を照会できます。取引、支払い情報へのアクセス、ウォッチリストの変更はできません。",
    client: "要求元クライアント",
    destination: "認可後の戻り先",
    allow: "認可する",
    deny: "キャンセル",
    done: "接続管理",
    loginNotice:
      "ログインして接続内容を確認・認可してください。AI にはアクセストークンが渡り、サイトのログイントークンは渡りません。",
    error: "エラーが発生しました。再試行してください。",
    expired:
      "認可リクエストの有効期限が切れました。AI 側から接続をやり直してください。",
    restricted: "このアカウントは現在の招待テストに登録されていません。",
    signedOut: "ログインして利用状況と接続を管理できます。",
    disclaimer:
      "公開情報に基づくリサーチデータです。個別の投資助言ではありません。",
    privacy: "プライバシー",
    terms: "利用規約",
    back: "概要に戻る",
    points: "ポイント",
    privacyNote:
      "会員識別子、認可クライアント、ハッシュ化した認証情報、利用数を保存します。結果のキャッシュは 10 分、利用集計は最大 90 日です。会話全文は要求しません。",
    platformCosts:
      "当サービスのリサーチ枠は無料です。AI プラットフォームの利用料や API 料金は別途発生する場合があります。",
    notLive: "接続テスト中です。公開ディレクトリの承認取得を意味しません。",
  },
  ko: {
    brand: "ETF 보유종목 레이더",
    home: "시장 웹사이트",
    overview: "회원 MCP",
    skill: "Skill 안내",
    account: "연결 및 사용량",
    language: "언어",
    title: "사용하던 AI에서 ETF를 살펴보세요.",
    intro:
      "출처가 있는 ETF 보유종목, 보유 변동 및 비교 데이터에 연결하세요. 무료 회원으로 이용하며 신용카드는 필요하지 않습니다.",
    scope:
      "첫 버전은 등록된 대만 상장 ETF를 지원합니다. 해외에 투자하는 대만 상장 펀드도 포함하며, 미국 상장 ETF와 13F는 아직 지원하지 않습니다.",
    daily: "일일 리서치 포인트",
    history: "일간 보유 변동",
    compare: "동시 비교 ETF 수",
    start: "연결 설정",
    guide: "Skill 안내 읽기",
    tools: "리서치 도구",
    tool: "기능",
    cost: "포인트",
    search: "ETF 검색",
    snapshot: "최신 전체 보유종목",
    changes: "최근 보유 변동",
    comparison: "ETF 보유종목 비교",
    stock: "종목을 보유한 ETF",
    brief: "일일 리서치 요약",
    usage: "남은 포인트 확인",
    quotaTitle: "매일 충분히 살펴볼 수 있도록",
    quota:
      "매일 20포인트가 타이베이 시간 00:00에 초기화됩니다. 모든 AI 연결이 잔액을 공유하며 이월되지 않습니다. 웹사이트 탐색에는 MCP 포인트가 차감되지 않습니다.",
    example:
      "일일 요약 1회(3), 비교 2회(4), 종목 조회 3회(6)는 총 13포인트입니다. 7포인트가 남습니다.",
    fair: "오류 또는 데이터가 없는 조회는 차감하지 않습니다. 10분 이내 동일 조회는 같은 캐시 결과를 반환하고 다시 차감하지 않습니다. 분당 최대 20회, 동시 조회 2건까지 가능합니다.",
    platforms: "선호하는 AI 연결",
    chatgpt:
      "ChatGPT에서 제공되는 개발자／사용자 지정 연결 화면에 MCP URL을 추가하고 OAuth를 선택해 승인하세요. 계정 및 워크스페이스에 따라 지원 여부가 다릅니다. 공개 디렉터리에는 아직 등록되지 않았습니다.",
    grok: "Grok의 Connectors → New Connector → Custom에서 MCP URL을 붙여 넣고 승인하세요. 개인 사용자 지정 연결이며 공개 카탈로그 등록을 뜻하지 않습니다.",
    endpoint: "MCP 서버 URL",
    testEndpoint: "MCP URL · 베타 검증 중",
    copy: "복사",
    copied: "복사됨",
    copyError: "복사하지 못했습니다. 텍스트를 선택해 직접 복사하세요.",
    unavailable:
      "이 웹사이트에 MCP 연결 주소가 아직 설정되지 않았습니다. 안내 열람과 Skill 다운로드는 가능합니다.",
    skillTitle: "근거를 확인하는 리서치 흐름",
    skillIntro:
      "Skill은 AI가 도구를 선택하고 데이터 날짜를 확인하며 조사 결과를 정리하도록 안내합니다. MCP는 데이터를, Skill은 작업 흐름을 제공합니다.",
    download: "SKILL.md 다운로드",
    install: "Skill 설치",
    installText:
      "파일을 active-etf-research/SKILL.md로 저장하고 AI에서 지원하는 Skill 폴더에 넣으세요. MCP는 별도로 연결해야 합니다. Skill 파일만으로 로그인하거나 데이터 권한을 얻을 수 없습니다.",
    installChat:
      "ChatGPT에서는 계정이 지원하는 Skill／Plugin 설치 절차를 이용하세요. 사용자 지정 MCP 추가만으로 Skill이 설치되지는 않습니다. MCP와 아래 질문 예시만으로도 사용할 수 있습니다.",
    installGrok:
      "Grok Build에서는 폴더를 ~/.grok/skills/ 아래에 저장하세요. Grok 채팅 웹사이트는 MCP 연결을 사용하며 로컬 Skill 파일을 자동으로 불러온다고 가정하면 안 됩니다.",
    workflow: "Skill 작동 방식",
    step1: "ETF 또는 종목 코드와 관찰 기간을 확인합니다.",
    step2:
      "질문에 답하는 최소한의 도구를 사용합니다. 반복 조회보다 한 번의 비교나 요약을 우선합니다.",
    step3:
      "출처 날짜, 누락 데이터, 단순 보유 변동과 펀드 규모 조정 후 변동을 확인합니다.",
    step4:
      "사용자의 언어로 사실, 불확실성 및 출처를 제시합니다. 누락값을 0으로 바꾸거나 수익을 약속하지 않습니다.",
    prompts: "이렇게 질문해 보세요",
    prompt1:
      "00981A와 00991A의 공통 보유종목, 편입 비중 차이 및 데이터 날짜를 비교해 주세요.",
    prompt2:
      "00981A의 최근 7일 보유 변동을 단순 변동과 펀드 규모 조정 후 변동으로 구분해 정리해 주세요.",
    prompt3:
      "추적 중인 ETF 가운데 2330을 보유한 ETF는 무엇인가요? 데이터 날짜와 최근 관찰된 변동을 보여 주세요.",
    limits: "서비스 범위",
    limitsText:
      "거래, 개인별 매매 지시 또는 광고를 제공하지 않습니다. 데이터 날짜는 실시간 시세를 뜻하지 않습니다. 회사 및 펀드 이름은 원어로 유지합니다.",
    signIn: "무료 회원 로그인",
    signOut: "로그아웃",
    loading: "불러오는 중…",
    retry: "다시 시도",
    balance: "오늘 남은 포인트",
    reset: "다음 초기화",
    revoke: "모든 AI 연결 해제",
    revoked:
      "모든 AI 연결이 해제되었습니다. 다시 사용하려면 AI 플랫폼에서 연결하고 승인하세요.",
    consentTitle: "읽기 전용 리서치 승인",
    consentText:
      "이 클라이언트는 ETF 데이터와 포인트 잔액을 조회할 수 있습니다. 거래, 결제 정보 접근 및 관심 목록 수정은 할 수 없습니다.",
    client: "요청 클라이언트",
    destination: "승인 후 돌아갈 주소",
    allow: "승인",
    deny: "취소",
    done: "연결 관리",
    loginNotice:
      "로그인 후 연결 내용을 확인하고 승인하세요. AI에는 액세스 토큰이 전달되며 웹사이트 로그인 토큰은 전달되지 않습니다.",
    error: "오류가 발생했습니다. 다시 시도하세요.",
    expired:
      "승인 요청이 만료되었습니다. AI 플랫폼에서 연결을 다시 시작하세요.",
    restricted: "이 계정은 현재 초대 테스트에 등록되지 않았습니다.",
    signedOut: "로그인하면 사용량과 연결을 관리할 수 있습니다.",
    disclaimer: "공개 출처 기반 리서치 데이터이며 개인별 투자 조언이 아닙니다.",
    privacy: "개인정보",
    terms: "이용약관",
    back: "소개로 돌아가기",
    points: "포인트",
    privacyNote:
      "회원 식별자, 승인 클라이언트, 해시 처리된 인증 정보 및 사용량을 저장합니다. 결과 캐시는 10분, 사용량 합계는 최대 90일 보관합니다. 전체 대화 기록은 요청하지 않습니다.",
    platformCosts:
      "리서치 이용 한도는 무료입니다. AI 플랫폼 구독료 또는 API 요금은 별도일 수 있습니다.",
    notLive:
      "연결 테스트 중입니다. 공개 디렉터리 승인을 받았다는 의미는 아닙니다.",
  },
};
export const agentToolRows = [
  ["search_market_entities", "search", 0],
  ["get_etf_snapshot", "snapshot", 1],
  ["get_etf_changes", "changes", 1],
  ["compare_etfs", "comparison", 2],
  ["get_stock_context", "stock", 2],
  ["build_research_brief", "brief", 3],
  ["get_my_plan_usage", "usage", 0],
] as const;
export function skillMarkdown(locale: AgentLocale): string {
  const t = agentCopy[locale];
  return `---\nname: active-etf-research\ndescription: Research supported Taiwan-listed ETF holdings, portfolio changes, overlap, and stock ownership through the Active ETF member MCP. Use for factual ETF research and comparisons.\n---\n\n# ${t.skillTitle}\n\n${t.skillIntro}\n\n${t.scope}\n\n${t.endpoint}: https://active-etf-mcp.inthewins.com/api/mcp\n${t.account}: https://active-etf-mcp.inthewins.com/${locale}/mcp/connect\n\n## ${t.workflow}\n\n1. ${t.step1}\n2. ${t.step2}\n3. ${t.step3}\n4. ${t.step4}\n\n## ${t.tools}\n\n${agentToolRows.map(([name, label, cost]) => `- \`${name}\`: ${t[label]} (${cost} ${t.points}).`).join("\n")}\n\n${t.quota}\n${t.fair}\n\nTool arguments: search_market_entities({query}); get_etf_snapshot({code}); get_etf_changes({code, days:1..30}); compare_etfs({codes:[2..3 distinct codes]}); get_stock_context({symbol}); build_research_brief({codes:[1..3 distinct codes]}); get_my_plan_usage({}).\n\nConnection setup: This Skill requires a separately configured OAuth MCP client. If tools are unavailable, guide the user to add the MCP URL in their client and complete browser authorization. For Codex CLI, use \`codex mcp add active-etf --url https://active-etf-mcp.inthewins.com/api/mcp\` and, when authentication is needed, \`codex mcp login active-etf\`. Keep existing client settings. Use native OAuth discovery and authorization; never invent or edit authorization URLs, PKCE, state or callback parameters. If a link expires or fails validation, restart the native client connection to obtain a fresh link; do not keep refreshing the failed page. If browser login state expires, sign in again in the same browser. After connecting, call get_my_plan_usage({}) as a zero-point check. Let the client manage token storage and refresh; never place credentials in this Skill or chat.\n\nOn invalid_token, let the client refresh first; if that fails, ask the user to reconnect through OAuth. On quota_exceeded, report resetsAt and stop retries. On request_in_progress or rate_limited, do not loop. Keep missing observations explicit. Repeated queries within the cache window return the prior snapshot. Never ask users to paste tokens in chat.\n\n## ${t.prompts}\n\n- ${t.prompt1}\n- ${t.prompt2}\n- ${t.prompt3}\n\n${t.limitsText}\n${t.disclaimer}\n`;
}
