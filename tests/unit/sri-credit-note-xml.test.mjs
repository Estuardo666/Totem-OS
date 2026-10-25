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



const {buildNotaCreditoXml}=await import('../../src/lib/sri/xml/nota-credito-builder.ts');
const {DOMParser}=await import('@xmldom/xmldom');
test('SRI credit-note details use codigoInterno and remain outside tax totals',()=>{
 const tax={codigo:'2',codigoPorcentaje:'4',baseImponible:1,valor:0.15};
 const xml=buildNotaCreditoXml({infoTributaria:{ambiente:'1',tipoEmision:'1',razonSocial:'Emisor',ruc:'9999999999999',claveAcceso:'1'.repeat(49),codDoc:'04',estab:'002',ptoEmi:'002',secuencial:'000000001',dirMatriz:'Prueba'},infoNotaCredito:{fechaEmision:'25/10/2026',tipoIdentificacionComprador:'04',razonSocialComprador:'Receptor',identificacionComprador:'9999999999999',codDocModificado:'01',numDocModificado:'002-002-000000008',fechaEmisionDocSustento:'25/10/2026',totalSinImpuestos:1,valorModificacion:1.15,moneda:'DOLAR',totalConImpuestos:[tax],motivo:'Prueba'},detalles:[{codigoPrincipal:'T-1',descripcion:'Prueba',cantidad:1,precioUnitario:1,descuento:0,precioTotalSinImpuesto:1,impuestos:[{...tax,tarifa:15}]}]});
 const doc=new DOMParser().parseFromString(xml,'text/xml');
 const detail=doc.getElementsByTagName('detalle')[0];
 assert.equal(detail.parentNode.nodeName,'detalles');assert.equal(detail.parentNode.parentNode.nodeName,'notaCredito');
 assert.equal(detail.getElementsByTagName('codigoInterno')[0].textContent,'T-1');
 assert.equal(detail.getElementsByTagName('codigoPrincipal').length,0);
 assert.equal(doc.getElementsByTagName('totalConImpuestos')[0].getElementsByTagName('detalle').length,0);
});