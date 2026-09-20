export type TreasuryPositionInput = {
  collectedCash: number;
  directCashOut: number;
  operatingCashOut: number;
  savingsContributions: number;
  savingsWithdrawals: number;
  pendingReimbursements: number;
  pendingExpenseTransactions: number;
  pendingCompensation: number;
};

const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function isExpensePaidFromCompanyCash(expense: {
  paidByUserId: string | null;
  reimbursed: boolean;
}) {
  return expense.paidByUserId === null || expense.reimbursed;
}

export function calculateTreasuryPosition(input: TreasuryPositionInput) {
  const paidCashOut = roundCurrency(input.directCashOut + input.operatingCashOut);
  const availableToAllocate = roundCurrency(input.collectedCash - paidCashOut);
  const transferredToSavings = roundCurrency(input.savingsContributions);
  const withdrawnFromSavings = roundCurrency(input.savingsWithdrawals);
  const pendingCommitments = roundCurrency(
    input.pendingReimbursements +
      input.pendingExpenseTransactions +
      input.pendingCompensation
  );
  const operatingEndingBalance = roundCurrency(
    availableToAllocate - transferredToSavings + withdrawnFromSavings
  );

  return {
    paidCashOut,
    availableToAllocate,
    transferredToSavings,
    withdrawnFromSavings,
    pendingCommitments,
    operatingEndingBalance,
  };
}
