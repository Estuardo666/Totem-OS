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

test("create and edit expense dialogs share fields and keep the chosen day", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "totem-expense-form-"));
  const mock = `export const useRouter=()=>({refresh(){}});
    export const useToast=()=>({toast(){}});
    const users=[{id:'cuser00001',name:'Paty Rojas',image:null}];
    const clients=[{id:'cclient0001',name:'Cafetería Sol',logo:null,monthlyRate:0}];
    export const getUsers=async()=>({success:true,data:users});
    export const getClients=async()=>({success:true,data:clients});
    export const createExpense=async(input)=>{ window.__created=input; return {success:true}; };
    export const getExpenseById=async()=>({success:true,data:{id:'e1',description:'Taxi a rodaje',amount:12.5,category:'TRANSPORTE',date:new Date('2026-10-01T00:00:00Z'),paidByUserId:'cuser00001',clientId:'cclient0001',relatedUserIds:['cuser00001'],totalAmount:12.5}});
    export const updateExpense=async(id,input)=>{ window.__updated=input; return {success:true}; };`;
  await build({
    stdin: { resolveDir: root, loader: "tsx", contents: `import React, {useState} from 'react';
      import {createRoot} from 'react-dom/client';
      import {CreateExpenseDialog} from './src/components/features/finance/create-expense-dialog';
      import {EditExpenseDialog} from './src/components/features/finance/edit-expense-dialog';
      function App(){ const [c,setC]=useState(false); const [e,setE]=useState(false);
        return <><button onClick={()=>setC(true)}>Nuevo</button><button onClick={()=>setE(true)}>Editar</button>
          <CreateExpenseDialog open={c} onOpenChange={setC}/><EditExpenseDialog expenseId="e1" open={e} onOpenChange={setE}/></>; }
      createRoot(document.getElementById('root')).render(<App/>);` },
    bundle: true, outfile: path.join(dir, "app.js"), platform: "browser", jsx: "automatic",
    banner: { js: "window.process = window.process || { env: {} };" },
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
    // Navegador en hora de Ecuador: ahí era donde el día elegido retrocedía uno.
    const context = await browser.newContext({ timezoneId: "America/Guayaquil", viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`file:///${path.join(dir, "index.html").replaceAll("\\", "/")}`);

    await page.getByRole("button", { name: "Nuevo" }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Descripción").fill("Uber al rodaje");
    await dialog.getByLabel("Descripción").blur();
    await dialog.getByLabel("Monto").fill("8.5");
    await dialog.getByLabel("Fecha").fill("2026-10-05");
    assert.equal(await dialog.getByLabel("Fecha").inputValue(), "2026-10-05");
    assert.match(await dialog.getByRole("combobox").first().textContent(), /Transporte/);
    await dialog.getByRole("button", { name: "Registrar Gasto" }).click();
    await page.waitForFunction(() => window.__created);
    const created = await page.evaluate(() => ({ ...window.__created, date: new Date(window.__created.date).toISOString() }));
    assert.equal(created.date, "2026-10-05T00:00:00.000Z");
    assert.equal(created.category, "TRANSPORTE");
    assert.equal(created.amount, 8.5);

    await page.getByRole("button", { name: "Editar" }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByText("Editar Gasto").waitFor();
    await page.waitForFunction(() => document.querySelector("[role=dialog] input[type=date]")?.value === "2026-10-01");
    assert.equal(await dialog.getByLabel("Descripción").inputValue(), "Taxi a rodaje");
    await dialog.getByLabel("Monto").fill("14");
    await dialog.getByRole("button", { name: "Guardar Cambios" }).click();
    await page.waitForFunction(() => window.__updated);
    const updated = await page.evaluate(() => ({ ...window.__updated, date: new Date(window.__updated.date).toISOString() }));
    assert.equal(updated.amount, 14);
    assert.equal(updated.date, "2026-10-01T00:00:00.000Z");
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
