import assert from "node:assert/strict";
import test from "node:test";
import { isInBusinessMonth, mixedDateQueryRange } from "../../src/lib/business-month.ts";

test("a day-1 calendar invoice (UTC midnight) stays in its own month", () => {
  const generatedAt = new Date("2026-10-01T00:00:00Z");
  assert.equal(isInBusinessMonth(generatedAt, 2026, 10), true);
  assert.equal(isInBusinessMonth(generatedAt, 2026, 9), false);
  const range = mixedDateQueryRange(2026, 10);
  assert.ok(generatedAt >= range.start && generatedAt <= range.end);
});

test("a real moment late on the 30th in Ecuador stays in the previous month", () => {
  const createdAt = new Date("2026-10-01T01:00:00Z"); // 30 sep 20:00 en Ecuador
  assert.equal(isInBusinessMonth(createdAt, 2026, 9), true);
  assert.equal(isInBusinessMonth(createdAt, 2026, 10), false);
});

test("a real moment late on the last day is caught by the query range", () => {
  const createdAt = new Date("2026-11-01T03:00:00Z"); // 31 oct 22:00 en Ecuador
  const range = mixedDateQueryRange(2026, 10);
  assert.ok(createdAt <= range.end);
  assert.equal(isInBusinessMonth(createdAt, 2026, 10), true);
});
