import test from "node:test";
import assert from "node:assert/strict";
import { evaluateWhatsAppWatchdog } from "../../src/lib/whatsapp/watchdog.ts";

const origin = new Date("2026-10-16T12:00:00.000Z");
const after = (minutes) => new Date(origin.getTime() + minutes * 60_000);
const check = (healthy, minutes) => ({ healthy, createdAt: after(minutes) });

test("watchdog alerta al completar cinco minutos consecutivos sin salud", () => {
  const checks = [check(false, 5), check(false, 4), check(false, 3), check(false, 2), check(false, 1), check(false, 0)];
  assert.equal(evaluateWhatsAppWatchdog({ checks, latestAlertAt: null, checkedAt: after(4.99) }).shouldAlert, false);
  const result = evaluateWhatsAppWatchdog({ checks, latestAlertAt: null, checkedAt: after(5) });
  assert.equal(result.shouldAlert, true);
  assert.equal(result.minutesDown, 5);
  assert.equal(result.failedSince.getTime(), origin.getTime());
});

test("un chequeo sano reinicia el periodo de caída", () => {
  const checks = [check(false, 5), check(false, 4), check(false, 3), check(false, 2), check(true, 1)];
  const result = evaluateWhatsAppWatchdog({ checks, latestAlertAt: null, checkedAt: after(5) });
  assert.equal(result.shouldAlert, false);
  assert.equal(result.minutesDown, 3);
  assert.equal(result.failedSince.getTime(), after(2).getTime());
});

test("no repite la alerta hasta que el worker se recupere y vuelva a caer", () => {
  const checks = [check(false, 6), check(false, 5), check(false, 4), check(false, 3), check(false, 2), check(false, 1), check(false, 0)];
  const alerted = evaluateWhatsAppWatchdog({ checks, latestAlertAt: after(4), checkedAt: after(6) });
  assert.equal(alerted.shouldAlert, false);

  const recoveredAndFailed = [check(false, 8), check(false, 7), check(false, 6), check(false, 5), check(false, 4), check(false, 3), check(true, 2)];
  const reset = evaluateWhatsAppWatchdog({ checks: recoveredAndFailed, latestAlertAt: after(1), checkedAt: after(8) });
  assert.equal(reset.shouldAlert, true);
  assert.equal(reset.minutesDown, 5);
});
