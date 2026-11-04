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

test("pending reimbursements dialog lists every month and marks items as returned", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "totem-pending-expenses-"));
  // Dos gastos de octubre y uno de noviembre: el detalle debe mostrar los tres,
  // no solo los del mes actual, igual que el total de la tarjeta.
  const mock = `export const useRouter=()=>({refresh(){ window.__refreshes=(window.__refreshes||0)+1; }});
    export const useToast=()=>({toast(t){ (window.__toasts=window.__toasts||[]).push(t.title); }});
    const rows=[
      {id:'e1',description:'Taxi a rodaje',amount:12.5,category:'TRANSPORTE',date:new Date('2026-10-08T17:00:00Z'),clientName:'Cafetería Sol'},
      {id:'e2',description:'Almuerzo equipo',amount:24.29,category:'COMIDA',date:new Date('2026-10-21T17:00:00Z'),clientName:null},
      {id:'e3',description:'Licencia de música',amount:21.48,category:'SOFTWARE',date:new Date('2026-11-02T17:00:00Z'),clientName:'Clínica Norte'},
    ];
    export const getPendingReimbursements=async()=>({success:true,data:rows.map(r=>({...r}))});
    export const markExpenseAsReimbursed=async(id)=>{ (window.__marked=window.__marked||[]).push(id); return {success:true}; };`;
  await build({
    stdin: { resolveDir: root, loader: "tsx", contents: `import React, {useState} from 'react';
      import {createRoot} from 'react-dom/client';
      import {PendingExpensesDialog} from './src/components/features/finance/pending-expenses-dialog';
      function App(){ const [open,setOpen]=useState(false);
        return <><button onClick={()=>setOpen(true)}>Abrir detalle</button>
          <PendingExpensesDialog open={open} onOpenChange={setOpen} userId="u-paty" userName="Paty Rojas" canMarkReturned /></>; }
      createRoot(document.getElementById('root')).render(<App/>);` },
    bundle: true, outfile: path.join(dir, "app.js"), platform: "browser", jsx: "automatic",
    tsconfig: path.join(root, "tsconfig.json"),
    plugins: [{ name: "mock-server-boundaries", setup(bundler) {
      bundler.onResolve({ filter: /^(next\/navigation|@\/actions\/|@\/components\/ui\/use-toast)/ }, () => ({ path: "boundaries", namespace: "mock" }));
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
    await page.getByRole("button", { name: "Abrir detalle" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByText("Le debemos").waitFor();
    assert.match(await dialog.getByRole("heading").first().textContent(), /Gastos por devolver a Paty/);
    assert.match(await dialog.textContent(), /\$58,27/);
    assert.match(await dialog.textContent(), /3 gastos/);
    const months = await dialog.locator("section").evaluateAll((sections) => sections.map((s) => s.getAttribute("aria-label")));
    assert.deepEqual(months, ["Octubre de 2026", "Noviembre de 2026"]);
    if (process.env.DIALOG_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.DIALOG_SCREENSHOT_DIR, "desktop.png") });

    // Marcar uno pide confirmación antes de cambiar nada.
    const taxi = dialog.locator("li", { hasText: "Taxi a rodaje" });
    await taxi.getByRole("button", { name: "Ya se lo devolví" }).click();
    assert.match(await taxi.textContent(), /¿Ya le devolviste \$12,50 a Paty\?/);
    if (process.env.DIALOG_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.DIALOG_SCREENSHOT_DIR, "confirm.png") });
    assert.equal(await page.evaluate(() => window.__marked), undefined);
    await taxi.getByRole("button", { name: "Sí, ya se lo devolví" }).click();
    await dialog.locator("li", { hasText: "Taxi a rodaje" }).waitFor({ state: "detached" });
    assert.deepEqual(await page.evaluate(() => window.__marked), ["e1"]);
    assert.equal(await page.evaluate(() => window.__refreshes), 1);
    assert.match(await dialog.textContent(), /\$45,77/);
    assert.match(await dialog.textContent(), /2 gastos/);

    await page.setViewportSize({ width: 390, height: 844 });
    if (process.env.DIALOG_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.DIALOG_SCREENSHOT_DIR, "mobile.png") });

    for (const name of ["Almuerzo equipo", "Licencia de música"]) {
      const row = dialog.locator("li", { hasText: name });
      await row.getByRole("button", { name: "Ya se lo devolví" }).click();
      await row.getByRole("button", { name: "Sí, ya se lo devolví" }).click();
      await dialog.locator("li", { hasText: name }).waitFor({ state: "detached" });
    }
    await dialog.getByText("Todo al día").waitFor();
    if (process.env.DIALOG_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.DIALOG_SCREENSHOT_DIR, "empty.png") });
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
