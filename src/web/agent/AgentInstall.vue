<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { agentCopy, type AgentLocale } from '../../shared/agentCopy';
import { quickInstall } from '../../shared/agentBootstrap';
import { agentInstall, installCommands, oauthReuse } from '../../shared/agentInstall';
const props = defineProps<{locale: AgentLocale; authenticated: boolean; endpoint: string; csrfToken: string}>();
const t = computed(() => agentCopy[props.locale]);
const text = computed(() => agentInstall[props.locale]);
const quick = computed(() => quickInstall[props.locale]);
const installPrompt = ref('');
watch(() => props.authenticated, () => { installPrompt.value = ''; });
const platform = ref('codex');
const copied = ref('');
const error = ref('');
const busy = ref(false);
const checks = ref<boolean[]>([false,false,false]);
async function copy(value: string, key: string) {
  try { await navigator.clipboard.writeText(value); copied.value = key; error.value = ''; }
  catch { error.value = t.value.copyError; }
}
async function copyInstall() {
  busy.value = true; error.value = '';
  try {
    const response = await fetch('/api/agent/install-link', {method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-CSRF-Token':props.csrfToken},body:JSON.stringify({locale:props.locale})});
    if (!response.ok) throw new Error(response.status === 401 ? 'login' : 'link');
    const data = await response.json();
    installPrompt.value = quick.value.prompt + '\n' + data.url;
    await copy(installPrompt.value,'install');
  } catch(e) { error.value = e instanceof Error && e.message === 'login' ? quick.value.login : t.value.error; }
  finally { busy.value = false; }
}
async function downloadSkill() {
  busy.value = true; error.value = '';
  try {
    const response = await fetch('/api/agent/skill?lang='+encodeURIComponent(props.locale), {credentials:'same-origin',cache:'no-store'});
    if (!response.ok) throw new Error(response.status === 401 ? 'login' : 'download');
    const url = URL.createObjectURL(await response.blob());
    const a = document.createElement('a'); a.href=url; a.download='SKILL.md'; a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  } catch (e) { error.value = e instanceof Error && e.message === 'login' ? text.value.login : t.value.error; }
  finally { busy.value = false; }
}
</script>
<template>
  <section class="agent-install" aria-labelledby="install-title">
    <div class="quick-install">
      <h2 id="install-title">{{ quick.title }}</h2>
      <p>{{ quick.intro }}</p>
      <p v-if="!authenticated">{{ quick.login }}</p>
      <button class="agent-button primary" :disabled="!authenticated || busy" @click="copyInstall">{{ busy ? t.loading : copied === 'install' ? t.copied : quick.copy }}</button>
      <textarea v-if="installPrompt" readonly :value="installPrompt" :aria-label="quick.copy" rows="5" @focus="($event.target as HTMLTextAreaElement).select()" />
      <p v-if="installPrompt" class="agent-caption">{{ quick.expired }}</p>
      <p v-if="error" role="alert" class="agent-alert">{{ error }}</p>
    </div>
    <details class="manual-install"><summary>{{ quick.advanced }}</summary>
    <h3>{{ text.title }}</h3>
    <label for="install-platform">{{ text.choose }}</label>
    <select id="install-platform" v-model="platform" @change="checks = [false,false,false]">
      <option value="codex">{{ text.local }}</option>
      <option value="chatgpt">ChatGPT · {{ text.web }}</option>
      <option value="grok">Grok · {{ text.web }}</option>
    </select>
    <template v-if="platform === 'codex'">
      <h3>{{ text.steps[0] }}</h3>
      <p>{{ text.save }}</p>
      <div class="install-command"><pre><code>{{ installCommands.folder }}</code></pre><button class="agent-button" @click="copy(installCommands.folder,'folder')">{{ copied === 'folder' ? t.copied : t.copy }}</button></div>
      <button class="agent-button primary" :disabled="!authenticated || busy" @click="downloadSkill">{{ busy ? t.loading : text.download }}</button>
      <p v-if="!authenticated">{{ text.login }}</p>
      <h3>{{ text.steps[1] }}</h3>
      <p>{{ text.setup }}</p>
      <div v-for="key in ['inspect','add'] as const" :key="key" class="install-command"><pre><code>{{ installCommands[key] }}</code></pre><button class="agent-button" @click="copy(installCommands[key],key)">{{ copied === key ? t.copied : t.copy }}</button></div>
      <details><summary>{{ text.alternative }}</summary><div class="install-command"><pre><code>{{ installCommands.config }}</code></pre><button class="agent-button" @click="copy(installCommands.config,'config')">{{ copied === 'config' ? t.copied : t.copy }}</button></div></details>
      <h3>{{ text.steps[2] }}</h3><p>{{ text.oauth }}</p>
      <div class="install-command"><pre><code>{{ installCommands.login }}</code></pre><button class="agent-button" @click="copy(installCommands.login,'login')">{{ copied === 'login' ? t.copied : t.copy }}</button></div>
      <a href="https://developers.openai.com/codex/mcp/" target="_blank" rel="noopener noreferrer">{{ text.reference }} ↗</a>
    </template>
    <template v-else>
      <h3>{{ t.platforms }}</h3><p>{{ text.webNote }}</p>
      <p>{{ platform === 'chatgpt' ? t.chatgpt : t.grok }}</p>
      <div class="install-command"><pre><code>{{ endpoint }}</code></pre><button class="agent-button" :disabled="!endpoint" @click="copy(endpoint,'url')">{{ copied === 'url' ? t.copied : t.copy }}</button></div>
      <a :href="platform === 'chatgpt' ? 'https://chatgpt.com/' : 'https://grok.com/connectors'" target="_blank" rel="noopener noreferrer">{{ platform === 'chatgpt' ? 'ChatGPT' : 'Grok Connectors' }} ↗</a>
      <h3>{{ text.steps[2] }}</h3><p>{{ t.loginNotice }}</p><p>{{ t.consentText }}</p><p>{{ oauthReuse[locale] }}</p>
    </template>
    <h3>{{ text.steps[3] }}</h3><p>{{ text.verify }}</p>
    <div class="install-command"><pre><code>{{ platform === 'codex' ? '$active-etf-research ' : '' }}{{ t.usage }} — get_my_plan_usage({})</code></pre><button class="agent-button" @click="copy((platform === 'codex' ? '$active-etf-research ' : '') + t.usage + ' — get_my_plan_usage({})','verify')">{{ copied === 'verify' ? t.copied : t.copy }}</button></div>
    <fieldset><legend>{{ text.checkTitle }}</legend><label v-for="(label,index) in text.checklist" :key="index"><input v-model="checks[index]" type="checkbox" />{{ label }}</label></fieldset>
    <p class="agent-caption">{{ text.trouble }}</p>
    </details>
  </section>
</template>
<style scoped>
.agent-install { margin: 28px 0; }
.quick-install { padding:24px; border:1px solid var(--agent-line); border-radius:16px; background:var(--agent-surface); color:var(--agent-ink); }
.quick-install h2 { margin-top:0; }
.quick-install textarea { display:block; box-sizing:border-box; width:100%; margin-top:20px; padding:16px; border:1px solid var(--agent-line); border-radius:10px; background:var(--agent-code-bg); color:var(--agent-ink); font:inherit; line-height:1.6; resize:vertical; }
.install-command code { color:var(--agent-ink); }
.agent-install h3 { margin-top: 28px; }
.agent-install select { display:block; margin: 10px 0 20px; max-width:100%; padding:12px; font:inherit; border:1px solid var(--agent-line); border-radius:8px; background:var(--agent-surface); color:var(--agent-ink); }
.install-command { display:flex; gap:12px; align-items:center; margin:16px 0; }
.install-command pre { flex:1; min-width:0; white-space:pre-wrap; overflow-wrap:anywhere; padding:14px; background:var(--agent-code-bg); color:var(--agent-ink); border-radius:8px; }
.install-command button { flex-shrink:0; }
.agent-install details { margin:20px 0; }
.agent-install summary { cursor:pointer; }
.agent-install fieldset { margin-top:24px; border:1px solid var(--agent-line); border-radius:10px; padding:16px; }
.agent-install fieldset label { display:flex; align-items:flex-start; gap:10px; margin:12px 0; }
@media(max-width:600px) { .install-command { align-items:stretch; flex-direction:column; } .install-command button { align-self:flex-start; } }
</style>
