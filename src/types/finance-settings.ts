export type BudgetUsageStatus = "normal" | "warning" | "alert" | "approval_required";

export interface FinanceBudgetOverview {
  baseIncome: number;
  trackedExpenses: number;
  globalBudgetLimit: number;
  globalBudgetRemaining: number;
  globalBudgetUsagePercent: number;
  globalBudgetStatus: BudgetUsageStatus;
  trackedCategories: string[];
  approvalRequiredOnExceed: boolean;
}

export interface FinanceUserBudgetSummary {
  userId: string;
  userName: string;
  consumedAmount: number;
  limitAmount: number;
  remainingAmount: number;
  usagePercent: number;
  status: BudgetUsageStatus;
}

export interface FinancePersonalAnalyticsSummary {
  userId: string;
  userName: string;
  paidAmount: number;
  consumedAmount: number;
  balance: number;
}

export interface FinancePersonalAnalyticsTransfer {
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: number;
}

export interface FinanceSettingsMetrics {
  overview: FinanceBudgetOverview;
  adminBudgets: FinanceUserBudgetSummary[];
  personalAnalytics: {
    enabled: boolean;
    summaries: FinancePersonalAnalyticsSummary[];
    suggestedTransfers: FinancePersonalAnalyticsTransfer[];
  };
}
