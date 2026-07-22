import { createApp } from "vue";
import App from "./App.vue";
import { installAppVersionWatcher } from "./cacheVersion";
import { initializeColorMode } from "./composables/useColorMode";
import "./styles.css";

initializeColorMode();

const app = createApp(App);
app.mount("#app");
const stopAppVersionWatcher = installAppVersionWatcher();
const unmount = app.unmount.bind(app);
app.unmount = () => {
  stopAppVersionWatcher();
  unmount();
};
