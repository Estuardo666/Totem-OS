import assert from "node:assert/strict";
import test from "node:test";
import { calculateProfitShares } from "../../src/lib/finance-distribution-invariants.ts";

test("reparte en centavos y conserva exactamente el total", () => {
  const result = calculateProfitShares(100, [
    { userId: "a", percent: 33.33 },
    { userId: "b", percent: 33.33 },
    { userId: "c", percent: 33.34 },
  ]);
  assert.equal(result.reduce((sum, item) => sum + item.amount, 0), 100);
  assert.deepEqual(result.map((item) => item.amount), [33.33, 33.33, 33.34]);
});

test("rechaza porcentajes que no suman 100 y usuarios repetidos", () => {
  assert.throws(
    () => calculateProfitShares(100, [{ userId: "a", percent: 50 }]),
    /debe ser 100%/
  );
  assert.throws(
    () => calculateProfitShares(100, [
      { userId: "a", percent: 50 },
      { userId: "a", percent: 50 },
    ]),
    /aparece mas de una vez/
  );
});

test("asigna de forma determinista el ultimo centavo", () => {
  const result = calculateProfitShares(0.01, [
    { userId: "a", percent: 50 },
    { userId: "b", percent: 50 },
  ]);
  assert.deepEqual(result.map((item) => item.amount), [0.01, 0]);
});
