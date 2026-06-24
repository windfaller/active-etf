import { defineConfig, type ViteDevServer, type Plugin } from "vite";
import vue from "@vitejs/plugin-vue";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const appVersion = process.env.GITHUB_SHA ?? process.env.BUILD_VERSION ?? String(Date.now());

function appVersionPlugin(): Plugin {
  const payload = JSON.stringify({ version: appVersion }, null, 2);

  return {
    name: "app-version",
    configureServer(server: ViteDevServer) {
      server.middlewares.use("/app-version.json", (_req, res) => {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
        res.end(payload);
      });
    },
    closeBundle() {
      const outDir = resolve(process.cwd(), "dist");
      mkdirSync(outDir, { recursive: true });
      writeFileSync(resolve(outDir, "app-version.json"), `${payload}\n`);
    }
  };
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion)
  },
  plugins: [vue(), appVersionPlugin()],
  server: {
    port: 5173,
    strictPort: false
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
