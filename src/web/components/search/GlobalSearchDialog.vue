<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { ArrowRight, Search, X } from "@lucide/vue";
import { useGlobalSearch } from "../../composables/useGlobalSearch";

const props = withDefaults(defineProps<{ initialQuery?: string; mode?: "dialog" | "page"; types?: string[] }>(), { initialQuery: "", mode: "dialog", types: () => [] });
const emit = defineEmits<{ close: []; navigate: [path: string]; query: [value: string] }>();
const input = ref<HTMLInputElement | null>(null);
const { query, results, loading, error, search, cancel } = useGlobalSearch(props.types);

function update(value: string): void { search(value); emit("query", value); }
function choose(path: string): void { emit("navigate", path); emit("close"); }
function onKeydown(event: KeyboardEvent): void { if (event.key === "Escape") emit("close"); }

onMounted(() => {
  if (props.initialQuery) search(props.initialQuery, true);
  if (props.mode === "dialog") { document.addEventListener("keydown", onKeydown); void nextTick(() => input.value?.focus()); }
});
onBeforeUnmount(() => { cancel(); document.removeEventListener("keydown", onKeydown); });
</script>

<template>
  <section class="global-search" :class="mode">
    <header><div><b>全站搜尋與快速前往</b><small>股票、台灣／海外 ETF、13F、產業與訊號頁</small></div><button v-if="mode === 'dialog'" type="button" aria-label="關閉搜尋" @click="emit('close')"><X :size="20" /></button></header>
    <label class="search-field"><Search :size="18" /><input ref="input" :value="query" type="search" placeholder="輸入股票名稱、代碼或 ETF（至少 2 字）" @input="update(($event.target as HTMLInputElement).value)" /></label>
    <p v-if="loading" class="search-state">搜尋中…</p><p v-else-if="error" class="search-error">{{ error }}</p><p v-else-if="query.trim().length >= 2 && !results.length" class="search-state">沒有符合的追蹤資料。</p>
    <div v-if="results.length" class="search-results" role="listbox" aria-label="搜尋結果">
      <button v-for="result in results" :key="`${result.type}-${result.code}`" type="button" @click="choose(result.path)"><span class="result-type">{{ result.typeLabel }}</span><span><b>{{ result.code }} {{ result.name }}</b><small>{{ result.market }}｜資料日 {{ result.latestDataDate ?? '依目的頁標示' }}</small></span><ArrowRight :size="17" /></button>
    </div>
    <footer v-if="mode === 'dialog'"><kbd>⌘/Ctrl K</kbd><span>開啟搜尋</span><kbd>Esc</kbd><span>關閉</span></footer>
  </section>
</template>

<style scoped>
.global-search{display:grid;gap:14px;width:min(720px,100%);max-height:min(720px,calc(100vh - 28px));padding:20px;border:1px solid var(--theme-border);border-radius:16px;background:var(--theme-surface);box-shadow:0 28px 80px rgba(10,28,42,.2)}.global-search.page{width:100%;max-height:none;box-shadow:none}.global-search header{display:flex;justify-content:space-between;gap:18px}.global-search header>div{display:grid;gap:4px}.global-search header b{color:var(--theme-text-strong);font-size:18px}.global-search header small,.search-state{color:var(--theme-text-muted)}.global-search header button{display:grid;place-items:center;width:44px;height:44px;border:1px solid var(--theme-border);border-radius:9px;background:var(--theme-surface)}.search-field{display:flex;align-items:center;gap:9px;height:50px;padding:0 13px;border:1px solid #9eb2bf;border-radius:10px;background:var(--theme-surface-muted);color:var(--theme-text-muted)}.search-field input{width:100%;border:0;outline:0;background:transparent;color:var(--theme-text);font-size:16px}.search-results{display:grid;gap:5px;overflow:auto}.search-results button{display:grid;grid-template-columns:90px 1fr 20px;align-items:center;gap:10px;min-height:62px;padding:9px 12px;border:1px solid transparent;border-radius:10px;background:transparent;color:var(--theme-text);text-align:left;cursor:pointer}.search-results button:hover,.search-results button:focus-visible{border-color:var(--theme-border);background:var(--theme-surface-muted)}.search-results button>span:nth-child(2){display:grid;gap:3px}.search-results small{color:var(--theme-text-muted)}.result-type{color:#087b72;font-size:12px;font-weight:800}.search-error{margin:0;color:#a8322a}.global-search footer{display:flex;align-items:center;justify-content:flex-end;gap:6px;color:var(--theme-text-muted);font-size:11px}.global-search kbd{padding:3px 6px;border:1px solid var(--theme-border);border-radius:5px;background:var(--theme-surface-muted)}
@media(max-width:600px){.global-search{max-height:calc(100vh - env(safe-area-inset-top));padding:18px 14px calc(22px + env(safe-area-inset-bottom));border-radius:18px 18px 0 0}.search-results button{grid-template-columns:70px 1fr 18px}.global-search footer{display:none}}
</style>
