import { defineConfig, devices } from "@playwright/test";
import path from "path";

export default defineConfig({
  testDir: "./tests/performance/specs",
  testMatch: /.*\.spec\.ts$/,
  timeout: 120_000,
  retries: 1,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  globalSetup: "./tests/performance/auth.setup.ts",
  use: {
    baseURL: "https://totem-os.vercel.app",
    headless: true,
    storageState: path.join(__dirname, "tests/performance/.auth/user.json"),
  },
  projects: [
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],
});
