import { createPendingProvider } from "../pendingProvider.js";
import { fhEtfs } from "./types.js";

export const fhProvider = createPendingProvider("fh", fhEtfs);
