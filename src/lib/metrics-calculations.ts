import type { TaskMetrics } from "@prisma/client";

/**
 * Calcula el Engagement Total Global (suma de likes + comments + shares + saves de ambas plataformas)
 */
export function calculateEngagementTotal(metrics: TaskMetrics | null): number {
  if (!metrics) return 0;
  const metaEngagement = (metrics.metaLikes || 0) + (metrics.metaComments || 0) + (metrics.metaShares || 0) + (metrics.metaSaves || 0);
  const ttEngagement = (metrics.ttLikes || 0) + (metrics.ttComments || 0) + (metrics.ttShares || 0) + (metrics.ttSaves || 0);
  return metaEngagement + ttEngagement;
}

/**
 * Calcula la Lealtad de Marca como porcentaje: (saves + shares) / reach (Meta) o views (TikTok)
 * Usa la plataforma con más datos disponibles
 * Retorna 0 si no hay métricas
 */
export function calculateBrandLoyalty(metrics: TaskMetrics | null): number {
  if (!metrics) return 0;
  
  const metaSaves = metrics.metaSaves || 0;
  const metaShares = metrics.metaShares || 0;
  const metaReach = metrics.metaReach || 0;
  
  const ttSaves = metrics.ttSaves || 0;
  const ttShares = metrics.ttShares || 0;
  const ttViews = metrics.ttViews || 0;
  
  // Calcular para Meta
  const metaLoyalty = metaReach > 0 ? ((metaSaves + metaShares) / metaReach) * 100 : 0;
  
  // Calcular para TikTok
  const ttLoyalty = ttViews > 0 ? ((ttSaves + ttShares) / ttViews) * 100 : 0;
  
  // Retornar el promedio si ambas tienen datos, o la que tenga datos
  if (metaLoyalty > 0 && ttLoyalty > 0) {
    return Math.round(((metaLoyalty + ttLoyalty) / 2) * 100) / 100;
  } else if (metaLoyalty > 0) {
    return Math.round(metaLoyalty * 100) / 100;
  } else if (ttLoyalty > 0) {
    return Math.round(ttLoyalty * 100) / 100;
  }
  
  return 0;
}

/**
 * Calcula la Eficiencia de Inversión: monthlyRate / Engagement Total Global
 * Retorna 0 si no hay engagement o monthlyRate es 0
 */
export function calculateInvestmentEfficiency(
  metrics: TaskMetrics | null,
  monthlyRate: number
): number {
  if (!metrics || monthlyRate === 0) return 0;
  const engagement = calculateEngagementTotal(metrics);
  if (engagement === 0) return 0;
  const efficiency = monthlyRate / engagement;
  return Math.round(efficiency * 100) / 100; // Redondear a 2 decimales
}

/**
 * Calcula el Engagement Total mensual sumando todas las métricas de tareas publicadas
 */
export function calculateMonthlyEngagement(
  tasksWithMetrics: Array<{
    metrics: TaskMetrics | null;
    publishedAt: Date | null;
  }>
): number {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  return tasksWithMetrics
    .filter((task) => {
      if (!task.publishedAt) return false;
      const publishedDate = new Date(task.publishedAt);
      return publishedDate >= monthStart && publishedDate <= monthEnd;
    })
    .reduce((total, task) => {
      return total + calculateEngagementTotal(task.metrics);
    }, 0);
}

/**
 * Calcula la Eficiencia Mensual: monthlyRate / Monthly Engagement Total
 */
export function calculateMonthlyEfficiency(
  monthlyEngagement: number,
  monthlyRate: number
): number {
  if (monthlyEngagement === 0 || monthlyRate === 0) return 0;
  const efficiency = monthlyRate / monthlyEngagement;
  return Math.round(efficiency * 100) / 100; // Redondear a 2 decimales
}

/**
 * Formatea un número como moneda en USD
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

