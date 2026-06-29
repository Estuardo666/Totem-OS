/**
 * Pure finance logic functions for Profit Distribution and Emergency Fund.
 * No Prisma dependency — all functions are deterministic and testable.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProfitCalculationInput {
  collectedCash: number;
  totalExpensesPaid: number;
  totalHonorariosPaid: number;
  emergencyFundEnabled: boolean;
  emergencyFundContributionPct: number;
  emergencyFundCurrentBalance: number;
  emergencyFundMinBalance: number;
  reserveBeforeDistribution: boolean;
  profitDistributionEnabled: boolean;
}

export interface ProfitCalculationResult {
  netProfit: number;
  fundContribution: number;
  distributableAmount: number;
  canDistribute: boolean;
  reasonNoDistribution?: string;
}

export interface DistributionItemCalculation {
  userId: string;
  percent: number;
  amount: number;
}

export interface EmergencyFundCalculation {
  contribution: number;
  newBalance: number;
  exceedsMax: boolean;
  coverageMonths: number | null;
}

// ---------------------------------------------------------------------------
// Profit calculations
// ---------------------------------------------------------------------------

/**
 * Calculate net profit from collected cash minus paid expenses and honorarios.
 */
export function calcNetProfit(
  collectedCash: number,
  totalExpensesPaid: number,
  totalHonorariosPaid: number
): number {
  return collectedCash - totalExpensesPaid - totalHonorariosPaid;
}

/**
 * Calculate how much goes to emergency fund from net profit.
 * Respects: enabled flag, min balance (if already met, contribution = 0).
 */
export function calcEmergencyContribution(
  netProfit: number,
  contributionPct: number,
  currentBalance: number,
  minBalance: number,
  enabled: boolean
): number {
  if (!enabled || netProfit <= 0) return 0;
  if (currentBalance >= minBalance && minBalance > 0) return 0;

  const contribution = Math.max(0, netProfit * (contributionPct / 100));

  // Don't overshoot minBalance
  if (minBalance > 0) {
    const remaining = Math.max(0, minBalance - currentBalance);
    return Math.min(contribution, remaining);
  }

  return contribution;
}

/**
 * Full profit calculation pipeline.
 */
export function calcProfit(input: ProfitCalculationInput): ProfitCalculationResult {
  const netProfit = calcNetProfit(
    input.collectedCash,
    input.totalExpensesPaid,
    input.totalHonorariosPaid
  );

  if (!input.profitDistributionEnabled) {
    return {
      netProfit,
      fundContribution: 0,
      distributableAmount: 0,
      canDistribute: false,
      reasonNoDistribution: "La distribución de utilidades no está habilitada",
    };
  }

  const fundContribution = input.reserveBeforeDistribution
    ? calcEmergencyContribution(
        netProfit,
        input.emergencyFundContributionPct,
        input.emergencyFundCurrentBalance,
        input.emergencyFundMinBalance,
        input.emergencyFundEnabled
      )
    : 0;

  const distributableAmount = Math.max(0, netProfit - fundContribution);

  if (netProfit <= 0) {
    return {
      netProfit,
      fundContribution: 0,
      distributableAmount: 0,
      canDistribute: false,
      reasonNoDistribution: `Utilidad negativa o cero ($${netProfit.toFixed(2)}). No hay nada que distribuir.`,
    };
  }

  if (distributableAmount <= 0) {
    return {
      netProfit,
      fundContribution,
      distributableAmount: 0,
      canDistribute: false,
      reasonNoDistribution: "El aporte al fondo absorbe toda la utilidad del mes",
    };
  }

  return {
    netProfit,
    fundContribution,
    distributableAmount,
    canDistribute: true,
  };
}

// ---------------------------------------------------------------------------
// Distribution item calculations
// ---------------------------------------------------------------------------

/**
 * Calculate individual distribution items from a distributable amount and user percentages.
 * Returns items sorted by userId for deterministic output.
 */
export function calcDistributionItems(
  distributableAmount: number,
  userPercents: Array<{ userId: string; percent: number }>
): DistributionItemCalculation[] {
  if (distributableAmount <= 0 || userPercents.length === 0) return [];

  return userPercents
    .filter((u) => u.percent > 0)
    .map((u) => ({
      userId: u.userId,
      percent: u.percent,
      amount: Math.round(distributableAmount * (u.percent / 100) * 100) / 100,
    }))
    .sort((a, b) => a.userId.localeCompare(b.userId));
}

/**
 * Validate that distribution items sum to 100% (within tolerance).
 */
export function validateDistributionPercentages(
  items: Array<{ percent: number }>,
  tolerance = 0.01
): { valid: boolean; totalPercent: number } {
  const totalPercent = items.reduce((sum, item) => sum + item.percent, 0);
  return {
    valid: Math.abs(totalPercent - 100) <= tolerance,
    totalPercent,
  };
}

// ---------------------------------------------------------------------------
// Emergency fund calculations
// ---------------------------------------------------------------------------

/**
 * Calculate new balance after a contribution.
 */
export function calcFundBalanceAfterContribution(
  currentBalance: number,
  contribution: number
): number {
  return Math.round((currentBalance + contribution) * 100) / 100;
}

/**
 * Calculate new balance after a withdrawal.
 */
export function calcFundBalanceAfterWithdrawal(
  currentBalance: number,
  withdrawalAmount: number
): { newBalance: number; valid: boolean } {
  const newBalance = Math.round((currentBalance - withdrawalAmount) * 100) / 100;
  return {
    newBalance,
    valid: newBalance >= 0,
  };
}

/**
 * Calculate how many months of expenses the fund can cover.
 * Returns null if avgMonthlyExpenses is 0.
 */
export function calcFundCoverageMonths(
  currentBalance: number,
  avgMonthlyExpenses: number
): number | null {
  if (avgMonthlyExpenses <= 0) return null;
  return Math.round((currentBalance / avgMonthlyExpenses) * 10) / 10;
}

/**
 * Format a month number to Spanish name.
 */
export function getMonthName(month: number): string {
  const names = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];
  return names[month - 1] ?? `Mes ${month}`;
}
