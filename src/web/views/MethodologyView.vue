<script setup lang="ts">
const sections = [
  { title: "拉推 v2.1 資料分層", fact: "忠實四榜、ETF 流量校正、投信獨立因子、拉力與第二階段交易閘門是不同層次。", calculation: "完整版 Push_v2_1 = 投信 35 + ETF 45 + 真正跨來源共振 20；拉推核心分 = sqrt(拉力 × 推力)。", limit: "首頁目前只展示已可驗證的前置資金證據。缺分析師共識、自由流通量、ADV20、經理人 ID 或公開時點時，不生成 v2.1 可交易分。" },
  { title: "主動淨變動與基金規模校正", fact: "表面張數變動是兩個有效交易日公開持股差額。", calculation: "預期持股 = 前期持股 × 本期受益權單位數 / 前期受益權單位數；主動淨變動 = 本期持股 − 預期持股。", limit: "缺少基金規模或前期資料時不以表面變動假裝為完整規模校正。" },
  { title: "投信與 ETF 獨立計分", fact: "投信買賣超與主動 ETF 調倉是兩個獨立資金來源。", calculation: "投信完整因子需連買、3/5 日強度、持股比變化、買超/自由流通股與買超金額/ADV20；ETF 因子需流量校正、ETF/經理人 breadth 與 single-source cap。", limit: "單日投信買超只能標示同向或分歧，不足以代表 Institution_35。同投信旗下多檔 ETF 不當成完全獨立來源。" },
  { title: "跨 ETF 共識", fact: "increase、decrease、neutral 與 unknown 分開計數。", calculation: "同方向至少 2 檔、同方向多於反方向，且同方向 / directional ETF ≥ 60%。neutral 不進入分母，但會另外顯示。", limit: "共識描述目前追蹤 ETF 的共同方向，不代表市場全部資金。" },
  { title: "3／5／20 日連續與反轉", fact: "window 使用有效市場交易日，不使用日曆天；API 同時回傳實際與缺失觀察數。", calculation: "主動張數跨過 ±0.01 張時以張數決定方向；張數在門檻內才使用權重 ±0.0001 pp。兩者都未跨門檻才是 neutral，缺少該 ETF 當日紀錄是 unknown。neutral 與 unknown 都中斷連續訊號。", limit: "來源延遲或缺失日不會被補成零；例如 20 日中只有 17 日有紀錄，顯示有效觀察 17/20 並降低信心。" },
  { title: "張數與權重方向衝突", fact: "主動張數與權重變化會各自保留，不以任一欄覆蓋另一欄。", calculation: "兩者都顯著且方向相反時，最終方向仍依主動張數，另回傳 directionConflict。", limit: "方向衝突會顯示「方向指標分歧」、寫入信心原因，且不可判為高信心。" },
  { title: "ETF 與三大法人一致／分歧", fact: "法人買賣超來自公開交易日資料。", calculation: "ETF 加碼 + 法人買超、ETF 減碼 + 法人賣超為一致；反向組合為分歧。", limit: "任一側缺資料、neutral 或法人合計為零時標示資料不足。" },
  { title: "持股集合與權重重疊", fact: "集合重疊顯示 intersection count 與 Jaccard similarity；台灣調整廣度欄位是持股變動資料列筆數。", calculation: "Jaccard = 交集 / 聯集；Weighted overlap = Σ min(weightA, weightB)。調整廣度使用 increaseHoldingChangeCount／decreaseHoldingChangeCount。", limit: "缺權重持股只進入集合重疊。海外 positionKey 會和 assetType 合併識別，Equity、Swap、Cash 不靜默合併。" },
  { title: "海外 ETF 反查與比較資料日", fact: "股票反查先為每檔 ETF／機構選出最新有效快照，再檢查該 ticker 是否仍在持股。", calculation: "舊快照曾持有、最新快照已退出的 ticker 不會出現在現況反查。海外比較逐檔顯示 sourceAsOf 與 fetchedAt。", limit: "海外 ETF 更新頻率不同；資料日不一致時標示「非共同資料日」，不可當成同日橫截面比較。" },
  { title: "經理人風格指標", fact: "集中度使用前 5、前 10 權重與 HHI；調整廣度使用每日加碼、減碼、新增與退出檔數。", calculation: "調整強度 = Σ |weight change| / 2；持股穩定度 = 期初持股中仍出現在期末的比例。", limit: "百分位樣本少於 5 檔不顯示；數值高低不代表經理人優劣。" },
  { title: "資料可信度", fact: "每個 API 顯示 tracked、available、delayed 與 sourceAsOf。", calculation: "高／中／低依涵蓋率、規模校正完整度、實際觀察期、延遲、單一 ETF 主導程度、同方向比例與方向衝突判定，並附文字原因。", limit: "缺失觀察或張數／權重方向衝突會降級；本站不使用無方法論的神秘分數。" },
  { title: "13F 時間限制與缺失資料", fact: "13F 分別標示持倉截止日、SEC 申報日與系統取得時間。", calculation: "13F 季度持倉變化只在季度尺度比較，不與 ETF 每日持股加總。", limit: "13F 不代表目前即時部位；未知值保留為未知，不以零替代。" }
];
</script>

<template>
  <section class="methodology-view"><header><span>研究方法</span><h1>情報指標方法論與限制</h1><p>本站區分「可觀察事實」、「系統計算結果」與「研究解讀」。所有結果只供研究使用，不預測未來報酬，也不構成投資建議。</p></header><section class="method-grid"><article v-for="section in sections" :key="section.title"><h2>{{ section.title }}</h2><dl><div><dt>可觀察事實</dt><dd>{{ section.fact }}</dd></div><div><dt>系統計算</dt><dd>{{ section.calculation }}</dd></div><div><dt>限制與解讀</dt><dd>{{ section.limit }}</dd></div></dl></article></section></section>
</template>

<style scoped>
.methodology-view{display:grid;gap:16px}.methodology-view>header{padding:30px;border-radius:15px;background:linear-gradient(135deg,#133248,#0e665f);color:#fff}.methodology-view>header span{color:#65dfd2;font-size:12px;font-weight:850;letter-spacing:.13em}.methodology-view h1{margin:8px 0;font-size:35px}.methodology-view>header p{max-width:850px;margin:0;color:#d9e9eb;line-height:1.7}.method-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.method-grid article{padding:20px;border:1px solid var(--theme-border);border-radius:13px;background:var(--theme-surface)}.method-grid h2{margin:0 0 14px;color:var(--theme-text-strong);font-size:19px}.method-grid dl{display:grid;gap:10px;margin:0}.method-grid dl>div{display:grid;grid-template-columns:100px 1fr;gap:10px;padding-top:10px;border-top:1px solid var(--theme-border)}.method-grid dt{color:#087b72;font-size:12px;font-weight:800}.method-grid dd{margin:0;color:var(--theme-text-muted);line-height:1.65}
@media(max-width:720px){.methodology-view>header{padding:23px 18px}.methodology-view h1{font-size:28px}.method-grid{grid-template-columns:1fr}.method-grid article{padding:17px 14px}.method-grid dl>div{grid-template-columns:1fr}}
</style>
