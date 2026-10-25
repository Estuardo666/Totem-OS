import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { chromium } from "@playwright/test";
import postcss from "postcss";
import tailwind from "tailwindcss";
const require = createRequire(import.meta.url);
const { build } = require("../../worker/node_modules/esbuild");
const root = path.resolve(import.meta.dirname, "../..");

test("transaction modal renders one fully opaque form during tab switches and reopening", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "totem-transaction-modal-"));
  const mock = `export const useRouter=()=>({refresh(){}});
    export const useSession=()=>({data:{user:{id:'test-admin',role:'ADMIN'}}});
    export const useToast=()=>({toast(){}});
    export const getClients=async()=>({success:true,data:[]});
    export const getUsers=async()=>({success:true,data:[{id:'test-user',name:'Test user',image:null}]});
    export const createExpense=async()=>({success:true});
    export const createTransaction=async()=>({success:true});`;
  await build({
    stdin: { resolveDir: root, loader: "tsx", contents: `import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {TransactionDialog} from './src/components/features/finance/transaction-dialog';
      createRoot(document.getElementById('root')).render(<TransactionDialog defaultTab="expense"><button>Abrir transacción</button></TransactionDialog>);` },
    bundle: true, outfile: path.join(dir, "app.js"), platform: "browser", jsx: "automatic",
    tsconfig: path.join(root, "tsconfig.json"),
    plugins: [{ name: "mock-server-boundaries", setup(bundler) {
      bundler.onResolve({ filter: /^(next\/navigation|next-auth\/react|@\/actions\/|@\/components\/ui\/use-toast)/ }, () => ({ path: "boundaries", namespace: "mock" }));
      bundler.onLoad({ filter: /.*/, namespace: "mock" }, () => ({ contents: mock, loader: "js" }));
    } }],
  });
  const css = await postcss([tailwind(path.join(root, "tailwind.config.ts"))]).process(
    await fs.readFile(path.join(root, "src/app/globals.css"), "utf8"), { from: path.join(root, "src/app/globals.css") });
  await fs.writeFile(path.join(dir, "style.css"), css.css);
  await fs.writeFile(path.join(dir, "index.html"), '<link rel="stylesheet" href="style.css"><div id="root"></div><script src="app.js"></script>');
  const browser = await chromium.launch(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {});
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`file:///${path.join(dir, "index.html").replaceAll("\\", "/")}`);
    await page.getByRole("button", { name: "Abrir transacción" }).click();
    async function assertSingleForm(expected) {
      const snapshot = await page.locator('[role="dialog"]').evaluate((dialog) => {
        const forms = Array.from(dialog.querySelectorAll('form')).filter((form) => {
          const panel = form.closest('[role="tabpanel"]');
          return panel && getComputedStyle(panel).display !== "none";
        });
        return forms.map((form) => ({
          panel: form.closest('[role="tabpanel"]').dataset.state,
          opacity: getComputedStyle(form.closest('[role="tabpanel"]')).opacity,
          submit: form.querySelector('button[type="submit"]')?.textContent,
        }));
      });
      assert.equal(snapshot.length, 1, JSON.stringify(snapshot));
      assert.equal(snapshot[0].panel, "active");
      assert.equal(snapshot[0].opacity, "1");
      assert.match(snapshot[0].submit, expected);
    }
    await assertSingleForm(/Guardar Gasto/);
    for (const [tab, submit] of [["Honorarios", /Registrar Honorarios/], ["Gasto", /Guardar Gasto/], ["Ingreso", /Guardar Ingreso/], ["Honorarios", /Registrar Honorarios/], ["Gasto", /Guardar Gasto/]]) {
      await page.getByRole("tab", { name: tab, exact: true }).click();
      await assertSingleForm(submit);
    }
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    await page.getByRole("button", { name: "Abrir transacción" }).click();
    await assertSingleForm(/Guardar Gasto/);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.getByRole("tab", { name: "Honorarios", exact: true }).click();
    await assertSingleForm(/Registrar Honorarios/);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("tab", { name: "Gasto", exact: true }).click();
    await assertSingleForm(/Guardar Gasto/);
    if (process.env.MODAL_SCREENSHOT) await page.screenshot({ path: process.env.MODAL_SCREENSHOT, fullPage: true });
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await fs.rm(dir, { recursive: true, force: true });
  }
});
