import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateTreasuryPosition,
  isExpensePaidFromCompanyCash,
} from "../../src/lib/finance-treasury-logic.ts";

test("separa costos devengados de salidas reales de caja", () => {
  assert.equal(isExpensePaidFromCompanyCash({ paidByUserId: null, reimbursed: false }), true);
  assert.equal(isExpensePaidFromCompanyCash({ paidByUserId: "user-1", reimbursed: true }), true);
  assert.equal(isExpensePaidFromCompanyCash({ paidByUserId: "user-1", reimbursed: false }), false);
});

test("conserva los indicadores de tesorería verificados para septiembre", () => {
  const result = calculateTreasuryPosition({
    collectedCash: 1140,
    directCashOut: 1030.53,
    operatingCashOut: 93.16,
    savingsContributions: 0,
    savingsWithdrawals: 0,
    pendingReimbursements: 80.05,
    pendingExpenseTransactions: 54.12,
    pendingCompensation: 0,
  });

  assert.deepEqual(result, {
    paidCashOut: 1123.69,
    availableToAllocate: 16.31,
    transferredToSavings: 0,
    withdrawnFromSavings: 0,
    pendingCommitments: 134.17,
    operatingEndingBalance: 16.31,
  });
});

test("separa ahorro y compromisos del disponible por asignar", () => {
  const result = calculateTreasuryPosition({
    collectedCash: 1000,
    directCashOut: 500,
    operatingCashOut: 100,
    savingsContributions: 150,
    savingsWithdrawals: 20,
    pendingReimbursements: 25,
    pendingExpenseTransactions: 40,
    pendingCompensation: 10,
  });

  assert.equal(result.availableToAllocate, 400);
  assert.equal(result.transferredToSavings, 150);
  assert.equal(result.withdrawnFromSavings, 20);
  assert.equal(result.operatingEndingBalance, 270);
  assert.equal(result.pendingCommitments, 75);
});
