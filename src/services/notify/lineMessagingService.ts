import type { DailyDigest, NotificationService } from "./notificationService.js";

export class LineMessagingService implements NotificationService {
  async sendDailyDigest(_input: DailyDigest): Promise<void> {
    throw new Error("LINE Messaging API notification is not implemented in the MVP.");
  }
}
