export type BillingExceptionRow = {
  clientId: string;
  month: number;
  year: number;
  type: string;
  overrideAmount: number | null;
};

export type ReceivableEntry = {
  clientName?: string;
  clientLogo?: string | null;
  amount: number;
  daysOverdue: number;
};

export type ClientSummaryAccumulator = {
  id: string;
  name: string;
  logo?: string | null;
  billingModel: "Recurrente" | "Proyecto";
  recognizedRevenue: number;
  collectedCash: number;
  directCosts: number;
  outstanding: number;
};

export type ReceivableRisk = "healthy" | "warning" | "critical";

export interface MonthlySummaryClientRow {
  id: string;
  name: string;
  logo?: string | null;
  billingModel: "Recurrente" | "Proyecto";
  recognizedRevenue: number;
  collectedCash: number;
  directCosts: number;
  contributionMargin: number;
  contributionMarginPct: number | null;
  outstanding: number;
  collectionStatus: "Al día" | "Pendiente" | "Pago parcial" | "Sin movimiento";
}

export interface MonthlySummaryAlert {
  tone: "healthy" | "warning" | "critical";
  title: string;
  description: string;
}

export interface MonthlySummaryComparisonMetric {
  key: "recognizedRevenue" | "collectedCash" | "operatingResult" | "closingReceivables";
  label: string;
  helper: string;
  currentValue: number;
  previousValue: number;
  deltaValue: number;
  deltaPct: number | null;
  tone: "positive" | "negative" | "neutral";
}

export interface MonthlySummaryComparison {
  previousPeriodLabel: string;
  summary: string;
  metrics: MonthlySummaryComparisonMetric[];
}

export interface MonthlySummaryHeroFocus {
  tone: "healthy" | "warning" | "critical";
  title: string;
  description: string;
  metricLabel: string;
  metricValue: number;
  metricFormat: "currency" | "percent";
  context: string;
}

export interface MonthlyFinancialSummaryData {
  period: {
    value: string;
    year: number;
    month: number;
    isCurrentMonth: boolean;
    cutoffLabel: string;
  };
  periodLabel: string;
  executive: {
    recognizedRevenue: number;
    collectedCash: number;
    directCosts: number;
    grossMargin: number;
    grossMarginPct: number;
    operatingExpenses: number;
    operatingResult: number;
    operatingMarginPct: number;
    closingReceivables: number;
    netCashFlow: number;
  };
  quality: {
    recurringCommittedRevenue: number;
    confirmedRecurringRevenue: number;
    pendingRecurringRevenue: number;
    extraordinaryRevenue: number;
    recurringSharePct: number;
    collectionEfficiencyPct: number;
    topClientConcentrationPct: number;
    isProvisional: boolean;
  };
  closureControl: {
    pendingCount: number;
    pendingAmount: number;
    pendingClients: Array<{
      id: string;
      name: string;
      logo?: string | null;
      monthlyRate: number;
    }>;
  };
  treasury: {
    collectedCash: number;
    directCashOut: number;
    operatingCashOut: number;
    pendingCommitments: number;
    pendingReimbursements: number;
    pendingExpenseTransactions: number;
    pendingCompensation: number;
  };
  receivables: {
    total: number;
    current: number;
    overdue1To30: number;
    overdue31To60: number;
    overdue61Plus: number;
    topDebtors: Array<{
      clientName: string;
      clientLogo?: string | null;
      amount: number;
      items: number;
      risk: ReceivableRisk;
    }>;
  };
  clients: MonthlySummaryClientRow[];
  alerts: MonthlySummaryAlert[];
  comparison: MonthlySummaryComparison;
  heroFocus: MonthlySummaryHeroFocus;
}
