import assert from 'node:assert/strict';
import test from 'node:test';

const {
  META_SCOPES,
  requiredScopesForMode,
  mapGrantedScopes,
  parseDebugTokenResponse,
} = await import('../../src/lib/meta/permissions-policy.ts');

test('a system user is not asked for a public profile it does not have', () => {
  const oauth = requiredScopesForMode('oauth');
  const system = requiredScopesForMode('system_user');

  assert.deepEqual(oauth, [...META_SCOPES]);
  assert.equal(oauth.includes('public_profile'), true);
  // Si se quedara, la página marcaría "Perfil público" como faltante para
  // siempre, y un aviso que siempre está en rojo deja de significar algo.
  assert.equal(system.includes('public_profile'), false);
  assert.equal(system.length, oauth.length - 1);
});

test('a fully provisioned system user reports nothing missing', () => {
  const required = requiredScopesForMode('system_user');
  const { permissions, missing } = mapGrantedScopes(required, required);

  assert.deepEqual(missing, []);
  assert.equal(Object.values(permissions).every(Boolean), true);
});

test('one revoked permission is named, the rest stay green', () => {
  const required = requiredScopesForMode('oauth');
  const granted = required.filter((scope) => scope !== 'ads_read');

  const { permissions, missing } = mapGrantedScopes(granted, required);

  assert.deepEqual(missing, ['ads_read']);
  assert.equal(permissions.ads_read, false);
  assert.equal(permissions.read_insights, true);
});

test('an invalid token reports everything missing, as before', () => {
  const required = requiredScopesForMode('oauth');
  const { permissions, missing } = mapGrantedScopes(null, required);

  assert.deepEqual(missing, required);
  assert.equal(Object.values(permissions).some(Boolean), false);
});

test('permissions granted but not required are ignored', () => {
  const required = requiredScopesForMode('system_user');
  const { permissions, missing } = mapGrantedScopes(
    [...required, 'pages_manage_posts', 'catalog_management'],
    required
  );

  assert.deepEqual(missing, []);
  // No ensucian el reporte con cosas que nadie tiene que arreglar.
  assert.equal('catalog_management' in permissions, false);
  assert.equal(Object.keys(permissions).length, required.length);
});

test('expires_at zero means the token never expires', () => {
  const info = parseDebugTokenResponse({
    data: { app_id: 123, type: 'SYSTEM_USER', is_valid: true, expires_at: 0, scopes: ['ads_read'] },
  });

  assert.equal(info.isValid, true);
  assert.equal(info.type, 'SYSTEM_USER');
  // 0 es "nunca", no el 1 de enero de 1970.
  assert.equal(info.expiresAt, null);
  // El app_id numérico se normaliza a texto para poder compararlo con la env.
  assert.equal(info.appId, '123');
});

test('a real epoch becomes a real date', () => {
  const info = parseDebugTokenResponse({
    data: { is_valid: true, expires_at: 1789000000, data_access_expires_at: 0 },
  });

  assert.equal(info.expiresAt.getTime(), 1789000000 * 1000);
  assert.equal(info.dataAccessExpiresAt, null);
});

test('granular scopes are merged with the flat list, deduplicated', () => {
  // Con Inicio de sesión para empresas, `scopes` llega incompleto y los
  // permisos reales viajan en `granular_scopes`. Mirar solo uno reporta como
  // faltantes permisos que sí están otorgados.
  const info = parseDebugTokenResponse({
    data: {
      is_valid: true,
      scopes: ['pages_show_list'],
      granular_scopes: [
        { scope: 'instagram_basic', target_ids: ['1'] },
        { scope: 'pages_show_list' },
        { scope: 'ads_read' },
      ],
    },
  });

  assert.deepEqual(info.scopes.sort(), ['ads_read', 'instagram_basic', 'pages_show_list']);
});

test('a malformed response reads as invalid instead of throwing', () => {
  for (const body of [null, {}, { error: { message: 'boom' } }]) {
    const info = parseDebugTokenResponse(body);
    assert.equal(info.isValid, false);
    assert.deepEqual(info.scopes, []);
    assert.equal(info.expiresAt, null);
  }
});
