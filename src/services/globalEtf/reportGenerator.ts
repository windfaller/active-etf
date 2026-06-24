import type {
  GlobalEtfDailyReport,
  GlobalEtfHolding,
  GlobalEtfHoldingChange,
  GlobalEtfReportSection,
  GlobalEtfSnapshot
} from "../../models/GlobalEtf.js";

function fmtWeight(value?: number): string {
  return value === undefined ? "-" : `${value.toFixed(1)}%`;
}

function fmtPp(value?: number): string {
  if (value === undefined) return "-";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}pp`;
}

function fmtStatus(status: string): string {
  if (status === "ok") return "成功";
  if (status === "stale") return "資料過期";
  if (status === "unavailable") return "來源不可用";
  return "錯誤";
}

function holdingName(holding: Pick<GlobalEtfHolding, "ticker" | "name">): string {
  return `${holding.ticker ? `<strong>${holding.ticker}</strong><br />` : ""}<span>${holding.name}</span>`;
}

function changeName(change: Pick<GlobalEtfHoldingChange, "ticker" | "name">): string {
  return `${change.ticker ? `<strong>${change.ticker}</strong><br />` : ""}<span>${change.name}</span>`;
}

function table(headers: string[], rows: string[][]): string {
  if (!rows.length) return "";
  return `
    <table style="width:100%;border-collapse:collapse;margin:10px 0 18px;font-size:15px;">
      <thead>
        <tr>${headers.map((header) => `<th style="padding:9px 8px;text-align:left;background-color:#f3f4f6;color:#374151;border-bottom:1px solid #e5e7eb;">${header}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) =>
              `<tr>${row
                .map((cell, index) => `<td style="padding:10px 8px;border-bottom:1px solid #edf0f3;color:#111827;${index > 1 ? "text-align:right;" : ""}">${cell}</td>`)
                .join("")}</tr>`
          )
          .join("")}
      </tbody>
    </table>`;
}

function renderHtml(report: Omit<GlobalEtfDailyReport, "html">): string {
  return `<!doctype html>
  <html lang="zh-Hant">
    <body style="margin:0;background-color:#f3f4f6;color:#111827;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC','Microsoft JhengHei',sans-serif;font-size:16px;line-height:1.55;">
      <div style="max-width:680px;margin:0 auto;background-color:#ffffff;">
        <header style="background-color:#111827;color:#ffffff;padding:24px 20px;">
          <h1 style="margin:0 0 8px;font-size:24px;line-height:1.25;color:#ffffff;">ETF 官方持股變化日報</h1>
          <p style="margin:0;color:#d1d5db;">${report.reportDate}｜涵蓋 ${report.coveredEtfs.join("、")}</p>
        </header>
        <main style="padding:20px;">
          <section>
            <h2 style="font-size:19px;margin:0 0 10px;color:#111827;">今天重點</h2>
            <ul style="padding-left:20px;margin:0 0 14px;">
              ${report.highlights.map((highlight) => `<li style="margin:6px 0;">${highlight}</li>`).join("")}
            </ul>
            ${table(
              ["ETF", "資料日期", "筆數", "狀態"],
              report.statusRows.map((row) => [row.etfCode, row.sourceAsOf || "-", String(row.rowCount), fmtStatus(row.sourceStatus)])
            )}
          </section>
          <aside style="margin:18px 0;padding:14px 16px;border:1px solid #d7e0ea;background-color:#f8fafc;">
            <strong style="display:block;margin-bottom:4px;color:#0f172a;">Forvix 市場事件觀察</strong>
            <span style="color:#475569;">海外 ETF 變化可搭配 AI、半導體、Fed、BTC ETF 與事件市場情緒追蹤；本區為獨立廣告內容，非投資建議。</span>
          </aside>
          ${
            report.globalMovers.length
              ? `<section>
                  <h2 style="font-size:19px;margin:0 0 10px;color:#111827;">全體最大權重變化</h2>
                  ${table(
                    ["ETF", "標的", "權重", "變化"],
                    report.globalMovers.slice(0, 8).map((row) => [
                      row.etfCode,
                      changeName(row),
                      fmtWeight(row.currentWeightPercent),
                      `<span style="color:${(row.deltaPp ?? 0) >= 0 ? "#047857" : "#b91c1c"};">${fmtPp(row.deltaPp)}</span>`
                    ])
                  )}
                </section>`
              : ""
          }
          ${report.sections
            .map(
              (section) => `
              <section style="margin-top:24px;">
                <h2 style="font-size:20px;margin:0 0 4px;color:#111827;">${section.etfCode} ${section.fundName}</h2>
                <p style="margin:0 0 10px;color:#4b5563;">${section.takeaway}</p>
                <p style="margin:0 0 12px;color:#6b7280;">資料日期 ${section.sourceAsOf || "-"}｜${section.rowCount} 筆</p>
                ${
                  section.weightChanges.length
                    ? table(
                        ["標的", "目前權重", "前次權重", "變化"],
                        section.weightChanges.slice(0, 6).map((row) => [
                          changeName(row),
                          fmtWeight(row.currentWeightPercent),
                          fmtWeight(row.prevWeightPercent),
                          fmtPp(row.deltaPp)
                        ])
                      )
                    : ""
                }
                <h3 style="font-size:17px;margin:12px 0 8px;color:#111827;">Top 10 持股</h3>
                ${table(
                  ["標的", "產業", "權重", "市值"],
                  section.topHoldings.slice(0, 10).map((row) => [
                    holdingName(row),
                    row.sector ?? row.assetType ?? "-",
                    fmtWeight(row.weightPercent),
                    row.marketValue === undefined ? "-" : Math.round(row.marketValue).toLocaleString("en-US")
                  ])
                )}
              </section>`
            )
            .join("")}
          <section style="margin-top:24px;">
            <h2 style="font-size:18px;margin:0 0 10px;color:#111827;">官方來源</h2>
            <ul style="padding-left:20px;margin:0;">
              ${report.sections
                .map((section) => `<li style="margin:6px 0;"><a href="${section.sourceUrl}" style="color:#1d4ed8;">${section.etfCode} official holdings source</a></li>`)
                .join("")}
            </ul>
          </section>
        </main>
      </div>
    </body>
  </html>`;
}

export function buildGlobalEtfDailyReport(input: Omit<GlobalEtfDailyReport, "html">): GlobalEtfDailyReport {
  return {
    ...input,
    html: renderHtml(input)
  };
}

export function buildTakeaway(section: Pick<GlobalEtfReportSection, "strategyType" | "weightChanges" | "newPositions" | "exitedPositions">): string {
  const biggest = section.weightChanges[0];
  const noun = section.strategyType === "active" || section.strategyType === "covered_call" ? "經理人主題移動" : "持倉權重變化";
  if (biggest?.deltaPp !== undefined) {
    return `${noun}以 ${biggest.ticker ?? biggest.name} 最明顯，權重變化 ${fmtPp(biggest.deltaPp)}。`;
  }
  if (section.newPositions.length || section.exitedPositions.length) {
    return `${noun}主要出現在新增 ${section.newPositions.length} 檔、清倉 ${section.exitedPositions.length} 檔。`;
  }
  return `本次未偵測到達門檻的${noun}。`;
}
