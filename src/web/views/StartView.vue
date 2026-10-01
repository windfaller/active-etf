<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ArrowRight, GitCompareArrows, ShieldCheck } from "@lucide/vue";
import { configuredEtfs } from "../../config/etfs";
import { getJson } from "../apiClient";
import { comparisonRequests, trackPreviewLoaded } from "../analytics";
import { useAuth } from "../composables/useAuth";
import type { EtfComparison } from "../contracts/compare";
import type { EtfCoverageResponse } from "../contracts/dashboard";

const emit = defineEmits<{ navigate: [path: string] }>();
const comparison = ref<EtfComparison | null>(null);
const coverageDetail = ref<EtfCoverageResponse | null>(null);
const error = ref("");
const { isAuthenticated, signUp } = useAuth();
const examplePath = "/compare/etfs?type=tw&codes=00981A,00982A";
const sources = configuredEtfs.filter((row) => ["00981A", "00982A"].includes(row.etfCode));

function compare(): void {
  comparisonRequests.begin("tw", ["00981A", "00982A"], "start_primary");
  emit("navigate", examplePath);
}

onMounted(async () => {
  try {
    comparison.value = await getJson<EtfComparison>("/api/compare/etfs?type=tw&codes=00981A%2C00982A");
    if (comparison.value.cards.length >= 2) trackPreviewLoaded();
    if (comparison.value.sourceAsOf) {
      coverageDetail.value = await getJson<EtfCoverageResponse>(`/api/etfs/coverage?date=${comparison.value.sourceAsOf}`).catch(() => null);
    }
  } catch {
    error.value = "即時研究範例暫時無法載入，仍可前往比較工具重新嘗試。";
  }
});
</script>

<template>
  <div class="start-page">
    <section class="start-hero">
      <div class="hero-copy">
        <p class="eyebrow">ETF 持倉雷達 · 免費研究示範</p>
        <h1>看懂 ETF 持股差異，讓研究有依據</h1>
        <p class="lead">比較持股、查看調倉變化，並核對資料日期與缺口。先試用公開研究結果，再決定是否建立帳號。</p>
        <div class="actions">
          <button type="button" class="primary" @click="compare"><GitCompareArrows :size="19" />立即比較 ETF</button>
          <button v-if="!isAuthenticated" type="button" class="secondary" @click="signUp('start_secondary')">免費建立研究帳號<ArrowRight :size="18" /></button>
        </div>
        <p class="account-note"><ShieldCheck :size="17" />ETF 持倉雷達使用 GoGoWinners 共用帳號登入。</p>
      </div>
      <div class="research-preview" aria-label="00981A 與 00982A 真實比較資料預覽">
        <div class="preview-top"><span>實際產品研究範例</span><span>00981A × 00982A</span></div>
        <template v-if="comparison">
          <div class="preview-date">持股資料日 <strong>{{ comparison.sourceAsOf ?? '未知' }}</strong><span>資料覆蓋 {{ comparison.coverage.available }} / {{ comparison.coverage.tracked }} 檔</span></div>
          <div class="preview-cards"><article v-for="card in comparison.cards" :key="card.code"><small>{{ card.issuer }}</small><strong>{{ card.code }}</strong><span>{{ card.name }}</span><b>{{ card.holdingCount }} 檔持股</b></article></div>
          <p v-if="comparison.pairwise[0] && !('memberLocked' in comparison.pairwise[0])" class="preview-result">兩檔共同持股 {{ comparison.pairwise[0].intersectionCount }} 檔；權重與調倉細節請進入比較頁核對。</p>
          <p class="preview-caveat">{{ comparison.confidence.reason }}。未取得資料不代表持股為零；完整頁面會標示遮隱項目與計算方式。</p>
          <p class="preview-caveat">系統計算時間 {{ new Date(comparison.generatedAt).toLocaleString('zh-TW', { hour12: false }) }}。</p>
          <details v-if="coverageDetail?.etfs.some((row) => !row.hasSelectedDate)" class="coverage-details"><summary>查看 {{ coverageDetail.trackedCount - coverageDetail.availableCount }} 檔資料缺口</summary><p>這些基金在選定資料日沒有摘要；目前 API 僅能確認最近資料日，未提供未揭露、抓取或排程失敗的確切原因。</p><ul><li v-for="row in coverageDetail.etfs.filter((item) => !item.hasSelectedDate)" :key="row.etfCode">{{ row.etfCode }} {{ row.issuer }}：最近 {{ row.latestTradeDate ?? '未知' }}（{{ row.status === 'stale' ? '資料延遲' : row.status === 'missing' ? '尚無資料' : '其他日期有資料' }}）</li></ul></details>
        </template>
        <p v-else class="preview-loading" role="status">{{ error || '載入公開比較資料中…' }}</p>
        <button type="button" class="preview-link" @click="compare">操作完整比較 <ArrowRight :size="16" /></button>
      </div>
    </section>

    <section class="start-context">
      <div><h2>先看資料，再看方法</h2><p>未登入即可查看公開的比較摘要與部分持股。登入後依目前權限顯示更多研究細節；遮隱資料會明確標示。</p></div>
      <div><h2>核對來源與日期</h2><p>比較結果提供持股資料日、系統計算時間與涵蓋檔數。台灣市場預設選最近達 70% 覆蓋率的資料日；缺漏原因仍需逐檔核對。</p></div>
      <div><h2>用 AI 延伸研究</h2><p>MCP 提供資料，Skill 提供研究流程。先完成比較，再依你的工具選擇是否使用 Skill。</p><a href="https://active-etf-mcp.inthewins.com/zh-TW/mcp/skill">了解 Skill 與研究範例</a></div>
    </section>
    <p class="source-note">來源：<a v-for="source in sources" :key="source.etfCode" :href="source.source.infoUrl" target="_blank" rel="noopener noreferrer">{{ source.issuer }} {{ source.etfCode }}</a>。本站依公開資料整理，僅供資訊研究，不構成投資建議。</p>
  </div>
</template>

<style scoped>
.start-page{display:grid;gap:26px}.start-hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(370px,.92fr);gap:30px;align-items:center;padding:clamp(24px,4vw,54px);border-radius:22px;background:radial-gradient(circle at 83% 20%,#1b776d 0,#103e50 44%,#0a273c 100%);color:#fff}.hero-copy{max-width:620px}.eyebrow{color:#8de2d5;font-size:13px;font-weight:800;letter-spacing:.1em}.hero-copy h1{margin:14px 0;font-size:clamp(33px,4.6vw,58px);line-height:1.13}.lead{max-width:560px;color:#e0edee;font-size:clamp(16px,1.6vw,19px);line-height:1.75}.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:30px}.actions button,.preview-link{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:50px;padding:0 20px;border-radius:10px;font:inherit;font-weight:800;cursor:pointer}.primary{border:1px solid #83ecdc;background:#7be5d4;color:#103b43}.secondary{border:1px solid #aacbd1;background:transparent;color:#fff}.account-note{display:flex;align-items:center;gap:7px;margin:17px 0 0;color:#cee0e3;font-size:13px}.research-preview{display:grid;gap:16px;min-height:360px;padding:23px;border:1px solid #bfd9dc;border-radius:17px;background:#f8fcfb;color:#193e4a;box-shadow:0 22px 55px #09243255}.preview-top{display:flex;justify-content:space-between;gap:10px;color:#0d7770;font-size:12px;font-weight:850}.preview-date{display:flex;flex-wrap:wrap;gap:8px;align-items:baseline;color:#536b75;font-size:13px}.preview-date strong{color:#153e4e;font-size:18px}.preview-date span{margin-left:auto}.preview-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.preview-cards article{display:grid;gap:5px;min-width:0;padding:15px;border:1px solid #d3e1e2;border-radius:12px;background:#fff}.preview-cards small{color:#607a82}.preview-cards strong{font-size:26px}.preview-cards span{min-height:35px;line-height:1.45}.preview-cards b{color:#0c756e;font-size:13px}.preview-result{margin:0;font-weight:780}.preview-caveat,.preview-loading{margin:0;color:#5b7078;font-size:12px;line-height:1.55}.preview-link{justify-self:start;min-height:42px;padding:0;border:0;background:transparent;color:#08776e}.start-context{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.start-context>div{padding:24px;border:1px solid var(--theme-border);border-radius:14px;background:var(--theme-surface)}.start-context h2{margin:0 0 10px;color:var(--theme-text-strong);font-size:19px}.start-context p{margin:0;color:var(--theme-text-muted);line-height:1.7}.start-context a{display:inline-block;margin-top:12px;color:#08776e;font-weight:800}.source-note{display:flex;flex-wrap:wrap;gap:6px;margin:0;color:var(--theme-text-muted);font-size:12px;line-height:1.7}.source-note a{color:#08776e}
.coverage-details{color:#4c6570;font-size:12px;line-height:1.55}.coverage-details summary{cursor:pointer;color:#0b6b65;font-weight:800}.coverage-details p{margin:7px 0}.coverage-details ul{display:grid;gap:3px;max-height:130px;overflow:auto;margin:0;padding-left:20px}
@media(max-width:850px){.start-hero{grid-template-columns:1fr}.research-preview{min-height:0}.start-context{grid-template-columns:1fr}}
@media(max-width:550px){.start-hero{padding:25px 18px;gap:24px}.actions{display:grid}.actions button{width:100%}.account-note{align-items:flex-start;line-height:1.5}.preview-date span{margin-left:0}.research-preview{padding:17px}.preview-cards article{padding:11px}.preview-cards strong{font-size:21px}}
</style>
