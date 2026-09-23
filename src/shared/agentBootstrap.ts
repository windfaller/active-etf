import { skillMarkdown, type AgentLocale } from './agentCopy.js';
export function installationGuide(locale: AgentLocale): string {
  const skill = skillMarkdown(locale);
  return `# Active ETF member Skill installation guide

The user supplied this installation link to install Active ETF research. Follow their requested scope and the host agent's permissions. Reply in ${locale}. This link contains installation instructions only: it is NOT a membership credential, OAuth grant or MCP access token. It expires after 30 minutes; if unavailable, ask the user to copy a fresh installation prompt from https://active-etf-mcp.inthewins.com/${locale}/mcp/connect.

## Complete the installation for the user

1. Identify the agent environment and its supported Skill and remote MCP configuration. Do not require the user to run commands when your tools can perform the authorized setup. Do not assume a web chat has filesystem or MCP-management access. If it lacks those capabilities, state the limitation and direct the user to its custom OAuth connector UI with the endpoint below; do not claim that a local Skill has been installed.
2. For Codex on a local computer, install the exact Skill payload below at ~/.agents/skills/active-etf-research/SKILL.md. For Claude Code, install it at ~/.claude/skills/active-etf-research/SKILL.md. Expand ~ to the current user's home. Create the directory if needed. Inspect an existing file before updating; preserve user modifications and report any conflict. Other supported agents should use their documented Skill directory; do not guess paths. No third-party packages or shell installer are required.
3. Configure a Streamable HTTP MCP connection named active-etf with URL https://active-etf-mcp.inthewins.com/api/mcp. Inspect existing configuration and preserve unrelated entries. For Codex, inspect with \`codex mcp list\`; if absent, use \`codex mcp add active-etf --url https://active-etf-mcp.inthewins.com/api/mcp\`. For Claude Code, inspect with \`claude mcp get active-etf\`; if absent, use \`claude mcp add --scope user --transport http active-etf https://active-etf-mcp.inthewins.com/api/mcp\`. Do not add a duplicate server. If the Codex CLI is unavailable but local configuration is supported, merge this entry into ~/.codex/config.toml without replacing the file:

\`\`\`toml
[mcp_servers.active-etf]
url = "https://active-etf-mcp.inthewins.com/api/mcp"
\`\`\`

4. Use the client's native OAuth flow. Never invent, manually assemble, edit or reuse an authorization URL. Discover the authorization endpoint from OAuth metadata; the MCP client must own registration, exact redirect URI, fresh state and S256 PKCE, and send resource=https://active-etf-mcp.inthewins.com/api/mcp. Present only the URL returned by that native flow. Do not pre-open or consume callback/code URLs. If the link is rejected or expires, restart the client's native flow to obtain a fresh URL instead of asking the user to refresh the broken URL. If no native OAuth connector is available, explain that limitation instead of simulating a successful connection. Codex setup may start OAuth automatically; otherwise use \`codex mcp login active-etf\` or its MCP Authenticate control. Claude Code users can open \`/mcp\` and authenticate active-etf, or use \`claude mcp login active-etf\` in an interactive terminal. Let the user complete member sign-in and read-only authorization in the browser. Never read another app's login tokens, request passwords/tokens in chat, or treat this installation link as authorization. The MCP client owns token storage and refresh. If the agent needs a restart/new conversation before tools become available, tell the user precisely and resume the check there.
5. Once authorized, call get_my_plan_usage({}) through the real MCP connection. This costs zero points. Report remaining points and reset time from the actual tool response. Do not run paid-point research calls without a user request. Distinguish saved Skill, saved MCP configuration, OAuth success and successful tool call. Never invent a successful installation or quota.

## Skill payload

Write only the content inside the following fence to SKILL.md. Do not save this installation guide or its expiring URL as the Skill.

\`\`\`markdown
${skill.trim()}
\`\`\`
`;
}
export const quickInstall: Record<AgentLocale, {title:string; intro:string; copy:string; prompt:string; login:string; advanced:string; expired:string}> = {
 en: {title:'Quick install — one prompt for your agent',intro:'Copy and send this prompt to a local agent such as Codex or Claude Code that can install Skills and configure MCP. It handles setup; you complete browser authorization. The installation link lasts 30 minutes and grants no account access.',copy:'Copy installation prompt',prompt:'Read the guide below and install the Active ETF Skill and MCP connection for me. Handle the setup, let me complete browser OAuth when needed, then verify with the free usage tool:',login:'Sign in above to generate your installation prompt.',advanced:'Advanced: manual setup and web connectors',expired:'If the link expires, copy a fresh prompt here.'},
 'zh-TW': {title:'快速安裝 — 一段 prompt 交給 Agent',intro:'複製後貼給可安裝本機 Skill、設定 MCP 的 Agent，例如 Codex 或 Claude Code。由 Agent 完成設定，你只需完成瀏覽器授權。安裝連結有效 30 分鐘，不授予帳號存取權。',copy:'複製安裝 prompt',prompt:'請讀取以下指引，幫我安裝 ETF 研究 Skill 與 MCP 連接。請代為完成設定，只在需要時讓我完成瀏覽器 OAuth 授權，最後用免費的用量工具確認連線：',login:'請先使用上方會員登入，即可產生安裝 prompt。',advanced:'進階：手動設定與網頁連接器',expired:'連結過期時，回此頁重新複製即可。'},
 'zh-CN': {title:'快速安装 — 一段 prompt 交给 Agent',intro:'复制后发送给可安装本地 Skill、配置 MCP 的 Agent，例如 Codex 或 Claude Code。Agent 完成配置，你只需完成浏览器授权。安装链接有效 30 分钟，不授予账号访问权限。',copy:'复制安装 prompt',prompt:'请读取以下指引，帮我安装 ETF 研究 Skill 与 MCP 连接。请代为完成配置，仅在需要时让我完成浏览器 OAuth 授权，最后使用免费的用量工具确认连接：',login:'请先使用上方会员登录，即可生成安装 prompt。',advanced:'进阶：手动配置与网页连接器',expired:'链接过期时，返回此页重新复制即可。'},
 ja: {title:'簡単インストール — Agent に送る一つのプロンプト',intro:'Codex や Claude Code など、ローカル Skill のインストールと MCP 設定ができる Agent に貼り付けてください。設定は Agent が行い、ブラウザー認可はあなたが行います。リンクは30分間有効で、アカウントへのアクセス権は付与しません。',copy:'インストール用プロンプトをコピー',prompt:'次のガイドを読み、ETF リサーチ Skill と MCP 接続をインストールしてください。設定を行い、必要なブラウザー OAuth 認可は私に任せ、最後に無料の利用状況ツールで接続を確認してください：',login:'上の会員ログイン後にプロンプトを生成できます。',advanced:'詳細：手動設定と Web コネクター',expired:'期限切れの場合はここで再度コピーしてください。'},
 ko: {title:'빠른 설치 — Agent에게 프롬프트 하나 보내기',intro:'Codex나 Claude Code처럼 로컬 Skill 설치와 MCP 설정이 가능한 Agent에 붙여 넣으세요. 설정은 Agent가 수행하고 브라우저 승인은 직접 완료합니다. 링크는 30분 동안 유효하며 계정 접근 권한을 부여하지 않습니다.',copy:'설치 프롬프트 복사',prompt:'아래 안내를 읽고 ETF 리서치 Skill과 MCP 연결을 설치해 주세요. 설정을 진행하고 필요한 브라우저 OAuth 승인은 제가 완료하도록 한 뒤, 무료 사용량 도구로 연결을 확인해 주세요:',login:'위에서 회원 로그인 후 설치 프롬프트를 생성하세요.',advanced:'고급: 수동 설정 및 웹 커넥터',expired:'링크가 만료되면 여기에서 다시 복사하세요.'},
};
