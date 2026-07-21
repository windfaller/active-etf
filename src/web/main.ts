import { createApp } from "vue";
import App from "./App.vue";
import { reloadWhenAppVersionChanges } from "./cacheVersion";
import { initializeColorMode } from "./composables/useColorMode";
import "./styles.css";

initializeColorMode();

void reloadWhenAppVersionChanges()
  .then((isReloading) => {
    if (!isReloading) createApp(App).mount("#app");
  })
  .catch(() => {
    createApp(App).mount("#app");
  });
