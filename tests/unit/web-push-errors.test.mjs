import assert from "node:assert/strict";
import test from "node:test";
import { classifyWebPushFailure } from "../../src/lib/web-push-errors.ts";

test("Apple VAPID key mismatch and rejected Windows registrations require a new subscription", () => {
  assert.equal(classifyWebPushFailure({ statusCode: 400, body: '{"reason":"VapidPkHashMismatch"}' }, "https://web.push.apple.com/private").retire, true);
  assert.equal(classifyWebPushFailure({ statusCode: 401 }, "https://wns2-bl2p.notify.windows.com/private").retire, true);
});

test("server JWT and temporary errors must not delete otherwise valid registrations", () => {
  for (const failure of [{ statusCode: 400, body: '{"reason":"BadJwtToken"}' }, { statusCode: 503 }, { statusCode: 429 }]) {
    assert.equal(classifyWebPushFailure(failure, "https://web.push.apple.com/private").retire, false);
  }
});

test("only known provider codes are exposed, never arbitrary bodies or endpoint paths", () => {
  const result = classifyWebPushFailure({ statusCode: 400, body: '{"reason":"private-auth-key"}' }, "https://web.push.apple.com/private-endpoint");
  assert.equal(result.reason, null);
  assert.equal(JSON.stringify(result).includes("private"), false);
});
