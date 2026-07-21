import { createApp } from "vue";
import App from "./App.vue";
import { reloadWhenAppVersionChanges } from "./cacheVersion";
import { initializeColorMode } from "./composables/useColorMode";
import "./styles.css";

initializeColorMode();

createApp(App).mount("#app");

const idleWindow = window as Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
};
const checkVersion = () => void reloadWhenAppVersionChanges();
if (idleWindow.requestIdleCallback) idleWindow.requestIdleCallback(checkVersion, { timeout: 2500 });
else window.setTimeout(checkVersion, 800);
