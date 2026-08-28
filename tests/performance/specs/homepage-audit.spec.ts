import { test, expect, type Page } from "@playwright/test";
import * as fs from "fs";

const JS_TRANSFER_BUDGET = 350 * 1024;
const TOTAL_TRANSFER_BUDGET = 2 * 1024 * 1024;

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

function isExpectedBlockedResourceError(message: string, sourceUrl: string): boolean {
  const details = `${message} ${sourceUrl}`;
  return details.includes("maps.googleapis.com/maps/api/js") || details.includes("/_vercel/speed-insights/");
}

async function collectMetrics(page: Page) {
  return await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const paints = performance.getEntriesByType("paint");
    const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const fcp = paints.find((paint) => paint.name === "first-contentful-paint");
    const observed = (window as typeof window & {
      __totemPerformanceMetrics?: { lcp: number; cls: number; clsEntries: number };
    }).__totemPerformanceMetrics;
    const jsResources = resources.filter((resource) => resource.initiatorType === "script");
    const cssResources = resources.filter((resource) => /\.css(?:\?|$)/.test(resource.name));
    const imgResources = resources.filter((resource) => resource.initiatorType === "img" || /\/_next\/image\?/.test(resource.name));
    const fontResources = resources.filter((resource) => resource.initiatorType === "font" || /\.(?:woff2?|ttf)(?:\?|$)/.test(resource.name));
    const totalTransferSize = resources.reduce((sum, resource) => sum + (resource.transferSize || 0), nav?.transferSize || 0);
    const jsSize = jsResources.reduce((sum, resource) => sum + (resource.transferSize || 0), 0);
    return {
      TTFB: nav ? nav.responseStart : 0,
      FCP: fcp ? fcp.startTime : 0,
      LCP: observed?.lcp || 0,
      domContentLoaded: nav ? nav.domContentLoadedEventEnd : 0,
      loadComplete: nav ? nav.loadEventEnd : 0,
      domInteractive: nav ? nav.domInteractive : 0,
      clsValue: (observed?.cls || 0).toFixed(3),
      clsEntries: observed?.clsEntries || 0,
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
    await page.addInitScript(() => {
      const metrics = { lcp: 0, cls: 0, clsEntries: 0 };
      Object.defineProperty(window, "__totemPerformanceMetrics", {
        value: metrics,
        configurable: false,
      });

      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const latest = entries.at(-1);
        if (latest) metrics.lcp = latest.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });

      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const layoutShift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
          if (!layoutShift.hadRecentInput) {
            metrics.cls += layoutShift.value;
            metrics.clsEntries += 1;
          }
        }
      }).observe({ type: "layout-shift", buffered: true });
    });

    for (const pattern of BLOCKED) {
      await page.route(pattern, (route: any) => route.abort());
    }
  });

  test("collect Core Web Vitals + resource breakdown", async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (err: any) => errors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error" && !isExpectedBlockedResourceError(msg.text(), msg.location().url)) {
        errors.push(msg.text());
      }
    });

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
    if (metrics.jsTransfer > JS_TRANSFER_BUDGET) opportunities.push("JS size: " + formatBytes(metrics.jsTransfer) + ". Tree-shaking audit.");
    if (metrics.totalTransfer > TOTAL_TRANSFER_BUDGET) opportunities.push("Page weight: " + formatBytes(metrics.totalTransfer) + ". Audit images/fonts.");
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
    expect(metrics.LCP).toBeGreaterThan(0);
    expect(metrics.LCP).toBeLessThan(4000);
    expect(Number(metrics.clsValue)).toBeLessThan(0.25);
    expect(metrics.jsTransfer).toBeLessThan(JS_TRANSFER_BUDGET);
    expect(metrics.totalTransfer).toBeLessThan(TOTAL_TRANSFER_BUDGET);
    expect(errors).toHaveLength(0);
  });

  test("verify key sections render after load", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("region", { name: "Resumen ejecutivo" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Agenda de hoy" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pipeline de contenido" })).toBeVisible();
  });
});
