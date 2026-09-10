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
