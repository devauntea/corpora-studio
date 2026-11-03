import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://127.0.0.1:1420",
    viewport: { width: 1440, height: 940 },
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:1420",
    reuseExistingServer: true,
  },
});
