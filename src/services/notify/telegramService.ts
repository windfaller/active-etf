import type { DailyDigest, NotificationService } from "./notificationService.js";

function formatChange(change: DailyDigest["topActiveIncreases"][number]): string {
  const lots = change.activeDiffLots ?? change.diffLots;
  const weight = change.diffWeightPoint === null ? "權重 -" : `權重 ${change.diffWeightPoint.toFixed(2)}%`;
  const score = change.activeSignalScore === null ? "分數 -" : `分數 ${change.activeSignalScore}`;
  return `${change.stockName} ${change.stockId}: ${lots.toFixed(0)} 張，${weight}，${score}`;
}

export class TelegramService implements NotificationService {
  constructor(
    private readonly botToken = process.env.TELEGRAM_BOT_TOKEN,
    private readonly chatId = process.env.TELEGRAM_CHAT_ID
  ) {}

  async sendDailyDigest(input: DailyDigest): Promise<void> {
    if (!this.botToken || !this.chatId) {
      throw new Error("TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are required");
    }

    const message = [
      `${input.etfCode} ${input.etfName}｜每日調倉雷達`,
      `日期：${input.tradeDate}`,
      "",
      "真正主動加碼排行：",
      ...input.topActiveIncreases.slice(0, 10).map((change, index) => `${index + 1}. ${formatChange(change)}`),
      "",
      "真正主動減碼排行：",
      ...input.topActiveDecreases.slice(0, 10).map((change, index) => `${index + 1}. ${formatChange(change)}`),
      "",
      "新增持股：",
      ...input.newHoldings.map((change) => `- ${change.stockName} ${change.stockId}`),
      "",
      "清倉持股：",
      ...input.exitedHoldings.map((change) => `- ${change.stockName} ${change.stockId}`),
      "",
      "註：主動加碼已依 ETF 發行單位數變化進行校正。本資料僅供資訊研究使用，不構成投資建議。",
      ...(input.warnings?.length ? ["", "Warnings:", ...input.warnings.map((warning) => `- ${warning}`)] : [])
    ].join("\n");

    const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: this.chatId,
        text: message
      })
    });

    if (!response.ok) {
      throw new Error(`Telegram send failed: ${response.status} ${await response.text()}`);
    }
  }
}
