import assert from 'node:assert/strict';
import test from 'node:test';
import { isAuthorizedCronRequest } from '../../src/lib/cron-auth.ts';

const SECRET = 'super-secret-cron-value';

const req = (overrides = {}) => ({
  authorizationHeader: null,
  cronSecret: SECRET,
  ...overrides,
});

test('the exact bearer token is accepted', () => {
  assert.equal(
    isAuthorizedCronRequest(req({ authorizationHeader: `Bearer ${SECRET}` })),
    true
  );
});

test('an unauthenticated request is rejected', () => {
  assert.equal(isAuthorizedCronRequest(req()), false);
});

test('the spoofable Vercel header alone is not trusted', () => {
  // `x-vercel-cron-id` es una cabecera común: cualquiera puede enviarla.
  // La función ya ni la recibe; un input con ella sin Bearer debe fallar.
  assert.equal(isAuthorizedCronRequest(req({ vercelCronHeader: 'cron_abc123' })), false);
});

test('a secret in the query string is not accepted', () => {
  assert.equal(isAuthorizedCronRequest(req({ secretParam: SECRET })), false);
});

test('a wrong or malformed bearer is rejected', () => {
  assert.equal(isAuthorizedCronRequest(req({ authorizationHeader: 'Bearer wrong' })), false);
  assert.equal(isAuthorizedCronRequest(req({ authorizationHeader: SECRET })), false);
  assert.equal(isAuthorizedCronRequest(req({ authorizationHeader: `bearer ${SECRET}` })), false);
  assert.equal(isAuthorizedCronRequest(req({ authorizationHeader: `Bearer ${SECRET} ` })), false);
});

test('it fails closed when CRON_SECRET is not configured', () => {
  assert.equal(
    isAuthorizedCronRequest(req({ cronSecret: undefined, authorizationHeader: 'Bearer anything' })),
    false
  );
  assert.equal(isAuthorizedCronRequest(req({ cronSecret: '', authorizationHeader: 'Bearer ' })), false);
});
