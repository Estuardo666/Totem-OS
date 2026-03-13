export interface AnalyticsKpiItem {
  title: string;
  value: string;
  detail: string;
  trend: number;
  tone: "positive" | "negative" | "neutral";
  helper: string;
}

export interface AnalyticsPredictionPoint {
  label: string;
  revenue: number;
  confidence: number;
}

export interface AnalyticsRiskItem {
  id: string;
  name: string;
  logo?: string | null;
  planValue: number;
  usagePercent: number;
  pendingAmount: number;
  riskScore: number;
  statusLabel: string;
  reason: string;
}

export interface AnalyticsRecommendationItem {
  id: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  impactLabel: string;
  actionLabel: string;
  helper: string;
}

export interface AnalyticsSummaryBlock {
  title: string;
  description: string;
  highlights: string[];
  helper: string;
}

export interface AnalyticsCurrentState {
  kpis: AnalyticsKpiItem[];
  cashflow: Array<{
    label: string;
    ingresos: number;
    egresos: number;
    utilidad: number;
  }>;
  clientFocus: AnalyticsRiskItem[];
  summary: AnalyticsSummaryBlock;
}

export interface AnalyticsForecastState {
  summary: AnalyticsSummaryBlock;
  projections: AnalyticsPredictionPoint[];
  forecastCards: Array<{
    title: string;
    value: string;
    support: string;
    helper: string;
  }>;
}

export interface AnalyticsActionState {
  summary: AnalyticsSummaryBlock;
  recommendations: AnalyticsRecommendationItem[];
}

export interface FinanceAiAnalyticsViewModel {
  current: AnalyticsCurrentState;
  forecast: AnalyticsForecastState;
  actions: AnalyticsActionState;
}
