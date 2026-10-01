import { app } from "@azure/functions";
import { sendDueRegistrationEvents } from "../services/auth/registrationMeta.js";

if (process.env.ACTIVE_ETF_CAPI_ENABLED === "true") {
  app.timer("activeEtfRegistrationMeta", { schedule: "0 */1 * * * *", handler: async (_timer, context) => {
    const result = await sendDueRegistrationEvents();
    context.log("ETF registration CAPI delivery counts", result);
  } });
}
