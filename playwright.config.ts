import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "WATCHPACK_POLLING=true pnpm dev --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100/data",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
