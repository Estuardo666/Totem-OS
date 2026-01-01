"use server";

import { db } from "@/lib/db";
import { updateTaskMetricsSchema } from "@/schemas/content";
import type { ApiResponse } from "@/types";
import type { TaskMetrics } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { generatePerformanceAnalysis } from "@/lib/ai/ai-orchestrator";
import type { PerformanceContext } from "@/lib/ai/performance-prompts";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { fetchPageMetrics, transformMetricsForStorage, TokenExpiredError, InsufficientPermissionsError } from "@/lib/meta/metrics-service";

/**
 * Calcula el Engagement Rate para Meta (Instagram/Facebook)
 * Fórmula: ((Likes + Comments + Shares + Saves) / Reach) * 100
 */
function calculateERMeta(
  likes: number,
  comments: number,
  shares: number,
  saves: number,
  reach: number
): number {
  const totalEngagement = likes + comments + shares + saves;
  if (reach === 0) return 0;
  return (totalEngagement / reach) * 100;
}

/**
 * Calcula el Engagement Rate para TikTok
 * Fórmula: ((Likes + Comments + Shares + Saves) / Views) * 100
 */
function calculateERTikTok(
  likes: number,
  comments: number,
  shares: number,
  saves: number,
  views: number
): number {
  const totalEngagement = likes + comments + shares + saves;
  if (views === 0) return 0;
  return (totalEngagement / views) * 100;
}

/**
 * Calcula Total Brand Awareness: Reach Meta + Views TikTok
 */
function calculateTotalBrandAwareness(metaReach: number, ttViews: number): number {
  return metaReach + ttViews;
}

/**
 * Calcula Global Social Proof: Suma total de Likes y Comentarios de ambas plataformas
 */
function calculateGlobalSocialProof(
  metaLikes: number,
  metaComments: number,
  ttLikes: number,
  ttComments: number
): number {
  return metaLikes + metaComments + ttLikes + ttComments;
}

/**
 * Calcula Virality Index: Relación de Shares vs Views
 * Fórmula: (Total Shares / Total Views) * 100
 */
function calculateViralityIndex(
  metaShares: number,
  metaViews: number,
  ttShares: number,
  ttViews: number
): number {
  const totalShares = metaShares + ttShares;
  const totalViews = metaViews + ttViews;
  if (totalViews === 0) return 0;
  return (totalShares / totalViews) * 100;
}

/**
 * Calcula Efficiency Score: Promedio ponderado del Engagement Rate global
 * Ponderación: 60% Meta, 40% TikTok (si ambas tienen datos)
 */
function calculateEfficiencyScore(erMeta: number, erTikTok: number): number {
  const hasMeta = erMeta > 0;
  const hasTikTok = erTikTok > 0;

  if (hasMeta && hasTikTok) {
    // Promedio ponderado: 60% Meta, 40% TikTok
    return erMeta * 0.6 + erTikTok * 0.4;
  } else if (hasMeta) {
    return erMeta;
  } else if (hasTikTok) {
    return erTikTok;
  }
  return 0;
}

/**
 * Calcula CPA (Costo por Adquisición): budget / salesCount
 */
function calculateCPA(budget: number | null, salesCount: number): number {
  if (!budget || budget === 0 || salesCount === 0) return 0;
  return budget / salesCount;
}

/**
 * Calcula ROAS (Retorno a la Inversión Publicitaria): revenue / budget
 */
function calculateROAS(revenue: number, budget: number | null): number {
  if (!budget || budget === 0) return 0;
  return revenue / budget;
}

/**
 * Calcula CR (Conversion Rate): (conversions / (metaReach + ttViews)) * 100
 */
function calculateConversionRate(
  conversions: number,
  metaReach: number,
  ttViews: number
): number {
  const totalReach = metaReach + ttViews;
  if (totalReach === 0) return 0;
  return (conversions / totalReach) * 100;
}

/**
 * Actualiza o crea las métricas de una tarea
 * Calcula automáticamente todos los KPIs avanzados
 */
export async function updateTaskMetrics(
  input: unknown
): Promise<ApiResponse<TaskMetrics>> {
  try {
    // 1. Validar con Zod
    const validatedData = updateTaskMetricsSchema.parse(input);

    // 2. Calcular todos los KPIs avanzados
    const erMeta = calculateERMeta(
      validatedData.metaLikes,
      validatedData.metaComments,
      validatedData.metaShares,
      validatedData.metaSaves,
      validatedData.metaReach
    );

    const erTikTok = calculateERTikTok(
      validatedData.ttLikes,
      validatedData.ttComments,
      validatedData.ttShares,
      validatedData.ttSaves,
      validatedData.ttViews
    );

    const totalBrandAwareness = calculateTotalBrandAwareness(
      validatedData.metaReach,
      validatedData.ttViews
    );

    const globalSocialProof = calculateGlobalSocialProof(
      validatedData.metaLikes,
      validatedData.metaComments,
      validatedData.ttLikes,
      validatedData.ttComments
    );

    const viralityIndex = calculateViralityIndex(
      validatedData.metaShares,
      validatedData.metaViews,
      validatedData.ttShares,
      validatedData.ttViews
    );

    const efficiencyScore = calculateEfficiencyScore(erMeta, erTikTok);

    // Calcular métricas de negocio
    const cpa = calculateCPA(
      validatedData.totalBudgetSpent,
      validatedData.salesCount
    );
    const roas = calculateROAS(
      validatedData.revenue,
      validatedData.totalBudgetSpent
    );
    const conversionRate = calculateConversionRate(
      validatedData.conversions,
      validatedData.metaReach,
      validatedData.ttViews
    );

    // 3. Actualizar o crear métricas
    const metrics = await db.taskMetrics.upsert({
      where: { taskId: validatedData.taskId },
      update: {
        metaViews: validatedData.metaViews,
        metaLikes: validatedData.metaLikes,
        metaShares: validatedData.metaShares,
        metaComments: validatedData.metaComments,
        metaSaves: validatedData.metaSaves,
        metaReach: validatedData.metaReach,
        ttViews: validatedData.ttViews,
        ttLikes: validatedData.ttLikes,
        ttShares: validatedData.ttShares,
        ttComments: validatedData.ttComments,
        ttSaves: validatedData.ttSaves,
        totalBudgetSpent: validatedData.totalBudgetSpent,
        notes: validatedData.notes,
        conversions: validatedData.conversions,
        salesCount: validatedData.salesCount,
        revenue: validatedData.revenue,
        conversionSource: validatedData.conversionSource,
        erMeta,
        erTikTok,
        totalBrandAwareness,
        globalSocialProof,
        viralityIndex,
        efficiencyScore,
        cpa,
        roas,
        conversionRate,
      },
      create: {
        taskId: validatedData.taskId,
        metaViews: validatedData.metaViews,
        metaLikes: validatedData.metaLikes,
        metaShares: validatedData.metaShares,
        metaComments: validatedData.metaComments,
        metaSaves: validatedData.metaSaves,
        metaReach: validatedData.metaReach,
        ttViews: validatedData.ttViews,
        ttLikes: validatedData.ttLikes,
        ttShares: validatedData.ttShares,
        ttComments: validatedData.ttComments,
        ttSaves: validatedData.ttSaves,
        totalBudgetSpent: validatedData.totalBudgetSpent,
        notes: validatedData.notes,
        conversions: validatedData.conversions,
        salesCount: validatedData.salesCount,
        revenue: validatedData.revenue,
        conversionSource: validatedData.conversionSource,
        erMeta,
        erTikTok,
        totalBrandAwareness,
        globalSocialProof,
        viralityIndex,
        efficiencyScore,
        cpa,
        roas,
        conversionRate,
      },
    });

    // 4. Revalidar rutas relacionadas
    revalidatePath("/content");
    revalidatePath("/content/dashboard");
    revalidatePath(`/clients/${validatedData.taskId}`);

    return { success: true, data: metrics };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al actualizar métricas",
    };
  }
}

/**
 * Obtiene las métricas globales avanzadas de un cliente
 */
export async function getClientGlobalMetrics(
  clientId: string
): Promise<ApiResponse<{
  totalImpressions: number;
  totalCommunityGrowth: number;
  globalVirality: number;
  crossPlatformEfficiency: number;
  metaMetrics: {
    totalReach: number;
    totalInteractions: number;
    averageER: number;
  };
  tiktokMetrics: {
    totalViews: number;
    totalInteractions: number;
    averageER: number;
  };
  businessMetrics: {
    totalRevenue: number;
    totalConversions: number;
    totalSales: number;
    averageConversionRate: number;
    averageCPA: number;
    averageROAS: number;
  };
}>> {
  try {
    const tasks = await db.contentTask.findMany({
      where: {
        clientId,
        status: "PUBLISHED",
      },
      include: {
        metrics: true,
      },
    });

    const metricsWithData = tasks.filter((task) => task.metrics !== null);

    if (metricsWithData.length === 0) {
      return {
        success: true,
        data: {
          totalImpressions: 0,
          totalCommunityGrowth: 0,
          globalVirality: 0,
          crossPlatformEfficiency: 0,
          metaMetrics: {
            totalReach: 0,
            totalInteractions: 0,
            averageER: 0,
          },
          tiktokMetrics: {
            totalViews: 0,
            totalInteractions: 0,
            averageER: 0,
          },
          businessMetrics: {
            totalRevenue: 0,
            totalConversions: 0,
            totalSales: 0,
            averageConversionRate: 0,
            averageCPA: 0,
            averageROAS: 0,
          },
        },
      };
    }

    // Calcular métricas Meta
    const totalMetaReach = metricsWithData.reduce(
      (sum, task) => sum + (task.metrics?.metaReach || 0),
      0
    );
    const totalMetaInteractions = metricsWithData.reduce(
      (sum, task) =>
        sum +
        (task.metrics?.metaLikes || 0) +
        (task.metrics?.metaComments || 0) +
        (task.metrics?.metaShares || 0) +
        (task.metrics?.metaSaves || 0),
      0
    );
    const totalMetaER = metricsWithData.reduce(
      (sum, task) => sum + (task.metrics?.erMeta || 0),
      0
    );
    const averageMetaER = totalMetaER / metricsWithData.length;

    // Calcular métricas TikTok
    const totalTikTokViews = metricsWithData.reduce(
      (sum, task) => sum + (task.metrics?.ttViews || 0),
      0
    );
    const totalTikTokInteractions = metricsWithData.reduce(
      (sum, task) =>
        sum +
        (task.metrics?.ttLikes || 0) +
        (task.metrics?.ttComments || 0) +
        (task.metrics?.ttShares || 0) +
        (task.metrics?.ttSaves || 0),
      0
    );
    const totalTikTokER = metricsWithData.reduce(
      (sum, task) => sum + (task.metrics?.erTikTok || 0),
      0
    );
    const averageTikTokER = totalTikTokER / metricsWithData.length;

    // Calcular KPIs globales
    const totalImpressions = totalMetaReach + totalTikTokViews;
    const totalCommunityGrowth =
      metricsWithData.reduce(
        (sum, task) =>
          sum +
          (task.metrics?.metaLikes || 0) +
          (task.metrics?.metaComments || 0) +
          (task.metrics?.ttLikes || 0) +
          (task.metrics?.ttComments || 0),
        0
      ) / metricsWithData.length;

    const totalShares = metricsWithData.reduce(
      (sum, task) =>
        sum + (task.metrics?.metaShares || 0) + (task.metrics?.ttShares || 0),
      0
    );
    const globalVirality =
      totalImpressions > 0 ? (totalShares / totalImpressions) * 100 : 0;

    const totalEfficiencyScores = metricsWithData.reduce(
      (sum, task) => sum + (task.metrics?.efficiencyScore || 0),
      0
    );
    const crossPlatformEfficiency =
      totalEfficiencyScores / metricsWithData.length;

    // Calcular métricas de negocio
    const totalRevenue = metricsWithData.reduce(
      (sum, task) => sum + (task.metrics?.revenue || 0),
      0
    );
    const totalConversions = metricsWithData.reduce(
      (sum, task) => sum + (task.metrics?.conversions || 0),
      0
    );
    const totalSales = metricsWithData.reduce(
      (sum, task) => sum + (task.metrics?.salesCount || 0),
      0
    );
    const totalConversionRates = metricsWithData.reduce(
      (sum, task) => sum + (task.metrics?.conversionRate || 0),
      0
    );
    const averageConversionRate = metricsWithData.length > 0
      ? totalConversionRates / metricsWithData.length
      : 0;
    
    const totalCPA = metricsWithData.reduce(
      (sum, task) => sum + (task.metrics?.cpa || 0),
      0
    );
    const averageCPA = metricsWithData.length > 0
      ? totalCPA / metricsWithData.length
      : 0;
    
    const totalROAS = metricsWithData.reduce(
      (sum, task) => sum + (task.metrics?.roas || 0),
      0
    );
    const averageROAS = metricsWithData.length > 0
      ? totalROAS / metricsWithData.length
      : 0;

    return {
      success: true,
      data: {
        totalImpressions,
        totalCommunityGrowth,
        globalVirality,
        crossPlatformEfficiency,
        metaMetrics: {
          totalReach: totalMetaReach,
          totalInteractions: totalMetaInteractions,
          averageER: averageMetaER,
        },
        tiktokMetrics: {
          totalViews: totalTikTokViews,
          totalInteractions: totalTikTokInteractions,
          averageER: averageTikTokER,
        },
        businessMetrics: {
          totalRevenue,
          totalConversions,
          totalSales,
          averageConversionRate,
          averageCPA,
          averageROAS,
        },
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al obtener métricas globales",
    };
  }
}

/**
 * Obtiene las últimas tareas publicadas de un cliente con sus métricas
 */
export async function getClientRecentTasksWithMetrics(
  clientId: string,
  limit: number = 10
): Promise<ApiResponse<Array<{
  id: string;
  title: string;
  type: string;
  publishedAt: Date | null;
  metrics: {
    metaViews: number;
    metaReach: number;
    metaLikes: number;
    metaComments: number;
    metaShares: number;
    metaSaves: number;
    erMeta: number;
    ttViews: number;
    ttLikes: number;
    ttComments: number;
    ttShares: number;
    ttSaves: number;
    erTikTok: number;
    totalBrandAwareness: number;
    globalSocialProof: number;
    viralityIndex: number;
    efficiencyScore: number;
  } | null;
}>>> {
  try {
    const tasks = await db.contentTask.findMany({
      where: {
        clientId,
        status: "PUBLISHED",
      },
      include: {
        metrics: true,
      },
      orderBy: {
        publishedAt: "desc",
      },
      take: limit,
    });

    const tasksWithMetrics = tasks.map((task) => ({
      id: task.id,
      title: task.title,
      type: task.type,
      publishedAt: task.publishedAt,
      metrics: task.metrics
        ? {
            metaViews: task.metrics.metaViews,
            metaReach: task.metrics.metaReach,
            metaLikes: task.metrics.metaLikes,
            metaComments: task.metrics.metaComments,
            metaShares: task.metrics.metaShares,
            metaSaves: task.metrics.metaSaves,
            erMeta: task.metrics.erMeta,
            ttViews: task.metrics.ttViews,
            ttLikes: task.metrics.ttLikes,
            ttComments: task.metrics.ttComments,
            ttShares: task.metrics.ttShares,
            ttSaves: task.metrics.ttSaves,
            erTikTok: task.metrics.erTikTok,
            totalBrandAwareness: task.metrics.totalBrandAwareness,
            globalSocialProof: task.metrics.globalSocialProof,
            viralityIndex: task.metrics.viralityIndex,
            efficiencyScore: task.metrics.efficiencyScore,
          }
        : null,
    }));

    return { success: true, data: tasksWithMetrics };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al obtener tareas con métricas",
    };
  }
}

/**
 * Obtiene el histórico anual de métricas de un cliente
 */
export async function getClientAnnualMetrics(
  clientId: string,
  year: number = new Date().getFullYear()
): Promise<ApiResponse<Array<{
  id: string;
  title: string;
  type: string;
  publishedAt: Date | null;
  metrics: {
    metaViews: number;
    metaReach: number;
    metaLikes: number;
    metaComments: number;
    metaShares: number;
    metaSaves: number;
    erMeta: number;
    ttViews: number;
    ttLikes: number;
    ttComments: number;
    ttShares: number;
    ttSaves: number;
    erTikTok: number;
    totalBrandAwareness: number;
    globalSocialProof: number;
    viralityIndex: number;
    efficiencyScore: number;
  } | null;
}>>> {
  try {
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);

    const tasks = await db.contentTask.findMany({
      where: {
        clientId,
        status: "PUBLISHED",
        publishedAt: {
          gte: yearStart,
          lte: yearEnd,
        },
      },
      include: {
        metrics: true,
      },
      orderBy: {
        publishedAt: "desc",
      },
    });

    const tasksWithMetrics = tasks.map((task) => ({
      id: task.id,
      title: task.title,
      type: task.type,
      publishedAt: task.publishedAt,
      metrics: task.metrics
        ? {
            metaViews: task.metrics.metaViews,
            metaReach: task.metrics.metaReach,
            metaLikes: task.metrics.metaLikes,
            metaComments: task.metrics.metaComments,
            metaShares: task.metrics.metaShares,
            metaSaves: task.metrics.metaSaves,
            erMeta: task.metrics.erMeta,
            ttViews: task.metrics.ttViews,
            ttLikes: task.metrics.ttLikes,
            ttComments: task.metrics.ttComments,
            ttShares: task.metrics.ttShares,
            ttSaves: task.metrics.ttSaves,
            erTikTok: task.metrics.erTikTok,
            totalBrandAwareness: task.metrics.totalBrandAwareness,
            globalSocialProof: task.metrics.globalSocialProof,
            viralityIndex: task.metrics.viralityIndex,
            efficiencyScore: task.metrics.efficiencyScore,
          }
        : null,
    }));

    return { success: true, data: tasksWithMetrics };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al obtener histórico anual",
    };
  }
}

/**
 * Genera un análisis de performance usando IA
 * Solo accesible para ADMIN y EDITOR
 */
export async function generateClientPerformanceOverview(
  clientId: string
): Promise<ApiResponse<{ overview: string; generatedAt: Date }>> {
  try {
    // 1. Validar sesión y permisos
    const session = await auth();
    if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "EDITOR")) {
      return {
        success: false,
        error: "No autorizado. Solo ADMIN y EDITOR pueden generar análisis de IA.",
      };
    }

    // 2. Obtener cliente con brandDNA
    const client = await db.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        name: true,
        brandDNA: true,
      },
    });

    if (!client) {
      return {
        success: false,
        error: "Cliente no encontrado",
      };
    }

    // 3. Parsear brandDNA
    let brandDNA: {
      businessDescription?: string;
      toneOfVoice?: string;
      audience?: string;
      values?: string;
      prohibitedTopics?: string;
    } = {};

    if (client.brandDNA) {
      try {
        brandDNA = JSON.parse(client.brandDNA);
      } catch (error) {
        console.error("Error al parsear brandDNA:", error);
      }
    }

    // 4. Obtener métricas globales del mes actual
    const metricsResult = await getClientGlobalMetrics(clientId);
    if (!metricsResult.success || !metricsResult.data) {
      return {
        success: false,
        error: "No se pudieron obtener las métricas del cliente",
      };
    }

    const metrics = metricsResult.data;

    // 5. Obtener el mes actual en formato legible
    const now = new Date();
    const month = format(now, "MMMM yyyy", { locale: es });

    // 6. Construir contexto para la IA
    const context: PerformanceContext = {
      clientName: client.name,
      brandDNA,
      metrics,
      month,
    };

    // 7. Generar análisis con IA
    const overview = await generatePerformanceAnalysis(context);

    // 8. Guardar en la base de datos
    await db.client.update({
      where: { id: clientId },
      data: {
        lastAiOverview: overview,
        lastAiOverviewDate: new Date(),
      },
    });

    // 9. Revalidar rutas
    revalidatePath(`/clients/${clientId}`);

    return {
      success: true,
      data: {
        overview,
        generatedAt: new Date(),
      },
    };
  } catch (error) {
    console.error("Error al generar análisis de performance:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al generar análisis de performance",
    };
  }
}

/**
 * Sincroniza las métricas de Facebook de un cliente desde la API de Meta
 * Obtiene los últimos 28 días de datos y los guarda en la base de datos
 */
export async function syncClientMetrics(
  clientId: string,
  days: number = 28
): Promise<ApiResponse<{ count: number }>> {
  try {
    // 1. Validar sesión y permisos
    const session = await auth();
    if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "EDITOR")) {
      return {
        success: false,
        error: "No autorizado. Solo ADMIN y EDITOR pueden sincronizar métricas.",
      };
    }

    // 2. Obtener cliente con pageAccessToken y facebookPageId
    const client = await db.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        name: true,
        facebookPageId: true,
        pageAccessToken: true,
      },
    });

    if (!client) {
      return {
        success: false,
        error: "Cliente no encontrado",
      };
    }

    if (!client.facebookPageId || !client.pageAccessToken) {
      return {
        success: false,
        error: "El cliente no tiene una página de Facebook vinculada. Por favor, vincula una página en la sección de Integraciones.",
      };
    }

    // 3. Obtener métricas de la API de Meta
    let metricsData;
    try {
      metricsData = await fetchPageMetrics(
        client.facebookPageId,
        client.pageAccessToken,
        days
      );
    } catch (error) {
      // Manejar errores específicos de token
      if (error instanceof TokenExpiredError) {
        return {
          success: false,
          error: error.message,
        };
      }
      if (error instanceof InsufficientPermissionsError) {
        return {
          success: false,
          error: error.message,
        };
      }
      throw error;
    }

    // 4. Transformar datos para almacenamiento
    const transformedMetrics = transformMetricsForStorage(
      metricsData,
      clientId,
      "FACEBOOK"
    );

    if (transformedMetrics.length === 0) {
      return {
        success: true,
        data: { count: 0 },
      };
    }

    // 5. Guardar en la base de datos usando upsert (batch transaction)
    await db.$transaction(
      transformedMetrics.map((metric) =>
        db.clientMetric.upsert({
          where: {
            clientId_platform_metricName_date: {
              clientId: metric.clientId,
              platform: metric.platform,
              metricName: metric.metricName,
              date: metric.date,
            },
          },
          update: {
            value: metric.value,
            fetchedAt: new Date(),
          },
          create: {
            clientId: metric.clientId,
            platform: metric.platform,
            metricName: metric.metricName,
            value: metric.value,
            date: metric.date,
            fetchedAt: new Date(),
          },
        })
      )
    );

    // 6. Revalidar rutas
    revalidatePath(`/clients/${clientId}`);

    return {
      success: true,
      data: { count: transformedMetrics.length },
    };
  } catch (error) {
    console.error("Error al sincronizar métricas:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error al sincronizar métricas",
    };
  }
}

/**
 * Obtiene las métricas de Facebook de un cliente desde la base de datos
 * Filtra por los últimos N días
 */
export async function getClientFacebookMetrics(
  clientId: string,
  days: number = 30
): Promise<ApiResponse<{
  overview: {
    impressions: number;
    engagements: number;
    fans: number;
  };
  chartData: Array<{
    date: string;
    impressions: number;
  }>;
}>> {
  try {
    // 1. Validar sesión
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: "No autorizado",
      };
    }

    // 2. Calcular fecha límite
    const since = new Date();
    since.setDate(since.getDate() - days);

    // 3. Obtener métricas de los últimos N días
    const metrics = await db.clientMetric.findMany({
      where: {
        clientId,
        platform: "FACEBOOK",
        date: {
          gte: since,
        },
      },
      orderBy: {
        date: "asc",
      },
    });

    // 4. Calcular totales para el overview
    const impressions = metrics
      .filter((m) => m.metricName === "page_impressions")
      .reduce((sum, m) => sum + m.value, 0);

    // Nota: page_engaged_users puede no estar disponible, usar 0 como fallback
    const engagements = metrics
      .filter((m) => m.metricName === "page_engaged_users")
      .reduce((sum, m) => sum + m.value, 0);

    // page_fans es lifetime, tomar el valor más reciente
    const fansMetrics = metrics
      .filter((m) => m.metricName === "page_fans")
      .sort((a, b) => b.date.getTime() - a.date.getTime());
    const fans = fansMetrics.length > 0 ? fansMetrics[0].value : 0;

    // 5. Preparar datos para el gráfico (últimos 28 días de impresiones)
    const impressionsByDate = metrics
      .filter((m) => m.metricName === "page_impressions")
      .reduce((acc, m) => {
        const dateKey = m.date.toISOString().split("T")[0];
        if (!acc[dateKey]) {
          acc[dateKey] = 0;
        }
        acc[dateKey] += m.value;
        return acc;
      }, {} as Record<string, number>);

    const chartData = Object.entries(impressionsByDate)
      .map(([date, impressions]) => ({
        date,
        impressions,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-28); // Últimos 28 días

    return {
      success: true,
      data: {
        overview: {
          impressions,
          engagements,
          fans,
        },
        chartData,
      },
    };
  } catch (error) {
    console.error("Error al obtener métricas de Facebook:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al obtener métricas",
    };
  }
}
