import { createPendingProvider } from "../pendingProvider.js";
import { capitalEtfs } from "./types.js";

export const capitalProvider = createPendingProvider("capital", capitalEtfs);
