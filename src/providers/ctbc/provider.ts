import { createPendingProvider } from "../pendingProvider.js";
import { ctbcEtfs } from "./types.js";

export const ctbcProvider = createPendingProvider("ctbc", ctbcEtfs);
