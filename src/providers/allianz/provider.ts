import { createPendingProvider } from "../pendingProvider.js";
import { allianzEtfs } from "./types.js";

export const allianzProvider = createPendingProvider("allianz", allianzEtfs);
