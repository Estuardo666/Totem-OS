export type MonthlyFinanceStats = {
  monthKey: string; // YYYY-MM
  income: number;
  expenses: number;
  netProfit: number;
  profitMargin: number; // 0-1
};

export type CashFlowRunwayResult = {
  cashOnHand: number;
  averageDailyExpense: number;
  runwayDays: number;
};

export function calculateProfitMargin(income: number, expenses: number): number {
  if (income <= 0) return 0;
  return (income - expenses) / income;
}

export function calculateRunwayDays(
  cashOnHand: number,
  averageDailyExpense: number
): CashFlowRunwayResult {
  const safeExpense = averageDailyExpense > 0 ? averageDailyExpense : 0;
  const runwayDays = safeExpense > 0 ? cashOnHand / safeExpense : Number.POSITIVE_INFINITY;

  return {
    cashOnHand,
    averageDailyExpense: safeExpense,
    runwayDays,
  };
}

export function isBudgetDeviationExceeded(
  actualExpenses: number,
  monthlyBudget: number,
  thresholdPercent: number
): boolean {
  if (monthlyBudget <= 0) return false;
  const allowed = monthlyBudget * (1 + thresholdPercent / 100);
  return actualExpenses > allowed;
}

export function isProfitabilityDropExceeded(
  currentMargin: number,
  historicalMargin: number,
  dropPercent: number
): boolean {
  if (historicalMargin <= 0) return false;
  const drop = (historicalMargin - currentMargin) / historicalMargin;
  return drop >= dropPercent / 100;
}

export function isExpenseAnomaly(
  current: number,
  historicalAverage: number,
  multiplier: number
): boolean {
  if (historicalAverage <= 0) return false;
  return current >= historicalAverage * multiplier;
}

export function toMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}`;
}
