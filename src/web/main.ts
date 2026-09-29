import { createApp } from "vue";
import App from "./App.vue";
import { captureCampaign, clearCampaign } from "./attribution";
import { trackAgentPortalPageView, trackFeatureInteraction, trackInitialPageView } from "./analytics";
import { startAppVersionMonitor } from "./cacheVersion";
import { initializeColorMode } from "./composables/useColorMode";
import { initializeTrackingConsent, installImpliedTrackingConsent, TRACKING_CONSENT_CHANGED_EVENT } from "./consent";
import "./styles.css";

initializeColorMode();

const initialTrackingConsent = initializeTrackingConsent();
if (initialTrackingConsent === "granted") captureCampaign(window.location.search);
window.addEventListener(TRACKING_CONSENT_CHANGED_EVENT, (event) => {
  const consent = (event as CustomEvent<{consent: string}>).detail?.consent;
  if (consent === "granted") captureCampaign(window.location.search);
  if (consent === "denied") clearCampaign();
});
if (/^\/(en|zh-TW|zh-CN|ja|ko)\/mcp(?:\/(?:skill|connect))?\/?$/.test(window.location.pathname)) {
  trackAgentPortalPageView(window.location.href);
  let trackedPageAfterConsent = initialTrackingConsent === "granted";
  installImpliedTrackingConsent((interaction) => {
    trackFeatureInteraction(interaction);
    if (trackedPageAfterConsent) return;
    trackedPageAfterConsent = true;
    trackAgentPortalPageView(window.location.href);
  });
  void import("./agent/AgentPortal.vue").then(({default: AgentPortal}) => createApp(AgentPortal).mount("#app"));
} else {
  installImpliedTrackingConsent((interaction) => {
    captureCampaign(window.location.search);
    trackFeatureInteraction(interaction);
  });
  trackInitialPageView(window.location.pathname);
  createApp(App).mount("#app");
}

const idleWindow = window as Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
};
const checkVersion = () => void startAppVersionMonitor();
if (idleWindow.requestIdleCallback) idleWindow.requestIdleCallback(checkVersion, { timeout: 2500 });
else window.setTimeout(checkVersion, 800);
