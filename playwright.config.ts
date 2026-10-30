import { defineConfig } from "@playwright/test";
const port = 4187;
const base = process.env.BASE_PATH || "/";
export default defineConfig({
  testDir: "tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:" + port + base,
    viewport: { width: 390, height: 844 },
  },
  webServer: {
    command: "npm run preview -- --port " + port + " --strictPort",
    url: "http://127.0.0.1:" + port + base,
    reuseExistingServer: false,
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    {
      name: "webkit-mobile",
      testMatch: "**/mobile-layout.spec.ts",
      use: { browserName: "webkit", isMobile: true, hasTouch: true },
    },
  ],
});
