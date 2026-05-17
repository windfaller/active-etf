import { createPendingProvider } from "../pendingProvider.js";
import { taishinEtfs } from "./types.js";

export const taishinProvider = createPendingProvider("taishin", taishinEtfs);
