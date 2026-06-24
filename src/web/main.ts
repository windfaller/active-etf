import { createApp } from "vue";
import App from "./App.vue";
import { reloadWhenAppVersionChanges } from "./cacheVersion";
import "./styles.css";

void reloadWhenAppVersionChanges()
  .then((isReloading) => {
    if (!isReloading) createApp(App).mount("#app");
  })
  .catch(() => {
    createApp(App).mount("#app");
  });
