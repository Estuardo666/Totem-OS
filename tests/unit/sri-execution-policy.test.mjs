import test from 'node:test';
import assert from 'node:assert/strict';
import {assertSriEnvironmentAllowed,assertSriDocumentEnvironment,assertSriWorkerDatabase,sriEmailAllowed} from '../../src/lib/sri/execution-policy.ts';

test('SRI production requires explicit authorization and test worker requires isolated database',()=>{
 assert.doesNotThrow(()=>assertSriEnvironmentAllowed('1',false));
 assert.throws(()=>assertSriEnvironmentAllowed('2',false),/PRODUCTION_NOT_AUTHORIZED/);
 assert.throws(()=>assertSriEnvironmentAllowed('invalid',true),/INVALID/);
 assert.doesNotThrow(()=>assertSriWorkerDatabase('1','postgresql://example.invalid/totem_sri_test'));
 assert.throws(()=>assertSriWorkerDatabase('1','postgresql://example.invalid/neondb'),/ISOLATED_DATABASE/);
});
test('transport, XML configuration and access-key environment must agree; test email stays blocked',()=>{
 const key='0'.repeat(23)+'1'+'0'.repeat(25);
 assert.doesNotThrow(()=>assertSriDocumentEnvironment('1','1',key));
 assert.throws(()=>assertSriDocumentEnvironment('1','2',key),/MISMATCH/);
 assert.throws(()=>assertSriDocumentEnvironment('1','1',key.slice(0,23)+'2'+key.slice(24)),/MISMATCH/);
 assert.throws(()=>assertSriDocumentEnvironment('1','1',null),/MISMATCH/);
 assert.equal(sriEmailAllowed('1'),false);
});
