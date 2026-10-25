import test from 'node:test';
import assert from 'node:assert/strict';
import {triggerSriWorker} from '../../src/lib/sri/trigger-worker.ts';
test('post-commit trigger never turns an existing queued invoice into a caller failure',async()=>{
 const old={url:process.env.SRI_PROCESS_URL,key:process.env.FACTURACION_WORKER_SECRET,fetch:globalThis.fetch};
 try{
 process.env.FACTURACION_WORKER_SECRET='synthetic-worker-secret';
 for(const invalid of ['invalid','http://example.invalid/process','https://user:pass@example.invalid/process','https://example.invalid/other']){process.env.SRI_PROCESS_URL=invalid;assert.deepEqual(await triggerSriWorker(),{triggered:false});}
 process.env.SRI_PROCESS_URL='https://example.invalid/process';
 globalThis.fetch=async(_url,options)=>{assert.equal(options.redirect,'error');assert.equal(options.method,'POST');return new Response('{}',{status:200});};
 assert.deepEqual(await triggerSriWorker(),{triggered:true});
 globalThis.fetch=async()=>{throw new Error('connection unavailable')};assert.deepEqual(await triggerSriWorker(),{triggered:false});
 }finally{globalThis.fetch=old.fetch;for(const[k,v]of[['SRI_PROCESS_URL',old.url],['FACTURACION_WORKER_SECRET',old.key]]){if(v===undefined)delete process.env[k];else process.env[k]=v}}
});

test('dedicated process secret does not require replacing the existing heartbeat secret',async()=>{
 const old={url:process.env.SRI_PROCESS_URL,key:process.env.SRI_PROCESS_SECRET,fetch:globalThis.fetch};
 try{
 process.env.SRI_PROCESS_URL='https://example.invalid/process';process.env.SRI_PROCESS_SECRET='dedicated-test-process-secret';
 globalThis.fetch=async(_url,options)=>{assert.equal(options.headers.Authorization,'Bearer dedicated-test-process-secret');return new Response('{}',{status:200})};
 assert.deepEqual(await triggerSriWorker(),{triggered:true});
 }finally{globalThis.fetch=old.fetch;for(const[k,v]of[['SRI_PROCESS_URL',old.url],['SRI_PROCESS_SECRET',old.key]]){if(v===undefined)delete process.env[k];else process.env[k]=v}}
});
