import type { EtfHoldingChange } from "../../models/EtfHoldingChange.js";

export interface DailyDigest {
  etfCode: string;
  etfName: string;
  tradeDate: string;
  topActiveIncreases: EtfHoldingChange[];
  topActiveDecreases: EtfHoldingChange[];
  newHoldings: EtfHoldingChange[];
  exitedHoldings: EtfHoldingChange[];
  warnings?: string[];
}

export interface NotificationService {
  sendDailyDigest(input: DailyDigest): Promise<void>;
}
