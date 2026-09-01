import { createApp } from "vue";
import App from "./App.vue";
import { trackFeatureInteraction, trackInitialPageView } from "./analytics";
import { startAppVersionMonitor } from "./cacheVersion";
import { initializeColorMode } from "./composables/useColorMode";
import { initializeTrackingConsent, installImpliedTrackingConsent } from "./consent";
import "./styles.css";

initializeColorMode();
initializeTrackingConsent();
installImpliedTrackingConsent(trackFeatureInteraction);
trackInitialPageView(window.location.pathname);

createApp(App).mount("#app");

const idleWindow = window as Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
};
const checkVersion = () => void startAppVersionMonitor();
if (idleWindow.requestIdleCallback) idleWindow.requestIdleCallback(checkVersion, { timeout: 2500 });
else window.setTimeout(checkVersion, 800);
