import { createPendingProvider } from "../pendingProvider.js";
import { yuantaEtfs } from "./types.js";

export const yuantaProvider = createPendingProvider("yuanta", yuantaEtfs);
