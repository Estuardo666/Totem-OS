import assert from 'node:assert/strict';
import test from 'node:test';
import { createHmac } from 'node:crypto';
import { appSecretProof, withAppSecretProof } from '../../src/lib/meta/app-secret-proof.ts';

test('the proof is the HMAC-SHA256 of the token with the app secret', () => {
  const expected = createHmac('sha256', 'secret').update('token').digest('hex');
  assert.equal(appSecretProof('token', 'secret'), expected);
});

test('without an app secret no proof is added', () => {
  assert.equal(appSecretProof('token', ''), null);
});

test('withAppSecretProof adds the param when the secret is configured', () => {
  const previous = process.env.META_APP_SECRET;
  process.env.META_APP_SECRET = 's3cr3t';
  try {
    const params = withAppSecretProof(new URLSearchParams({ fields: 'id' }), 'tok');
    assert.equal(params.get('appsecret_proof'), appSecretProof('tok', 's3cr3t'));
    assert.equal(params.get('fields'), 'id');
  } finally {
    if (previous === undefined) delete process.env.META_APP_SECRET;
    else process.env.META_APP_SECRET = previous;
  }
});

test('with a system user token, only its own app secret signs', async () => {
  const { resolveProofSecret } = await import('../../src/lib/meta/app-secret-proof.ts');
  // El secreto del login OAuth puede ser de otra app: firmar con él rompe Graph.
  assert.equal(
    resolveProofSecret({ META_SYSTEM_USER_TOKEN: 'sys', META_APP_SECRET: 'oauth-app' }),
    undefined
  );
  assert.equal(
    resolveProofSecret({ META_SYSTEM_USER_TOKEN: 'sys', META_SYSTEM_USER_APP_SECRET: 'sys-app' }),
    'sys-app'
  );
  assert.equal(resolveProofSecret({ META_APP_SECRET: 'oauth-app' }), 'oauth-app');
});
