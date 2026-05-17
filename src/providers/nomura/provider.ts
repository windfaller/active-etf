import { createPendingProvider } from "../pendingProvider.js";
import { nomuraEtfs } from "./types.js";

export const nomuraProvider = createPendingProvider("nomura", nomuraEtfs);
