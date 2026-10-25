import test from 'node:test';
import assert from 'node:assert/strict';
import {buildFacturaXml} from '../../src/lib/sri/xml/factura-builder.ts';
import {DOMParser} from '@xmldom/xmldom';

test('blank commercial name cannot generate the empty XML element rejected by SRI code 35',()=>{
 for(const name of ['', '   ', undefined]){
 const xml=buildFacturaXml({infoTributaria:{ambiente:'1',tipoEmision:'1',razonSocial:'Emisor de prueba',nombreComercial:name,ruc:'9999999999999',claveAcceso:'1'.repeat(49),codDoc:'01',estab:'001',ptoEmi:'001',secuencial:'000000001',dirMatriz:'Direccion prueba'},infoFactura:{fechaEmision:'25/10/2026',obligadoContabilidad:'NO',tipoIdentificacionComprador:'07',razonSocialComprador:'CONSUMIDOR FINAL',identificacionComprador:'9999999999999',totalSinImpuestos:1,totalDescuento:0,totalConImpuestos:[],propina:0,importeTotal:1,moneda:'DOLAR',pagos:[]},detalles:[]});
 const doc=new DOMParser().parseFromString(xml,'text/xml');
 assert.equal(doc.getElementsByTagName('nombreComercial')[0].textContent,'Emisor de prueba');
 }
});