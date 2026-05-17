import { createPendingProvider } from "../pendingProvider.js";
import { jpmorganEtfs } from "./types.js";

export const jpmorganProvider = createPendingProvider("jpmorgan", jpmorganEtfs);
