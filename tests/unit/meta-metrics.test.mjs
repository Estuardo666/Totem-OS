import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchPageMetrics, InsufficientPermissionsError, TokenExpiredError } from '../../src/lib/meta/metrics-service.ts';
test('Facebook sync uses supported metrics and keeps credentials out of URLs', async () => {
 const original=global.fetch;
 try {
  global.fetch=async (url,options)=>{
   assert.equal(url.searchParams.get('metric'),'page_media_view,page_post_engagements,page_follows');
   assert.equal(url.searchParams.has('access_token'),false);
   assert.equal(options.headers.Authorization,'Bearer test-token');
   return Response.json({data:[{name:'page_media_view',period:'day',values:[{value:35,end_time:'2026-09-09T07:00:00Z'}]}]});
  };
  assert.equal((await fetchPageMetrics('123','test-token')).data[0].values[0].value,35);
 } finally {global.fetch=original;}
});
test('invalid metrics are not reported as missing permissions',async()=>{
 const original=global.fetch;
 try {
  global.fetch=async()=>Response.json({error:{code:100,message:'invalid metric'}},{status:400});
  await assert.rejects(fetchPageMetrics('123','test'),e=>!(e instanceof InsufficientPermissionsError)&&e.message.includes('invalid metric'));
  global.fetch=async()=>Response.json({error:{code:190}},{status:400});
  await assert.rejects(fetchPageMetrics('123','test'),TokenExpiredError);
 } finally {global.fetch=original;}
});
