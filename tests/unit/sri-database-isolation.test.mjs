import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveSriDatabaseUrl} from '../../src/lib/sri/execution-policy.ts';

test('certification selects its dedicated database without replacing the application datasource',()=>{
 const app='postgresql://example.invalid/neondb',isolated='postgresql://example.invalid/totem_sri_test';
 assert.equal(resolveSriDatabaseUrl('1',isolated,app),isolated);
 assert.throws(()=>resolveSriDatabaseUrl('1',undefined,app),/ISOLATED_DATABASE/);
 assert.throws(()=>resolveSriDatabaseUrl('1',app,isolated),/ISOLATED_DATABASE/);
 assert.equal(resolveSriDatabaseUrl('1',undefined,isolated),undefined);
 assert.equal(resolveSriDatabaseUrl(undefined,undefined,app),undefined);
});
