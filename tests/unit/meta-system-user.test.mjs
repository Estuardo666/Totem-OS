import assert from 'node:assert/strict';
import test from 'node:test';

const {
  isMetaSystemUserMode,
  buildSystemUserAccount,
  SYSTEM_USER_ACCOUNT_ID,
  DEFAULT_SYSTEM_USER_NAME,
} = await import('../../src/lib/meta/system-user.ts');

test('an absent or blank token does not count as configured', () => {
  assert.equal(isMetaSystemUserMode({}), false);
  assert.equal(isMetaSystemUserMode({ META_SYSTEM_USER_TOKEN: '' }), false);
  // Una variable puesta a espacios en Vercel es un descuido, no una intención.
  assert.equal(isMetaSystemUserMode({ META_SYSTEM_USER_TOKEN: '   ' }), false);
  assert.equal(isMetaSystemUserMode({ META_SYSTEM_USER_TOKEN: 'EAAG...' }), true);
});

test('no token means no synthetic account, so the database still wins', () => {
  assert.equal(buildSystemUserAccount({}), null);
  assert.equal(buildSystemUserAccount({ META_SYSTEM_USER_TOKEN: '  ' }), null);
});

test('the synthetic account never carries an expiry date', () => {
  const account = buildSystemUserAccount({ META_SYSTEM_USER_TOKEN: 'EAAG-token' });

  assert.equal(account.mode, 'system_user');
  // null y no una fecha lejana: un centinela pasaría por needsRefresh sin ruido
  // y la interfaz pintaría una fecha inventada.
  assert.equal(account.tokenExpiresAt, null);
  // No hay renovación ni estado de reconexión que arrastrar.
  assert.equal(account.lastRefreshedAt, null);
  assert.equal(account.refreshFailedAt, null);
  assert.equal(account.scopes, null);
});

test('the id is a literal, not a cuid, so a stray where-clause fails loudly', () => {
  const account = buildSystemUserAccount({ META_SYSTEM_USER_TOKEN: 't' });

  assert.equal(account.id, SYSTEM_USER_ACCOUNT_ID);
  assert.equal(account.id, 'system-user');
  // Un cuid real podría coincidir con una fila vieja y escribir sobre ella.
  assert.equal(/^c[a-z0-9]{24}$/.test(account.id), false);
});

test('the token is trimmed before it reaches Graph', () => {
  // Un salto de línea pegado por descuido rompería la cabecera Authorization.
  const account = buildSystemUserAccount({ META_SYSTEM_USER_TOKEN: '  EAAG-token\n' });
  assert.equal(account.accessToken, 'EAAG-token');
});

test('name and id fall back without extra configuration', () => {
  const bare = buildSystemUserAccount({ META_SYSTEM_USER_TOKEN: 't' });
  assert.equal(bare.name, DEFAULT_SYSTEM_USER_NAME);
  // Vacío, no undefined: la interfaz oculta la línea del ID cuando no hay.
  assert.equal(bare.facebookUserId, '');

  const named = buildSystemUserAccount({
    META_SYSTEM_USER_TOKEN: 't',
    META_SYSTEM_USER_ID: '61550000000000',
    META_SYSTEM_USER_NAME: 'Totem OS',
  });
  assert.equal(named.name, 'Totem OS');
  assert.equal(named.facebookUserId, '61550000000000');
});
