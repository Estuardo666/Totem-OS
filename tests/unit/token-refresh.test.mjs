import assert from 'node:assert/strict';
import test from 'node:test';
import {
  needsRefresh,
  resolveExpiryDate,
  REFRESH_THRESHOLD_DAYS,
  DEFAULT_TTL_SECONDS,
} from '../../src/lib/meta/token-refresh-policy.ts';

const DAY = 86400 * 1000;
const NOW = new Date('2026-09-10T12:00:00.000Z');

test('a token expiring beyond the threshold is left alone', () => {
  assert.equal(needsRefresh(new Date(NOW.getTime() + 30 * DAY), REFRESH_THRESHOLD_DAYS, NOW), false);
  assert.equal(needsRefresh(new Date(NOW.getTime() + 15 * DAY), REFRESH_THRESHOLD_DAYS, NOW), false);
});

test('the threshold boundary counts as due', () => {
  // Renovar un día antes es preferible a renovar un día tarde.
  assert.equal(needsRefresh(new Date(NOW.getTime() + 14 * DAY), REFRESH_THRESHOLD_DAYS, NOW), true);
});

test('a token inside the window is due', () => {
  assert.equal(needsRefresh(new Date(NOW.getTime() + 13 * DAY), REFRESH_THRESHOLD_DAYS, NOW), true);
  assert.equal(needsRefresh(new Date(NOW.getTime() + DAY), REFRESH_THRESHOLD_DAYS, NOW), true);
});

test('an already expired token is due', () => {
  assert.equal(needsRefresh(new Date(NOW.getTime() - 5 * DAY), REFRESH_THRESHOLD_DAYS, NOW), true);
});

test('the threshold is configurable', () => {
  assert.equal(needsRefresh(new Date(NOW.getTime() + 20 * DAY), 30, NOW), true);
  assert.equal(needsRefresh(new Date(NOW.getTime() + 20 * DAY), 7, NOW), false);
});

test('a missing expires_in defaults to 60 days instead of an invalid date', () => {
  const expiry = resolveExpiryDate(undefined, NOW);
  assert.equal(Number.isNaN(expiry.getTime()), false);
  assert.equal(expiry.getTime(), NOW.getTime() + DEFAULT_TTL_SECONDS * 1000);
});

test('a non-numeric or zero expires_in also falls back to 60 days', () => {
  assert.equal(resolveExpiryDate('never', NOW).getTime(), NOW.getTime() + DEFAULT_TTL_SECONDS * 1000);
  assert.equal(resolveExpiryDate(0, NOW).getTime(), NOW.getTime() + DEFAULT_TTL_SECONDS * 1000);
  assert.equal(resolveExpiryDate(null, NOW).getTime(), NOW.getTime() + DEFAULT_TTL_SECONDS * 1000);
});

test('a numeric expires_in is honoured, including as a string', () => {
  assert.equal(resolveExpiryDate(3600, NOW).getTime(), NOW.getTime() + 3600 * 1000);
  assert.equal(resolveExpiryDate('7200', NOW).getTime(), NOW.getTime() + 7200 * 1000);
});

const { decideAgencyRefresh } = await import('../../src/lib/meta/token-refresh-policy.ts');

test('a system user token is never put through the exchange', () => {
  const decision = decideAgencyRefresh({ mode: 'system_user', expiresAt: null });
  assert.equal(decision.action, 'pages_only');
});

test('force does not override the system user case', () => {
  // La ruta manual /api/cron/refresh-social-tokens permite forzar. Intercambiar
  // un token de usuario del sistema no devuelve otro token de sistema, así que
  // forzar aquí solo rompería la conexión.
  const decision = decideAgencyRefresh({ mode: 'system_user', expiresAt: null, force: true });
  assert.equal(decision.action, 'pages_only');
});

test('an oauth token without an expiry date is skipped, not exchanged', () => {
  const decision = decideAgencyRefresh({ mode: 'oauth', expiresAt: null });
  assert.equal(decision.action, 'skip');
});

test('an oauth token far from expiry is left alone', () => {
  const now = new Date('2026-09-10T00:00:00Z');
  const expiresAt = new Date('2026-11-09T00:00:00Z'); // 60 días

  assert.equal(decideAgencyRefresh({ mode: 'oauth', expiresAt, now }).action, 'skip');
});

test('an oauth token inside the threshold is exchanged', () => {
  const now = new Date('2026-09-10T00:00:00Z');
  const expiresAt = new Date('2026-09-20T00:00:00Z'); // 10 días, bajo el umbral de 14

  assert.equal(decideAgencyRefresh({ mode: 'oauth', expiresAt, now }).action, 'exchange');
  // Forzar sí aplica en modo OAuth: ahí el intercambio tiene sentido.
  assert.equal(
    decideAgencyRefresh({ mode: 'oauth', expiresAt: new Date('2026-11-09T00:00:00Z'), now, force: true }).action,
    'exchange'
  );
});
