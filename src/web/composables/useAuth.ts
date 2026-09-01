import { computed, readonly, ref } from "vue";
import { trackAuthEvent } from "../analytics";
import { clearJsonCache } from "../apiClient";
import {
  buildSignInUrl,
  clearAuthSession,
  consumeBrowserAuthCallback,
  establishAuthSession,
  getAuthSession,
  type AuthUser
} from "../auth/authService";

const user = ref<AuthUser | null>(null);
const isLoading = ref(true);
const error = ref("");
let initialization: Promise<void> | null = null;

function applySession(authenticated: boolean, nextUser: AuthUser | null): void {
  user.value = authenticated ? nextUser : null;
}

async function initialize(): Promise<void> {
  if (initialization) return initialization;
  initialization = (async () => {
    const { idToken, action } = consumeBrowserAuthCallback();

    isLoading.value = true;
    error.value = "";
    try {
      const session = idToken ? await establishAuthSession(idToken) : await getAuthSession();
      applySession(session.authenticated, session.user);
      if (idToken && session.authenticated && action) {
        trackAuthEvent(action === "sign_up" ? "active_etf_sign_up_success" : "active_etf_login_success", "auth_callback");
      }
    } catch {
      applySession(false, null);
      error.value = "登入驗證失敗，請再試一次。";
      if (idToken) trackAuthEvent("active_etf_login_failed", "auth_callback");
    } finally {
      isLoading.value = false;
    }
  })();
  return initialization;
}

function signIn(source = "header"): void {
  error.value = "";
  trackAuthEvent("active_etf_login_intent", source);
  window.location.assign(buildSignInUrl(window.location.href));
}

async function signOut(source = "account_menu"): Promise<void> {
  isLoading.value = true;
  error.value = "";
  try {
    await clearAuthSession();
    user.value = null;
    clearJsonCache();
    trackAuthEvent("active_etf_logout", source);
    window.location.reload();
  } catch {
    error.value = "登出失敗，請稍後再試。";
  } finally {
    isLoading.value = false;
  }
}

export function useAuth() {
  return {
    user: readonly(user),
    isAuthenticated: computed(() => user.value !== null),
    isLoading: readonly(isLoading),
    error: readonly(error),
    initialize,
    signIn,
    signOut
  };
}
