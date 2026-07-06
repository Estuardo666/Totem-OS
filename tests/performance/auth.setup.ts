import { chromium } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const authFile = path.join(__dirname, ".auth", "user.json");

export default async function globalSetup() {
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

  console.log("🔐 Logging in test@totem.com...");

  await page.goto(`${baseUrl}/sign-in`);
  await page.waitForLoadState("networkidle");
  await page.fill('input[name="email"]', "test@totem.com");
  await page.fill('input[name="password"]', "1234567890@@");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/", { timeout: 30_000 });

  console.log("✅ Login OK, saving state");
  await context.storageState({ path: authFile });

  await browser.close();
}
