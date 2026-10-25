import test from 'node:test';
import assert from 'node:assert/strict';
import {sriDisplayDate} from '../../src/lib/sri/ecuador-date.ts';
test('SRI issue dates use Ecuador even when host UTC has crossed midnight',()=>{
 assert.equal(sriDisplayDate(new Date('2026-10-26T02:00:00Z')),'25/10/2026');
 assert.equal(sriDisplayDate(new Date('2026-10-26T05:00:00Z')),'26/10/2026');
 assert.throws(()=>sriDisplayDate(new Date('invalid')));
});
