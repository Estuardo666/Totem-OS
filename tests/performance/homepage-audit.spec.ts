import { test, expect } from "@playwright/test";
import { playAudit } from "playwright-lighthouse";
import * as fs from "fs";

const BLOCKED = [
  "**/pusher.js",
  "**/pusher-js/**",
  "https://cdn.onesignal.com/**",
  "https://api.onesignal.com/**",
  "https://*.onesignal.com/**",
];

test.describe("Homepage Mobile Performance", () => {
  test.beforeEach(async ({ page }) => {
    for (const pattern of BLOCKED) {
      await page.route(pattern, (route) => route.abort());
    }
  });

  test("Lighthouse Core Web Vitals", async ({ page }, testInfo) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const { lhr } = await playAudit({
      page,
      port: 9222,
      thresholds: { performance: 70 },
      config: {
        extends: "lighthouse:default",
        settings: {
          formFactor: "mobile",
          throttling: {
            rttMs: 150,
            throughputKbps: 1638.4,
            cpuSlowdownMultiplier: 4,
          },
          onlyCategories: ["performance", "accessibility", "best-practices"],
          locale: "es",
        },
      },
      reports: {
        formats: { html: true },
        name: "lighthouse-homepage-mobile",
        directory: "reports",
      },
    });

    const lcp = lhr.audits["largest-contentful-paint"]?.numericValue ?? 99999;
    const cls = lhr.audits["cumulative-layout-shift"]?.numericValue ?? 999;
    const tbt = lhr.audits["total-blocking-time"]?.numericValue ?? 99999;
    const si = lhr.audits["speed-index"]?.numericValue ?? 99999;
    const perfScore = (lhr.categories.performance?.score ?? 0) * 100;

    console.log("\n=== Core Web Vitals ===");
    console.log(`LCP:   ${lcp}ms    ${lcp < 2500 ? "OK" : "WARN"}`);
    console.log(`CLS:   ${cls}      ${cls < 0.1 ? "OK" : "WARN"}`);
    console.log(`TBT:   ${tbt}ms    ${tbt < 200 ? "OK" : "WARN"}`);
    console.log(`SI:    ${si}ms    ${si < 2000 ? "OK" : "WARN"}`);
    console.log(`Score: ${perfScore}     ${perfScore >= 70 ? "OK" : "WARN"}`);
    console.log("=====================\n");

    testInfo.attach("lighthouse-report", {
      path: "reports/lighthouse-homepage-mobile.html",
      contentType: "text/html",
    });

    expect(lcp).toBeLessThan(2500);
    expect(cls).toBeLessThan(0.1);
    expect(tbt).toBeLessThan(200);
    expect(si).toBeLessThan(2000);
    expect(perfScore).toBeGreaterThanOrEqual(70);
  });

  test("Page renders key sections", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("text=Hola,").first()).toBeVisible();
    await expect(page.locator("text=Acciones Rápidas").first()).toBeVisible();
    await expect(page.locator("text=Tareas Prioritarias").first()).toBeVisible();
  });
});
