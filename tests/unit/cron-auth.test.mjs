import assert from 'node:assert/strict';
import test from 'node:test';
import { isAuthorizedCronRequest } from '../../src/lib/cron-auth.ts';

const SECRET = 'super-secret-cron-value';

const req = (overrides = {}) => ({
  authorizationHeader: null,
  vercelCronHeader: null,
  secretParam: null,
  cronSecret: SECRET,
  ...overrides,
});

test('the Vercel scheduler is trusted by its own header', () => {
  assert.equal(isAuthorizedCronRequest(req({ vercelCronHeader: 'cron_abc123' })), true);
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

test('a wrong or malformed bearer is rejected', () => {
  assert.equal(isAuthorizedCronRequest(req({ authorizationHeader: 'Bearer wrong' })), false);
  assert.equal(isAuthorizedCronRequest(req({ authorizationHeader: SECRET })), false);
  assert.equal(isAuthorizedCronRequest(req({ authorizationHeader: `bearer ${SECRET}` })), false);
  assert.equal(isAuthorizedCronRequest(req({ authorizationHeader: `Bearer ${SECRET} ` })), false);
});

test('the manual secret query parameter is accepted when it matches', () => {
  assert.equal(isAuthorizedCronRequest(req({ secretParam: SECRET })), true);
  assert.equal(isAuthorizedCronRequest(req({ secretParam: 'nope' })), false);
});

test('it fails closed when CRON_SECRET is not configured', () => {
  // Sin secreto configurado, ninguna credencial debe pasar: un despliegue mal
  // configurado dejaría los crons abiertos a cualquiera.
  assert.equal(
    isAuthorizedCronRequest(req({ cronSecret: undefined, authorizationHeader: 'Bearer anything' })),
    false
  );
  assert.equal(
    isAuthorizedCronRequest(req({ cronSecret: undefined, secretParam: 'anything' })),
    false
  );
  assert.equal(isAuthorizedCronRequest(req({ cronSecret: '', secretParam: '' })), false);
});

test('an empty secret parameter never matches an empty secret', () => {
  assert.equal(isAuthorizedCronRequest(req({ cronSecret: undefined, secretParam: null })), false);
  assert.equal(isAuthorizedCronRequest(req({ secretParam: '' })), false);
});

test('the Vercel header still wins when no secret is configured', () => {
  // El scheduler de la plataforma es confiable por sí mismo.
  assert.equal(
    isAuthorizedCronRequest(req({ cronSecret: undefined, vercelCronHeader: 'cron_x' })),
    true
  );
});
