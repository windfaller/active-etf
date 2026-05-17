import { createPendingProvider } from "../pendingProvider.js";
import { cathayEtfs } from "./types.js";

export const cathayProvider = createPendingProvider("cathay", cathayEtfs);
