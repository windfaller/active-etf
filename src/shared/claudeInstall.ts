import type { AgentLocale } from './agentCopy.js';

export const claudeCommands = {
  folder: 'mkdir -p ~/.claude/skills/active-etf-research',
  inspect: 'claude mcp get active-etf',
  add: 'claude mcp add --scope user --transport http active-etf https://active-etf-mcp.inthewins.com/api/mcp',
  login: 'claude mcp login active-etf',
  skillPath: '~/.claude/skills/active-etf-research/SKILL.md',
};

export const claudeInstall: Record<AgentLocale, {
  platform: string; code: string; web: string; codeSave: string; codeSetup: string;
  codeOauth: string; webSetup: string; webOrg: string; webSkill: string;
  guide: string; codeReference: string; webReference: string;
}> = {
  en: {
    platform: 'Claude', code: 'Claude Code · local Skill + MCP', web: 'Claude · web connector',
    codeSave: 'Save the downloaded SKILL.md at ~/.claude/skills/active-etf-research/SKILL.md. Start a new Claude Code session to load it. The Skill file alone does not grant access.',
    codeSetup: 'Check whether active-etf already exists. If it does, verify its URL; otherwise add the remote HTTP server for your user account. Run these commands in your own terminal.',
    codeOauth: 'Use /mcp in Claude Code and select Authenticate for active-etf, or run the login command below. Complete member sign-in and read-only approval in the browser. If authorization expires, start a fresh flow from Claude Code.',
    webSetup: 'In Claude, open Customize → Connectors → + → Add custom connector. Name it Active ETF, paste the MCP URL below, then Add and Connect. Complete browser sign-in and read-only approval. In a chat, use + → Connectors to enable it.',
    webOrg: 'On Team or Enterprise, an owner must first add the custom Web connector in Organization settings → Connectors; members then select Connect in Customize → Connectors.',
    webSkill: 'The web connector does not install your local SKILL.md. Use the research prompts below; if your Claude account offers Skills, import the Skill separately.',
    guide: 'Claude Code: paste the one-prompt install request into Claude Code, then approve OAuth in your browser. Claude web: add this MCP URL under Customize → Connectors and enable it in the chat; local Skill files are separate.',
    codeReference: 'Claude Code MCP and Skills docs', webReference: 'Claude custom connector help',
  },
  'zh-TW': {
    platform: 'Claude', code: 'Claude Code・本機 Skill + MCP', web: 'Claude・網頁連接器',
    codeSave: '將下載的 SKILL.md 存到 ~/.claude/skills/active-etf-research/SKILL.md，再開啟新的 Claude Code 對話載入。只有 Skill 檔案不會取得資料權限。',
    codeSetup: '先檢查是否已有 active-etf；若有，確認網址即可，否則為使用者帳號新增遠端 HTTP MCP。這些命令由你在本機終端機執行。',
    codeOauth: '在 Claude Code 輸入 /mcp，選擇 active-etf 的 Authenticate；也可執行下方登入命令。在瀏覽器完成會員登入及唯讀授權。授權過期時，從 Claude Code 重新發起。',
    webSetup: '在 Claude 開啟 Customize → Connectors → + → Add custom connector，命名 Active ETF，貼上下方 MCP 網址，按 Add、Connect，並在瀏覽器完成登入授權。對話中按 + → Connectors 啟用。',
    webOrg: 'Team／Enterprise 方案須先由擁有者在 Organization settings → Connectors 新增自訂 Web 連接器；成員再到 Customize → Connectors 按 Connect。',
    webSkill: '網頁連接器不會安裝電腦上的 SKILL.md。可直接使用下方研究提示；若你的 Claude 帳號提供 Skills，需另外匯入。',
    guide: 'Claude Code：將「一段 prompt 安裝」貼到 Claude Code，接著在瀏覽器完成 OAuth。Claude 網頁版：在 Customize → Connectors 新增此 MCP 網址，並於對話啟用；本機 Skill 需另行安裝。',
    codeReference: 'Claude Code MCP 與 Skills 官方說明', webReference: 'Claude 自訂連接器官方說明',
  },
  'zh-CN': {
    platform: 'Claude', code: 'Claude Code・本地 Skill + MCP', web: 'Claude・网页连接器',
    codeSave: '将下载的 SKILL.md 保存至 ~/.claude/skills/active-etf-research/SKILL.md，再开启新的 Claude Code 对话加载。仅有 Skill 文件不会获得数据权限。',
    codeSetup: '先检查是否已有 active-etf；若有，确认地址即可，否则为用户账号添加远程 HTTP MCP。这些命令由你在本地终端运行。',
    codeOauth: '在 Claude Code 输入 /mcp，选择 active-etf 的 Authenticate；也可运行下方登录命令。在浏览器完成会员登录及只读授权。授权过期时，从 Claude Code 重新发起。',
    webSetup: '在 Claude 打开 Customize → Connectors → + → Add custom connector，命名 Active ETF，粘贴下方 MCP 地址，点击 Add、Connect，再在浏览器完成登录授权。聊天中点击 + → Connectors 启用。',
    webOrg: 'Team／Enterprise 方案须先由所有者在 Organization settings → Connectors 添加自定义 Web 连接器；成员再到 Customize → Connectors 点击 Connect。',
    webSkill: '网页连接器不会安装电脑上的 SKILL.md。可直接使用下方研究提示；若你的 Claude 账号提供 Skills，需另外导入。',
    guide: 'Claude Code：将“一段 prompt 安装”发送给 Claude Code，然后在浏览器完成 OAuth。Claude 网页版：在 Customize → Connectors 添加此 MCP 地址并在聊天中启用；本地 Skill 需单独安装。',
    codeReference: 'Claude Code MCP 与 Skills 官方文档', webReference: 'Claude 自定义连接器官方说明',
  },
  ja: {
    platform: 'Claude', code: 'Claude Code・ローカル Skill + MCP', web: 'Claude・Web コネクター',
    codeSave: 'ダウンロードした SKILL.md を ~/.claude/skills/active-etf-research/SKILL.md に保存し、新しい Claude Code セッションで読み込みます。Skill だけではデータへのアクセス権は付与されません。',
    codeSetup: '既存の active-etf を確認し、あれば URL を検証します。なければユーザー用のリモート HTTP MCP を追加します。コマンドはローカル端末で実行します。',
    codeOauth: 'Claude Code で /mcp を開き、active-etf の Authenticate を選ぶか、下のログインコマンドを実行します。ブラウザーで会員ログインと読み取り専用の認可を完了します。期限切れの場合は Claude Code からやり直します。',
    webSetup: 'Claude の Customize → Connectors → + → Add custom connector で Active ETF と名付け、下の MCP URL を貼り付けます。Add、Connect の順に進み、ブラウザーで認可します。チャットでは + → Connectors で有効化します。',
    webOrg: 'Team／Enterprise では、先に管理者が Organization settings → Connectors にカスタム Web コネクターを追加し、利用者が Customize → Connectors から Connect を選びます。',
    webSkill: 'Web コネクターはローカルの SKILL.md をインストールしません。下の質問例をそのまま利用できます。Claude アカウントに Skills がある場合は別途インポートしてください。',
    guide: 'Claude Code：ワンプロンプトのインストール依頼を貼り付け、ブラウザーで OAuth を承認します。Claude Web：Customize → Connectors にこの MCP URL を追加してチャットで有効化します。ローカル Skill は別途必要です。',
    codeReference: 'Claude Code MCP／Skills 公式ガイド', webReference: 'Claude カスタムコネクター公式ガイド',
  },
  ko: {
    platform: 'Claude', code: 'Claude Code・로컬 Skill + MCP', web: 'Claude・웹 커넥터',
    codeSave: '다운로드한 SKILL.md를 ~/.claude/skills/active-etf-research/SKILL.md에 저장하고 새 Claude Code 세션에서 불러오세요. Skill 파일만으로는 데이터 접근 권한이 생기지 않습니다.',
    codeSetup: 'active-etf가 이미 있으면 URL을 확인하고, 없다면 사용자 계정에 원격 HTTP MCP를 추가하세요. 명령은 로컬 터미널에서 실행합니다.',
    codeOauth: 'Claude Code에서 /mcp를 열고 active-etf의 Authenticate를 선택하거나 아래 로그인 명령을 실행하세요. 브라우저에서 회원 로그인과 읽기 전용 승인을 완료하세요. 만료되면 Claude Code에서 새로 시작하세요.',
    webSetup: 'Claude에서 Customize → Connectors → + → Add custom connector를 열고 Active ETF로 이름을 지정한 뒤 아래 MCP URL을 입력하세요. Add, Connect를 누르고 브라우저에서 승인하세요. 채팅에서는 + → Connectors로 활성화하세요.',
    webOrg: 'Team／Enterprise에서는 소유자가 먼저 Organization settings → Connectors에 사용자 지정 Web 커넥터를 추가해야 합니다. 이후 구성원이 Customize → Connectors에서 Connect를 누릅니다.',
    webSkill: '웹 커넥터는 로컬 SKILL.md를 설치하지 않습니다. 아래 연구 질문을 바로 사용할 수 있으며, Claude 계정에서 Skills를 지원한다면 별도로 가져오세요.',
    guide: 'Claude Code: 한 번의 프롬프트 설치 요청을 붙여 넣고 브라우저에서 OAuth를 승인하세요. Claude 웹: Customize → Connectors에 이 MCP URL을 추가하고 채팅에서 활성화하세요. 로컬 Skill은 별도입니다.',
    codeReference: 'Claude Code MCP 및 Skills 공식 문서', webReference: 'Claude 사용자 지정 커넥터 공식 도움말',
  },
};
