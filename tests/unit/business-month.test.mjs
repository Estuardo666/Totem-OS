import assert from "node:assert/strict";
import test from "node:test";
import { ecuadorMonthTimestampRange } from "../../src/lib/business-month.ts";

const inRange = (iso, { start, end }) => {
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t <= end.getTime();
};

test("a payment on September 30 at 20:00 Ecuador time belongs to September", () => {
  const paidAt = "2026-10-01T01:00:00Z"; // 30 sep 20:00 en Ecuador
  assert.equal(inRange(paidAt, ecuadorMonthTimestampRange(2026, 9)), true);
  assert.equal(inRange(paidAt, ecuadorMonthTimestampRange(2026, 10)), false);
});

test("a payment on October 31 at 20:00 Ecuador time belongs to October", () => {
  const paidAt = "2026-11-01T01:00:00Z"; // 31 oct 20:00 en Ecuador
  assert.equal(inRange(paidAt, ecuadorMonthTimestampRange(2026, 10)), true);
  assert.equal(inRange(paidAt, ecuadorMonthTimestampRange(2026, 11)), false);
});

test("month edges are Ecuador midnights and consecutive months do not overlap", () => {
  const october = ecuadorMonthTimestampRange(2026, 10);
  const november = ecuadorMonthTimestampRange(2026, 11);
  assert.equal(october.start.toISOString(), "2026-10-01T05:00:00.000Z");
  assert.equal(october.end.getTime() + 1, november.start.getTime());
  const december = ecuadorMonthTimestampRange(2026, 12);
  assert.equal(december.end.toISOString(), "2027-01-01T04:59:59.999Z");
});

test("transactions dated to a past period stay in that period", () => {
  // resolvePeriodCreatedAt fecha los meses pasados el último día a las 17:00 UTC.
  assert.equal(inRange("2026-10-31T17:00:00Z", ecuadorMonthTimestampRange(2026, 10)), true);
});
