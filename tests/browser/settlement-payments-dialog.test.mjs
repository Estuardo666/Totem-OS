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

test("settlement card lists the payments behind 'Pagado hasta ahora'", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "totem-settlement-payments-"));
  const mock = `export const useRouter=()=>({refresh(){}});export const useToast=()=>({toast(){}});
    export const getPendingReimbursements=async()=>({success:true,data:[]});export const markExpenseAsReimbursed=async()=>({success:true});
    export const updateUserSalaryConfig=async()=>({success:true});export const processSalaryPayment=async()=>({success:true});`;
  // El último pago es del 31 de octubre a las 18:30 en Ecuador (23:30 UTC):
  // debe mostrarse como 31 oct, no como 1 nov.
  await build({
    stdin: { resolveDir: root, loader: "tsx", contents: `import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {SettlementCard} from './src/components/features/finance/settlement-card';
      const payments=[
        {id:'p1',description:'Primer pago de honorarios',amount:417.5,paidAt:new Date('2026-10-21T15:00:00Z'),kind:'HONORARIOS'},
        {id:'p2',description:'Honorarios 2',amount:350,paidAt:new Date('2026-10-27T15:00:00Z'),kind:'HONORARIOS'},
        {id:'p3',description:'3er honorario octubre',amount:113.5,paidAt:new Date('2026-10-31T23:30:00Z'),kind:'HONORARIOS'},
      ];
      const report={userId:'u-paty',userName:'Paty Rojas',userRole:'STAFF',salaryType:'MONTHLY',salary:0,profitShare:0,profitSharePercent:10,reimbursements:0,paidSoFar:881,payments,remaining:0};
      createRoot(document.getElementById('root')).render(<div style={{maxWidth:460,padding:16}}><SettlementCard userReport={report} user={{image:null}} month={10} year={2026} isAdmin/></div>);` },
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
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: process.env.DIALOG_SCREENSHOT_DIR ? 2 : 1 });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`file:///${path.join(dir, "index.html").replaceAll("\\", "/")}`);

    await page.getByRole("button", { name: /Ver pagos a Paty Rojas/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByText("Pagado en octubre").waitFor();
    assert.match(await dialog.getByRole("heading").first().textContent(), /Pagos a Paty en octubre de 2026/);
    const text = await dialog.textContent();
    assert.match(text, /\$881,00/);
    assert.match(text, /3 pagos/);
    const rows = await dialog.locator("li").allTextContents();
    assert.equal(rows.length, 3);
    assert.match(rows[0], /Primer pago de honorarios.*21 oct.*\$417,50/);
    assert.match(rows[2], /3er honorario octubre.*31 oct.*\$113,50/);
    if (process.env.DIALOG_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.DIALOG_SCREENSHOT_DIR, "payments-desktop.png") });
    await page.setViewportSize({ width: 390, height: 844 });
    if (process.env.DIALOG_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.DIALOG_SCREENSHOT_DIR, "payments-mobile.png") });
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
