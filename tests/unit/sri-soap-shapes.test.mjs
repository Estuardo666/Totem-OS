import test from 'node:test';
import assert from 'node:assert/strict';
import {sriArray} from '../../src/lib/sri/soap-shapes.ts';
test('single SOAP authorization and rejection are visible to the worker just like multiple responses',()=>{
 const rejected={estado:'NO AUTORIZADO',mensajes:{mensaje:{identificador:'56',mensaje:'ERROR ESTABLECIMIENTO CERRADO'}}};
 assert.equal(sriArray(rejected).length,1);
 assert.equal(sriArray(rejected)[0].mensajes.mensaje.identificador,'56');
 const authorized={estado:'AUTORIZADO'};
 assert.deepEqual(sriArray([rejected,authorized]),[rejected,authorized]);
 assert.deepEqual(sriArray(undefined),[]);assert.deepEqual(sriArray(null),[]);
});
