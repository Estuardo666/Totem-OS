import { test, expect, type Page } from "@playwright/test";
import * as fs from "fs";

const BLOCKED = [
  "**/pusher.js",
  "**/pusher-js/**",
  "https://cdn.onesignal.com/**",
  "https://api.onesignal.com/**",
  "https://*.onesignal.com/**",
  "https://maps.googleapis.com/**",
  "https://va.vercel-scripts.com/**",
];

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

async function collectMetrics(page: Page) {
  return await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const paints = performance.getEntriesByType("paint");
    const resources = performance.getEntriesByType("resource");
    const fcp = paints.find((p: any) => p.name === "first-contentful-paint");
    const lcpEntry = performance.getEntriesByType("largest-contentful-paint").pop();
    const clsEntries = performance.getEntriesByType("layout-shift");
    const jsResources = resources.filter((r: any) => r.initiatorType === "script");
    const cssResources = resources.filter((r: any) => r.initiatorType === "link");
    const imgResources = resources.filter((r: any) => r.initiatorType === "img");
    const fontResources = resources.filter((r: any) => r.initiatorType === "font");
    const totalTransferSize = resources.reduce((sum: number, r: any) => sum + (r.transferSize || 0), 0);
    const jsSize = jsResources.reduce((sum: number, r: any) => sum + (r.transferSize || 0), 0);
    const clsValue = clsEntries.reduce((sum: number, e: any) => sum + (e.value || 0), 0);
    return {
      TTFB: nav ? nav.responseStart : 0,
      FCP: fcp ? fcp.startTime : 0,
      LCP: lcpEntry ? lcpEntry.startTime : 0,
      domContentLoaded: nav ? nav.domContentLoadedEventEnd : 0,
      loadComplete: nav ? nav.loadEventEnd : 0,
      domInteractive: nav ? nav.domInteractive : 0,
      clsValue: clsValue.toFixed(3),
      clsEntries: clsEntries.length,
      totalResources: resources.length,
      jsCount: jsResources.length,
      cssCount: cssResources.length,
      imgCount: imgResources.length,
      fontCount: fontResources.length,
      totalTransfer: totalTransferSize,
      jsTransfer: jsSize,
      longTasks: performance.getEntriesByType("longtask").length,
    };
  });
}

test.describe("Homepage Performance Audit", () => {
  test.beforeEach(async ({ page }) => {
    for (const pattern of BLOCKED) {
      await page.route(pattern, (route: any) => route.abort());
    }
  });

  test("collect Core Web Vitals + resource breakdown", async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (err: any) => errors.push(err.message));
    page.on("console", (msg: any) => { if (msg.type() === "error") errors.push(msg.text()); });

    const startTime = Date.now();
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const loadDuration = Date.now() - startTime;

    const metrics = await collectMetrics(page);

    fs.mkdirSync("reports", { recursive: true });
    const report = {
      timestamp: new Date().toISOString(),
      url: page.url(),
      metrics,
      errors,
      loadDuration: loadDuration + "ms",
    };
    fs.writeFileSync("reports/homepage-performance.json", JSON.stringify(report, null, 2));

    console.log("");
    console.log("=== Core Web Vitals (Mobile) ===");
    console.log("TTFB:           " + metrics.TTFB.toFixed(0) + "ms");
    console.log("FCP:            " + metrics.FCP.toFixed(0) + "ms");
    console.log("LCP:            " + metrics.LCP.toFixed(0) + "ms");
    console.log("CLS:            " + metrics.clsValue);
    console.log("Load Complete:  " + metrics.loadComplete.toFixed(0) + "ms");
    console.log("========================");
    console.log("");

    console.log("=== Resource Breakdown ===");
    console.log("Total resources: " + metrics.totalResources + " (" + formatBytes(metrics.totalTransfer) + ")");
    console.log("JavaScript:      " + metrics.jsCount + " files (" + formatBytes(metrics.jsTransfer) + ")");
    console.log("CSS:             " + metrics.cssCount + " files");
    console.log("Images:          " + metrics.imgCount + " files");
    console.log("Fonts:           " + metrics.fontCount + " files");
    console.log("========================");

    const opportunities: string[] = [];
    if (metrics.jsCount > 8) opportunities.push("JS bundling: " + metrics.jsCount + " scripts. Code splitting needed.");
    if (metrics.jsTransfer > 300000) opportunities.push("JS size: " + formatBytes(metrics.jsTransfer) + ". Tree-shaking audit.");
    if (metrics.totalTransfer > 1000000) opportunities.push("Page weight: " + formatBytes(metrics.totalTransfer) + ". Audit images/fonts.");
    if (metrics.FCP > 2000) opportunities.push("FCP slow. Preload critical CSS.");
    if (metrics.LCP > 3000) opportunities.push("LCP slow. Optimize KPI card rendering.");
    if (Number(metrics.clsValue) > 0.1) opportunities.push("CLS high. Reserve space for dynamic content.");

    if (opportunities.length > 0) {
      console.log("");
      console.log("=== Optimization Opportunities ===");
      opportunities.forEach((opp) => console.log("- " + opp));
      console.log("==================================");
    }

    testInfo.attach("performance-report", {
      path: "reports/homepage-performance.json",
      contentType: "application/json",
    });

    expect(metrics.FCP).toBeLessThan(3000);
    expect(metrics.LCP).toBeLessThan(4000);
    expect(Number(metrics.clsValue)).toBeLessThan(0.25);
    expect(metrics.jsCount).toBeLessThan(15);
    expect(metrics.totalTransfer).toBeLessThan(2000000);
    expect(errors).toHaveLength(0);
  });

  test("verify key sections render after load", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Hola,").first()).toBeVisible();
    await expect(page.getByText("Acciones Rápidas").first()).toBeVisible();
    await expect(page.getByText("Tareas Prioritarias").first()).toBeVisible();
  });
});
