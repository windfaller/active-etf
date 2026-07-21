import { defineConfig } from "playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "p0-preview.spec.ts",
  timeout: 30_000,
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:4176",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "npm run web:build && npm run web:preview:static -- --port 4176",
    url: "http://127.0.0.1:4176",
    reuseExistingServer: false,
    timeout: 30_000
  }
});
