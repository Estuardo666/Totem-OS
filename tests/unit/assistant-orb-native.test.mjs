import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);

// Render the actual launcher, replacing auth, media and animation boundaries.
function renderLauncher(pathname = "/") {
  const exports = {};
  const motion = new Proxy({}, { get: (_, tag) => ({ children, ...props }) => {
    for (const name of ["initial", "animate", "exit", "transition"]) delete props[name];
    return React.createElement(tag, props, children);
  } });
  const mocks = {
    "next/navigation": { usePathname: () => pathname },
    "next-auth/react": { useSession: () => ({ data: { user: { name: "Prueba" } } }) },
    "motion/react": { motion, AnimatePresence: ({ children }) => children, useReducedMotion: () => true },
    "@/lib/utils": { cn: (...items) => items.filter(Boolean).join(" ") },
    "./assistant-chat": {},
    "./post-strip": {},
    "./use-live-voice": { useLiveVoice: () => ({ status: "idle", drafts: [], transcript: [] }) },
    "@/lib/assistant/spoken-numbers": {},
  };
  const source = fs.readFileSync(new URL("../../src/components/features/assistant/assistant-orb.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  vm.runInNewContext(compiled, { exports, require: (name) => mocks[name] ?? require(name) });
  return renderToStaticMarkup(React.createElement(exports.AssistantOrb));
}

test("native shell hides replaced chrome but keeps the actual AI launcher visible above navigation", async () => {
  const markup = renderLauncher();
  const css = fs.readFileSync(new URL("../../src/app/globals.css", import.meta.url), "utf8");
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage();
    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      await page.setContent(`<html data-totem-native-shell-ready="1"><head><style>${css}</style></head><body><button data-totem-web-chrome>Web navigation</button>${markup}</body></html>`);
      assert.equal(await page.locator("[data-totem-web-chrome]").isVisible(), false);
      const orb = page.getByRole("button", { name: "Abrir asistente IA" });
      assert.equal(await orb.isVisible(), true, `launcher visible at ${width}px`);
      assert.equal(await orb.evaluate((element) => getComputedStyle(element).bottom), "104px");
      assert.equal(await orb.getAttribute("data-totem-web-chrome"), null);
    }
  } finally { await browser.close(); }
});

test("assistant remains hidden on authentication screens", () => {
  assert.equal(renderLauncher("/sign-in"), "");
  assert.equal(renderLauncher("/sign-up"), "");
});
