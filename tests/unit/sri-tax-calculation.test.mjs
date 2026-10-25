import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

registerHooks({ resolve(specifier, context, nextResolve) {
  let url;
  if (specifier.startsWith("@/")) url = new URL(`../../src/${specifier.slice(2)}`, import.meta.url);
  else if (specifier.startsWith(".") && (context.parentURL?.includes("/src/") || context.parentURL?.includes("/worker/"))) url = new URL(specifier, context.parentURL);
  if (url?.protocol === "file:") {
    const path = fileURLToPath(url);
    for (const candidate of [path, `${path}.ts`, `${path}/index.ts`]) {
      if (existsSync(candidate) && candidate.endsWith(".ts")) return nextResolve(pathToFileURL(candidate).href, context);
    }
  }
  return nextResolve(specifier, context);
} });



const {calcularLineaSri,agruparImpuestosSri}=await import('../../src/lib/sri/tax-calculation.ts');
test('SRI IVA codes use official percentages and line discounts are computed before tax',()=>{
 assert.equal(calcularLineaSri({cantidad:1,precioUnitario:100,tipoIva:'2'}).valorImpuesto,12);
 const line=calcularLineaSri({cantidad:2,precioUnitario:10,descuento:2,tipoIva:'4'});
 assert.deepEqual(line,{descuento:2,precioTotalSinImpuesto:18,tarifa:15,valorImpuesto:2.7});
 for(const code of ['0','6','7']) assert.equal(calcularLineaSri({cantidad:1,precioUnitario:100,tipoIva:code}).valorImpuesto,0);
 assert.throws(()=>calcularLineaSri({cantidad:1,precioUnitario:1,descuento:2,tipoIva:'4'}));
 assert.throws(()=>calcularLineaSri({cantidad:NaN,precioUnitario:1,tipoIva:'4'}));
 assert.throws(()=>calcularLineaSri({cantidad:1,precioUnitario:1,tipoIva:'unknown'}));
});
test('XML tax totals preserve separate zero-rated, exempt and non-taxable codes',()=>{
 const rows=['0','6','7','4','4'].map(code=>({codigoImpuesto:'2',codigoPorcentaje:code,baseImponible:1,valorImpuesto:code==='4'?0.15:0}));
 const groups=agruparImpuestosSri(rows);assert.equal(groups.length,4);
 assert.deepEqual(groups.find(g=>g.codigoPorcentaje==='4'),{codigo:'2',codigoPorcentaje:'4',baseImponible:2,valor:0.3});
});