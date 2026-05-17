import { createPendingProvider } from "../pendingProvider.js";
import { firstEtfs } from "./types.js";

export const firstProvider = createPendingProvider("first", firstEtfs);
