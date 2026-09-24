<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  Copy,
  Download,
  Globe2,
  ShieldCheck,
  Layers,
  BookOpen,
  Plug,
  LogOut,
} from "@lucide/vue";
import {
  agentCopy,
  agentLocale,
  agentLocales,
  localeNames,
  agentToolRows,
  skillMarkdown,
} from "../../shared/agentCopy";
import { consumeBrowserAuthCallback } from "../auth/authService";
import AgentInstall from "./AgentInstall.vue";
import { ACTIVE_ETF_SKILL_DOWNLOAD_STARTED_EVENT, trackAgentAction, trackAuthEvent } from "../analytics";
import { claudeInstall } from "../../shared/claudeInstall";
import { recoveryAction, recoveryCopy } from "../../shared/agentRecovery";
const errorCode = ref("");
const recovery = computed(() => recoveryAction(errorCode.value));
const recoveryText = computed(() => recoveryCopy[locale.value]);
const diagnosticCode = computed(() => ["authorization_expired", "invalid_client_or_redirect", "invalid_request", "invalid_login_state", "invalid_identity", "sign_in_required", "invalid_csrf", "beta_access_required", "rate_limited", "temporarily_unavailable"].includes(errorCode.value) ? errorCode.value : "connection_failed");
import { agentOnboarding } from "../../shared/agentOnboarding";
const next = computed(() => agentOnboarding[locale.value]);
const parts = window.location.pathname.split("/").filter(Boolean);
const locale = ref(agentLocale(parts[0])),
  t = computed(() => agentCopy[locale.value]);
const claude = computed(() => claudeInstall[locale.value]);
const page = parts[2] ?? "overview";
const skillPublic = import.meta.env.VITE_MCP_SKILL_PUBLIC === "true";
const request = new URLSearchParams(window.location.search).get("request");
const base = computed(() => `/${locale.value}/mcp`);
const busy = ref(false),
  loading = ref(true),
  authenticated = ref(false),
  csrfToken = ref(""),
  error = ref(""),
  notice = ref(""),
  copied = ref("");
const endpoint = ref("");
const releaseStage = ref("test");
const usage = ref<{
  remaining: number;
  dailyLimit: number;
  used: number;
  resetsAt: string;
} | null>(null);
const authorization = ref<{
  clientName: string;
  redirectOrigin: string;
} | null>(null);
const gateway = (import.meta.env.VITE_MCP_PUBLIC_ORIGIN ?? "https://active-etf-mcp.inthewins.com").replace(
  /\/$/,
  "",
);
// Cross-origin cookie sessions are deliberately avoided. The account page runs on the gateway origin.
const connectedOrigin = ref(gateway);
const gatewayLink = computed(() =>
  connectedOrigin.value
    ? `${connectedOrigin.value}${base.value}/connect`
    : `${base.value}/connect`,
);
function languageChange(event: Event) {
  const lang = (event.target as HTMLSelectElement).value;
  const url = new URL(window.location.href);
  url.pathname = `/${lang}/mcp${page === "overview" ? "" : "/" + page}`;
  window.location.assign(url.toString());
}
async function call(path: string, body?: unknown, method = "POST") {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : method,
    credentials: "same-origin",
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
    headers:
      body === undefined
        ? {}
        : {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken.value,
          },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "error");
  return data;
}
function message(e: unknown) {
  const code = e instanceof Error ? e.message : "";
  errorCode.value = code;
  const action = recoveryAction(code);
  if (action === "restart") authorization.value = null;
  return action === "none" ? t.value.restricted : recoveryText.value[action];
}

async function load() {
  loading.value = true;
  error.value = "";
  authorization.value = null;
  try {
    const config = await call("/api/agent/config");
    if (typeof config.mcpUrl !== "string") throw new Error("unconfigured");
    endpoint.value = config.mcpUrl;
    connectedOrigin.value = new URL(config.mcpUrl).origin;
    if (
      page === "connect" &&
      connectedOrigin.value !== window.location.origin
    ) {
      const target = new URL(
        window.location.pathname + window.location.search,
        connectedOrigin.value,
      );
      window.location.replace(target.toString());
      return;
    }
    releaseStage.value = config.releaseStage ?? "test";
    const loginState = new URLSearchParams(window.location.search).get(
      "login_state",
    );
    const callback = consumeBrowserAuthCallback();
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("login_state");
    window.history.replaceState({}, "", cleanUrl);
    if (callback.idToken) {
      await call("/api/agent/session", {
        idToken: callback.idToken,
        loginState,
      });
    }
    const session = await call("/api/agent/session");
    authenticated.value = session.authenticated;
    csrfToken.value = session.csrfToken ?? "";
    usage.value = session.usage;
    if (callback.idToken && session.authenticated) {
      trackAuthEvent(callback.action === "sign_up" ? "active_etf_sign_up_success" : "active_etf_login_success", "agent_portal_callback");
    }
    if (request)
      authorization.value = await call(
        `/api/agent/authorization?request=${encodeURIComponent(request)}`,
      );
  } catch (e) {
    if (gateway && page !== "connect") endpoint.value = gateway + "/api/mcp";
    else error.value = page === "connect" ? message(e) : t.value.unavailable;
  } finally {
    loading.value = false;
  }
}
async function copy(value: string, key: string) {
  try {
    await navigator.clipboard.writeText(value);
    copied.value = key;
    setTimeout(() => (copied.value = ""), 2000);
  } catch {
    error.value = t.value.copyError;
  }
}
function download() {
  const url = URL.createObjectURL(
    new Blob([skillMarkdown(locale.value)], {
      type: "text/markdown;charset=utf-8",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "SKILL.md";
  a.click();
  trackAgentAction(ACTIVE_ETF_SKILL_DOWNLOAD_STARTED_EVENT, "skill_guide");
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function signIn() {
  busy.value = true;
  try {
    const returnPath =
      base.value +
      "/connect" +
      (request ? "?request=" + encodeURIComponent(request) : "");
    const data = await call("/api/agent/login", { returnPath });
    window.location.assign(data.redirect);
  } catch (e) {
    error.value = message(e);
  } finally {
    busy.value = false;
  }
}
async function consent(approve: boolean) {
  busy.value = true;
  error.value = "";
  try {
    const result = await call("/api/agent/authorize", { request, approve });
    window.location.assign(result.redirect);
  } catch (e) {
    error.value = message(e);
  } finally {
    busy.value = false;
  }
}
async function revoke() {
  busy.value = true;
  try {
    await call("/api/agent/revoke-all", {});
    notice.value = t.value.revoked;
  } catch (e) {
    error.value = message(e);
  } finally {
    busy.value = false;
  }
}
async function signOut() {
  busy.value = true;
  try {
    await call("/api/agent/session", {}, "DELETE");
    authenticated.value = false;
    usage.value = null;
  } catch (e) {
    error.value = message(e);
  } finally {
    busy.value = false;
  }
}
onMounted(() => {
  document.documentElement.lang = locale.value;
  document.title = `${page === "skill" ? t.value.skill : page === "connect" ? t.value.account : t.value.overview} · ${t.value.brand}`;
  void load();
});
</script>

<template>
  <div class="agent-shell">
    <header class="agent-header">
      <a class="agent-brand" :href="base"
        ><img src="/favicon.svg" alt="" /><span
          >{{ t.brand }}<small>Active ETF Intelligence</small></span
        ></a
      >
      <nav :aria-label="t.overview">
        <a
          :href="base"
          :aria-current="page === 'overview' ? 'page' : undefined"
          >{{ t.overview }}</a
        ><a
          v-if="skillPublic" :href="base + '/skill'"
          :aria-current="page === 'skill' ? 'page' : undefined"
          >{{ t.skill }}</a
        ><a
          :href="gatewayLink"
          :aria-current="page === 'connect' ? 'page' : undefined"
          >{{ t.account }}</a
        >
      </nav>
      <label class="agent-language"
        ><Globe2 :size="17" /><select
          :value="locale"
          :aria-label="t.language"
          @change="languageChange"
        >
          <option v-for="lang in agentLocales" :key="lang" :value="lang">
            {{ localeNames[lang] }}
          </option>
        </select></label
      >
    </header>
    <main>
      <section v-if="page === 'overview'" class="agent-hero">
        <div>
          <h1>{{ t.title }}</h1>
          <p class="agent-intro">{{ t.intro }}</p>
          <div class="agent-actions">
            <a class="agent-button primary" href="#connect"
              >{{ t.start }}<ArrowRight :size="18" /></a
            ><a class="agent-button" v-if="skillPublic" :href="base + '/skill'"
              >{{ t.guide }}<BookOpen :size="18"
            /></a>
          </div>
          <p class="agent-caption">{{ t.platformCosts }}</p>
        </div>
        <aside class="agent-allowance">
          <ShieldCheck :size="27" /><strong
            >20<span>{{ t.daily }}</span></strong
          >
          <div>
            <span><b>30</b>{{ t.history }}</span
            ><span><b>3</b>{{ t.compare }}</span>
          </div>
        </aside>
      </section>
      <section v-else-if="skillPublic && page === 'skill'" class="agent-title">
        <BookOpen :size="30" />
        <h1>{{ t.skillTitle }}</h1>
        <p class="agent-intro">{{ t.skillIntro }}</p>
        <button class="agent-button primary" @click="download">
          <Download :size="18" />{{ t.download }}
        </button>
      </section>
      <section v-else class="agent-title">
        <Plug :size="30" />
        <h1>{{ request ? t.consentTitle : t.account }}</h1>
        <p class="agent-intro">{{ request ? t.loginNotice : authenticated ? next.signedIn : t.signedOut }}</p>
      </section>
      <p v-if="error" class="agent-alert" role="alert">
        {{ error }} <code>{{ diagnosticCode }}</code>
        <template v-if="page === 'connect'">
          <button v-if="recovery === 'retry'" :disabled="loading || busy" @click="load">{{ t.retry }}</button>
          <button v-else-if="recovery === 'signIn'" :disabled="busy" @click="signIn">{{ t.signIn }}</button>
          <a v-else-if="recovery === 'restart'" :href="base + '/connect'">{{ recoveryText.home }}</a>
        </template>
      </p>
      <p v-if="notice" class="agent-notice" role="status">{{ notice }}</p>

      <template v-if="page === 'overview'">
        <section class="agent-section agent-tools">
          <div>
            <h2>{{ t.tools }}</h2>
            <p>{{ t.scope }}</p>
          </div>
          <div class="agent-tool-list">
            <div class="agent-table-head">
              <span>{{ t.tool }}</span
              ><span>{{ t.cost }}</span>
            </div>
            <div
              v-for="[name, label, cost] in agentToolRows"
              :key="name"
              class="agent-tool-row"
            >
              <div>
                <b>{{ t[label] }}</b
                ><code>{{ name }}</code>
              </div>
              <strong>{{ cost }}</strong>
            </div>
          </div>
        </section>
        <section class="agent-section agent-quota">
          <h2>{{ t.quotaTitle }}</h2>
          <p>{{ t.quota }}</p>
          <blockquote>{{ t.example }}</blockquote>
          <p>{{ t.fair }}</p>
        </section>
        <section id="connect" class="agent-section">
          <h2>{{ t.platforms }}</h2>
          <div class="agent-endpoint">
            <label for="mcp-endpoint">{{
              releaseStage === "production" ? t.endpoint : t.testEndpoint
            }}</label>
            <div>
              <input
                id="mcp-endpoint"
                readonly
                :value="endpoint"
                :placeholder="loading ? t.loading : t.unavailable"
              /><button
                class="agent-button"
                :disabled="!endpoint"
                @click="copy(endpoint, 'endpoint')"
              >
                <Check v-if="copied === 'endpoint'" :size="17" /><Copy
                  v-else
                  :size="17"
                />{{ copied === "endpoint" ? t.copied : t.copy }}
              </button>
            </div>
          </div>
          <div class="agent-platforms">
            <article>
              <h3>Claude</h3>
              <p>{{ claude.guide }}</p>
              <a :href="gatewayLink">{{ t.start }} <ArrowUpRight :size="16" /></a>
            </article>
            <article>
              <h3>ChatGPT</h3>
              <p>{{ t.chatgpt }}</p>
              <a
                href="https://chatgpt.com/"
                target="_blank"
                rel="noopener noreferrer"
                >ChatGPT <ArrowUpRight :size="16"
              /></a>
            </article>
            <article>
              <h3>Grok</h3>
              <p>{{ t.grok }}</p>
              <a
                href="https://grok.com/connectors"
                target="_blank"
                rel="noopener noreferrer"
                >Grok Connectors <ArrowUpRight :size="16"
              /></a>
            </article>
          </div>
          <p class="agent-caption">{{ t.notLive }}</p>
        </section>
      </template>
      <template v-else-if="skillPublic && page === 'skill'">
        <section class="agent-section agent-workflow">
          <h2>{{ t.workflow }}</h2>
          <ol>
            <li
              v-for="key in ['step1', 'step2', 'step3', 'step4'] as const"
              :key="key"
            >
              {{ t[key] }}
            </li>
          </ol>
        </section>
        <section class="agent-section">
          <h2>{{ t.install }}</h2>
          <p>{{ t.installText }}</p>
          <p>{{ t.installChat }}</p>
          <p>{{ t.installGrok }}</p>
          <h3>{{ claude.platform }}</h3>
          <p>{{ claude.guide }}</p>
          <p>{{ claude.codeSave }}</p>
          <p>{{ claude.webSkill }}</p>
          <a href="https://code.claude.com/docs/en/skills" target="_blank" rel="noopener noreferrer">{{ claude.codeReference }} ↗</a>
          <div class="agent-actions">
            <button class="agent-button primary" @click="download">
              <Download :size="18" />{{ t.download }}</button
            ><a class="agent-button" :href="base + '#connect'"
              >{{ t.start }}<ArrowRight :size="18"
            /></a>
          </div>
        </section>
        <section class="agent-section">
          <h2>{{ t.prompts }}</h2>
          <div class="agent-prompts">
            <article
              v-for="key in ['prompt1', 'prompt2', 'prompt3', 'prompt4'] as const"
              :key="key"
            >
              <p>{{ t[key] }}</p>
              <button class="agent-button" @click="copy(t[key], key)">
                <Copy :size="16" />{{ copied === key ? t.copied : t.copy }}
              </button>
            </article>
          </div>
        </section>
        <section class="agent-section">
          <h2>{{ t.limits }}</h2>
          <p>{{ t.limitsText }}</p>
          <p>{{ t.scope }}</p>
        </section>
      </template>
      <section v-else class="agent-section agent-account">
        <p v-if="loading" role="status">{{ t.loading }}</p>
        <template v-else>
          <template v-if="authorization"
            ><h2>{{ t.client }}</h2>
            <p class="agent-client">{{ authorization.clientName }}</p>
            <p>
              {{ t.destination }}:
              <code>{{ authorization.redirectOrigin }}</code>
            </p>
            <p>{{ t.consentText }}</p></template
          >
          <button
            v-if="!authenticated && !(error && recovery !== 'retry')"
            class="agent-button primary"
            @click="signIn"
          >
            {{ t.signIn }}<ArrowRight :size="18" />
          </button>
          <template v-else-if="authenticated">
            <div v-if="usage" class="agent-balance">
              <span>{{ t.balance }}</span
              ><strong
                >{{ usage.remaining }}
                <small>/ {{ usage.dailyLimit }}</small></strong
              >
              <p>
                {{ t.reset }}:
                {{
                  new Date(usage.resetsAt).toLocaleString(locale, {
                    timeZone: "Asia/Taipei",
                  })
                }}
                (Asia/Taipei)
              </p>
            </div>
            <div v-if="authorization" class="agent-actions">
              <button
                class="agent-button primary"
                :disabled="busy || !!error"
                @click="consent(true)"
              >
                {{ t.allow }}</button
              ><button
                class="agent-button"
                :disabled="busy || !!error"
                @click="consent(false)"
              >
                {{ t.deny }}
              </button>
            </div>
            <div v-else class="agent-actions">
              <button class="agent-button" :disabled="busy" @click="revoke">
                <ShieldCheck :size="18" />{{ t.revoke }}</button
              ><button class="agent-button" :disabled="busy" @click="signOut">
                <LogOut :size="18" />{{ t.signOut }}
              </button>
            </div>
          </template>
        </template>
        <section v-if="!loading && !request" class="agent-next" aria-labelledby="next-title">
          <h2 id="next-title">{{ next.title }}</h2>
          <AgentInstall :locale="locale" :authenticated="authenticated" :endpoint="endpoint" :csrf-token="csrfToken" />
          <div class="agent-endpoint">
            <label for="account-mcp-endpoint">{{ t.endpoint }}</label>
            <div><input id="account-mcp-endpoint" readonly :value="endpoint" />
              <button class="agent-button" :disabled="!endpoint" @click="copy(endpoint, 'account-endpoint')">
                <Copy :size="16" />{{ copied === 'account-endpoint' ? t.copied : t.copy }}
              </button>
            </div>
          </div>
          <p>{{ next.note }}</p>

          <h3>{{ next.examples }}</h3>
          <div class="agent-prompts">
            <article v-for="(prompt, index) in next.prompts" :key="index">
              <div><b>{{ next.labels[index] }}</b><p>{{ prompt }}</p></div>
              <button class="agent-button" :aria-label="t.copy + ': ' + next.labels[index]" @click="copy(prompt, 'starter-' + index)">
                <Copy :size="16" />{{ copied === 'starter-' + index ? t.copied : t.copy }}
              </button>
            </article>
          </div>
          <p class="agent-caption">{{ next.hint }}</p>
        </section>
        <p class="agent-caption">{{ t.privacyNote }}</p>
      </section>
    </main>
    <footer class="agent-footer">
      <p>{{ t.disclaimer }}</p>
      <div>
        <a href="https://active-etf.inthewins.com/">{{ t.home }}</a
        ><a href="https://active-etf.inthewins.com/privacy">{{ t.privacy }}</a
        ><a href="https://active-etf.inthewins.com/terms">{{ t.terms }}</a>
      </div>
    </footer>
  </div>
</template>
<style>
.agent-shell {
  --agent-ink: #173f49;
  --agent-surface: #ffffff;
  --agent-code-bg: #eff6f5;
  --agent-muted: #596d73;
  --agent-line: #d9e5e5;
  --agent-accent: #087c72;
  max-width: 1120px;
  margin: auto;
  padding: 0 28px;
  color: var(--agent-ink);
  font-family:
    Inter,
    -apple-system,
    BlinkMacSystemFont,
    "Noto Sans",
    sans-serif;
  font-size: 16px;
  line-height: 1.75;
}
.agent-shell * {
  box-sizing: border-box;
}
.agent-shell a {
  color: inherit;
}
.agent-header {
  display: flex;
  align-items: center;
  gap: 24px;
  min-height: 92px;
  border-bottom: 1px solid var(--agent-line);
}
.agent-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  font-weight: 750;
  line-height: 1.4;
}
.agent-brand img {
  width: 34px;
  height: 34px;
}
.agent-brand small {
  display: block;
  font-size: 10px;
  letter-spacing: 0.08em;
  color: var(--agent-muted);
  font-weight: 500;
}
.agent-header nav {
  display: flex;
  gap: 20px;
  margin-left: auto;
  font-size: 14px;
}
.agent-header nav a {
  text-decoration: none;
  white-space: nowrap;
}
.agent-header nav a[aria-current] {
  color: var(--agent-accent);
  box-shadow: 0 2px var(--agent-accent);
}
.agent-language {
  display: flex;
  gap: 6px;
  align-items: center;
}
.agent-language select {
  max-width: 125px;
  padding: 9px 4px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 13px;
}
.agent-hero {
  display: grid;
  grid-template-columns: 1fr 310px;
  gap: 65px;
  align-items: center;
  padding: 84px 0 72px;
}
.agent-shell h1 {
  font-size: clamp(34px, 4.4vw, 56px);
  line-height: 1.18;
  letter-spacing: -0.035em;
  font-weight: 760;
  margin: 0 0 24px;
  text-wrap: balance;
}
.agent-intro {
  font-size: 19px;
  color: var(--agent-muted);
  max-width: 680px;
  line-height: 1.8;
}
.agent-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin: 28px 0 16px;
}
.agent-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  padding: 11px 17px;
  min-height: 46px;
  border: 1px solid var(--agent-line);
  border-radius: 8px;
  background: #fff;
  color: var(--agent-ink);
  font: inherit;
  font-size: 14px;
  font-weight: 650;
  text-decoration: none;
  cursor: pointer;
}
.agent-button.primary {
  background: var(--agent-accent);
  border-color: var(--agent-accent);
  color: white;
}
.agent-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.agent-button:focus-visible,
.agent-shell a:focus-visible,
.agent-shell select:focus-visible {
  outline: 3px solid #4ac4b7;
  outline-offset: 4px;
}
.agent-caption {
  font-size: 13px !important;
  color: var(--agent-muted);
  line-height: 1.8;
}
.agent-allowance {
  padding: 30px;
  border-radius: 18px;
  background: #eaf5f2;
  border: 1px solid #c7e0da;
}
.agent-allowance > strong {
  display: block;
  font-size: 86px;
  line-height: 1.05;
  letter-spacing: -0.06em;
  margin: 18px 0 25px;
}
.agent-allowance strong span {
  display: block;
  font-size: 14px;
  letter-spacing: 0;
  font-weight: 500;
  margin-top: 8px;
}
.agent-allowance > div {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  border-top: 1px solid #c7e0da;
  padding-top: 21px;
}
.agent-allowance > div span {
  font-size: 12px;
  line-height: 1.6;
}
.agent-allowance b {
  display: block;
  font-size: 25px;
  line-height: 1.5;
}
.agent-section {
  padding: 48px 0;
  border-top: 1px solid var(--agent-line);
  scroll-margin-top: 24px;
}
.agent-section h2 {
  font-size: 27px;
  line-height: 1.4;
  margin: 0 0 18px;
  letter-spacing: -0.025em;
}
.agent-section h3 {
  font-size: 20px;
  margin: 0 0 12px;
}
.agent-section p {
  color: var(--agent-muted);
}
.agent-tools {
  display: grid;
  grid-template-columns: 1fr 1.6fr;
  gap: 65px;
}
.agent-table-head,
.agent-tool-row {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  padding: 14px 0;
  border-bottom: 1px solid var(--agent-line);
}
.agent-table-head {
  padding-top: 0;
  font-size: 12px;
  color: var(--agent-muted);
}
.agent-tool-row b {
  display: block;
  font-size: 15px;
  font-weight: 600;
}
.agent-tool-row code {
  font-size: 11px;
  color: var(--agent-muted);
  word-break: break-word;
}
.agent-tool-row > strong {
  font-size: 20px;
  color: var(--agent-accent);
}
.agent-quota blockquote {
  border-left: 3px solid var(--agent-accent);
  margin: 25px 0;
  padding: 10px 22px;
  background: #f1f7f5;
  font-size: 18px;
}
.agent-platforms {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 38px;
  margin-top: 30px;
}
.agent-platforms a {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--agent-accent);
  font-weight: 650;
}
.agent-endpoint {
  padding: 20px;
  background: #f1f5f5;
  border-radius: 10px;
}
.agent-endpoint label {
  font-size: 12px;
  display: block;
  margin-bottom: 8px;
}
.agent-endpoint > div {
  display: flex;
  gap: 12px;
}
.agent-endpoint input {
  min-width: 0;
  flex: 1;
  border: 0;
  background: transparent;
  color: var(--agent-ink);
  font-family: monospace;
  font-size: 13px;
}
.agent-title {
  padding: 64px 0 48px;
}
.agent-title > svg {
  color: var(--agent-accent);
  margin-bottom: 22px;
}
.agent-workflow {
  display: grid;
  grid-template-columns: 1fr 1.6fr;
  gap: 65px;
}
.agent-workflow ol {
  margin: 0;
  padding-left: 28px;
}
.agent-workflow li {
  padding: 0 0 22px 12px;
}
.agent-workflow li::marker {
  color: var(--agent-accent);
  font-weight: 750;
}
.agent-prompts article {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  border-bottom: 1px solid var(--agent-line);
  padding: 12px 0;
}
.agent-prompts button {
  flex-shrink: 0;
}
.agent-footer {
  border-top: 1px solid var(--agent-line);
  padding: 28px 0 36px;
  color: var(--agent-muted);
  font-size: 12px;
  display: flex;
  justify-content: space-between;
  gap: 20px;
}
.agent-footer div {
  display: flex;
  gap: 18px;
  align-items: center;
  flex-wrap: wrap;
}
.agent-alert,
.agent-notice {
  padding: 15px;
  border-radius: 8px;
  background: #fff0e9;
  color: #8e422b;
  overflow-wrap: anywhere;
}
.agent-notice {
  background: #eaf5f2;
  color: #16685d;
}
.agent-next { margin-top: 32px; padding-top: 24px; border-top: 1px solid var(--agent-line); }
.agent-next li { margin-bottom: 12px; }
.agent-next details { margin: 16px 0; }
.agent-next summary { cursor: pointer; font-weight: 700; }
.agent-account {
  max-width: 760px;
}
.agent-client {
  font-size: 22px;
  font-weight: 700;
}
.agent-account code {
  overflow-wrap: anywhere;
}
.agent-balance strong {
  display: block;
  font-size: 60px;
  color: var(--agent-accent);
  line-height: 1.3;
}
.agent-balance small {
  font-size: 22px;
  color: var(--agent-muted);
}
[data-theme="dark"] .agent-shell {
  --agent-ink: #dceeed;
  --agent-surface: #12282d;
  --agent-code-bg: #19363c;
  --agent-muted: #acbfbe;
  --agent-line: #345151;
  --agent-accent: #52c6b6;
}
[data-theme="dark"] .agent-allowance,
[data-theme="dark"] .agent-endpoint,
[data-theme="dark"] .agent-quota blockquote {
  background: #183536;
  border-color: #345151;
}
[data-theme="dark"] .agent-button {
  background: #152e32;
}
[data-theme="dark"] .agent-button.primary {
  background: #087c72;
}
@media (max-width: 800px) {
  .agent-header {
    flex-wrap: wrap;
    gap: 12px;
    padding: 18px 0;
  }
  .agent-header nav {
    order: 3;
    width: 100%;
    margin: 8px 0 0;
    justify-content: space-between;
    gap: 10px;
    font-size: 13px;
  }
  .agent-language {
    margin-left: auto;
  }
  .agent-hero {
    grid-template-columns: 1fr;
    gap: 26px;
    padding: 42px 0;
  }
  .agent-allowance {
    display: grid;
    grid-template-columns: 30px 1fr 1.4fr;
    align-items: center;
    gap: 15px;
    padding: 22px;
  }
  .agent-allowance > strong {
    font-size: 54px;
    margin: 0;
  }
  .agent-allowance > div {
    border: 0;
    border-left: 1px solid #c7e0da;
    padding: 0 0 0 20px;
  }
  .agent-tools,
  .agent-workflow {
    grid-template-columns: 1fr;
    gap: 20px;
  }
  .agent-platforms {
    grid-template-columns: 1fr;
    gap: 26px;
  }
  .agent-section {
    padding: 32px 0;
  }
  .agent-title {
    padding: 40px 0 28px;
  }
  .agent-footer {
    flex-direction: column;
    gap: 8px;
  }
  .agent-prompts article {
    align-items: flex-start;
  }
}
@media (max-width: 480px) {
  .agent-shell {
    padding: 0 18px;
  }
  .agent-intro {
    font-size: 17px;
  }
  .agent-allowance {
    grid-template-columns: 1fr 1.5fr;
  }
  .agent-allowance > svg {
    display: none;
  }
  .agent-allowance > div {
    gap: 14px;
  }
  .agent-endpoint > div {
    flex-direction: column;
  }
  .agent-endpoint input {
    min-height: 42px;
    width: 100%;
  }
  .agent-prompts article {
    flex-direction: column;
    gap: 0;
    padding-bottom: 20px;
  }
  .agent-brand {
    font-size: 14px;
  }
  .agent-language select {
    max-width: 90px;
  }
  .agent-section h2 {
    font-size: 24px;
  }
}
</style>
