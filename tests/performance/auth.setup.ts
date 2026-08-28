import { chromium } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const authFile = path.join(__dirname, ".auth", "user.json");

export default async function globalSetup() {
  const testEmail = process.env.E2E_TEST_EMAIL?.trim();
  const testPassword = process.env.E2E_TEST_PASSWORD;

  if (!testEmail || !testPassword) {
    throw new Error(
      "E2E_TEST_EMAIL and E2E_TEST_PASSWORD are required to run authenticated E2E tests.",
    );
  }

  fs.mkdirSync(path.dirname(authFile), { recursive: true });

  const baseUrl = process.env.BASE_URL || "https://totem-os.vercel.app";

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 393, height: 851 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  console.log("🔐 Logging in E2E test user...");

  await page.goto(`${baseUrl}/sign-in`, { waitUntil: "domcontentloaded" });
  const emailInput = page.locator('input[name="email"]');
  await emailInput.waitFor({ state: "visible" });
  await emailInput.fill(testEmail);
  await page.fill('input[name="password"]', testPassword);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/", { timeout: 30_000 });

  console.log("✅ Login OK, saving state");
  await context.storageState({ path: authFile });

  await browser.close();
}
