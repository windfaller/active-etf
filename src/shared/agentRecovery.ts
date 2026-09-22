import type { AgentLocale } from './agentCopy.js';
export type RecoveryAction = 'retry' | 'signIn' | 'restart' | 'none';
export function recoveryAction(code: string): RecoveryAction {
  if (['authorization_expired','invalid_client_or_redirect','invalid_request'].includes(code)) return 'restart';
  if (['invalid_login_state','invalid_identity','sign_in_required','invalid_csrf'].includes(code)) return 'signIn';
  if (code === 'beta_access_required') return 'none';
  return 'retry';
}
export const recoveryCopy: Record<AgentLocale,{restart:string;signIn:string;retry:string;home:string}> = {
  en:{restart:'This authorization link is invalid, expired or already used. Return to your AI client and start a new OAuth connection. Refreshing this link will not fix it.',signIn:'Your login could not be verified or has expired. Sign in again in this same browser, then continue authorization.',retry:'The service could not be reached. Please retry shortly. If this continues, return to your AI client and start a new connection.',home:'Return to member page'},
  'zh-TW':{restart:'授權連結無效、已過期或已使用。請回到 AI 用戶端重新發起 OAuth 連接，取得新連結；重新整理舊連結無法恢復。',signIn:'登入狀態無法驗證或已過期。請在同一瀏覽器重新登入，再繼續授權。',retry:'暫時無法連接服務，請稍後重試。若持續失敗，請回到 AI 用戶端重新發起連接。',home:'返回會員頁'},
  'zh-CN':{restart:'授权链接无效、已过期或已使用。请返回 AI 客户端重新发起 OAuth 连接，获取新链接；刷新旧链接无法恢复。',signIn:'登录状态无法验证或已过期。请在同一浏览器重新登录，再继续授权。',retry:'暂时无法连接服务，请稍后重试。如果持续失败，请返回 AI 客户端重新发起连接。',home:'返回会员页'},
  ja:{restart:'認可リンクが無効、期限切れ、または使用済みです。AI クライアントで OAuth 接続を開始し直し、新しいリンクを取得してください。古いリンクの再読み込みでは復旧しません。',signIn:'ログイン状態を確認できないか、有効期限が切れています。同じブラウザーで再ログインして認可を続けてください。',retry:'一時的にサービスに接続できません。後ほど再試行してください。解消しない場合は AI クライアントで接続を開始し直してください。',home:'会員ページに戻る'},
  ko:{restart:'승인 링크가 유효하지 않거나 만료되었거나 이미 사용되었습니다. AI 클라이언트에서 OAuth 연결을 다시 시작해 새 링크를 받으세요. 기존 링크를 새로고침해도 복구되지 않습니다.',signIn:'로그인 상태를 확인할 수 없거나 만료되었습니다. 같은 브라우저에서 다시 로그인한 뒤 승인을 계속하세요.',retry:'일시적으로 서비스에 연결할 수 없습니다. 잠시 후 다시 시도하세요. 계속 실패하면 AI 클라이언트에서 연결을 다시 시작하세요.',home:'회원 페이지로 돌아가기'},
};
