import test from 'node:test';
import assert from 'node:assert/strict';
import {assertCreditNoteAllowed} from '../../src/lib/sri/credit-note-policy.ts';
test('consumer-final invoices and unauthorized invoices cannot generate a credit note',()=>{
 const identified={estado:'AUTORIZADA',tipoIdentificacion:'04',numeroIdentificacion:'1234567890001'};
 assert.doesNotThrow(()=>assertCreditNoteAllowed(identified));
 assert.throws(()=>assertCreditNoteAllowed({...identified,tipoIdentificacion:'07'}),/consumidor final/);
 assert.throws(()=>assertCreditNoteAllowed({...identified,numeroIdentificacion:'9999999999999'}),/consumidor final/);
 assert.throws(()=>assertCreditNoteAllowed({...identified,estado:'PENDIENTE_FIRMA'}),/autorizadas/);
});
