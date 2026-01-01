"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { DollarSign, Clock, TrendingUp, Sparkles } from "lucide-react";
import { getWeeklyStats, getMonthlySalary } from "@/actions/time-tracking";
import { Skeleton } from "@/components/ui/skeleton";

interface TimeStatsProps {
  userId?: string;
}

export function TimeStats({ userId }: TimeStatsProps) {
  const [weeklyData, setWeeklyData] = useState<{
    dailyStats: Array<{ day: string; date: string; hours: number; earnings: number }>;
    totalHours: number;
    totalEarnings: number;
  } | null>(null);
  const [monthlyData, setMonthlyData] = useState<{
    monthlyEarnings: number;
    monthlyHours: number;
    averageHourlyRate: number;
    entryCount: number;
  } | null>(null);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [userId]);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const [weeklyResult, monthlyResult] = await Promise.all([
        getWeeklyStats(userId),
        getMonthlySalary(userId),
      ]);

      if (weeklyResult.success && weeklyResult.data) {
        setWeeklyData(weeklyResult.data);
      }
      if (monthlyResult.success && monthlyResult.data) {
        setMonthlyData(monthlyResult.data);
        // Generar insight básico (en una implementación real, esto podría usar IA)
        if (weeklyResult.success && weeklyResult.data) {
          generateInsight(weeklyResult.data, monthlyResult.data);
        }
      }
    } catch (error) {
      console.error("Error al cargar estadísticas:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateInsight = (
    weekly: typeof weeklyData,
    monthly: typeof monthlyData
  ) => {
    if (!weekly || !monthly) return;

    // Insight básico basado en comparación de horas
    const avgHoursPerDay = weekly.totalHours / 7;
    const expectedHoursPerDay = 8;
    const productivityRatio = avgHoursPerDay / expectedHoursPerDay;

    if (productivityRatio > 1.15) {
      setAiInsight("Esta semana has sido un 15% más productivo que lo esperado. ¡Excelente trabajo!");
    } else if (productivityRatio > 1.0) {
      setAiInsight("Esta semana has mantenido una buena productividad por encima del objetivo.");
    } else if (productivityRatio < 0.85) {
      setAiInsight("Esta semana tu productividad ha estado por debajo del objetivo. Considera revisar tu carga de trabajo.");
    } else {
      setAiInsight("Esta semana has mantenido un ritmo de trabajo estable y constante.");
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatHours = (hours: number): string => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (h > 0) {
      return `${h}h ${m > 0 ? `${m}m` : ""}`.trim();
    }
    return `${m}m`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Salario Acumulado este Mes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {monthlyData ? formatCurrency(monthlyData.monthlyEarnings) : "$0.00"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {monthlyData?.entryCount || 0} sesiones registradas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Horas Totales (Semana)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {weeklyData ? formatHours(weeklyData.totalHours) : "0h"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Mes actual: {monthlyData ? formatHours(monthlyData.monthlyHours) : "0h"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Tarifa Promedio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {monthlyData ? formatCurrency(monthlyData.averageHourlyRate) : "$0.00"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Por hora
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Barras */}
      <Card>
        <CardHeader>
          <CardTitle>Horas Trabajadas por Día (Semana Actual)</CardTitle>
        </CardHeader>
        <CardContent>
          {weeklyData && weeklyData.dailyStats.length > 0 ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData.dailyStats} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    className="text-xs"
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    className="text-xs"
                    label={{ value: "Horas", angle: -90, position: "insideLeft" }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="rounded-lg border bg-background p-3 shadow-sm">
                            <div className="grid grid-cols-1 gap-2">
                              <div className="flex flex-col">
                                <span className="text-sm font-medium">{data.day}</span>
                                <span className="text-sm text-muted-foreground">
                                  Horas: {data.hours.toFixed(2)}h
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  Ganancia: {formatCurrency(data.earnings)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    dataKey="hours"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No hay datos para mostrar esta semana.
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Insight */}
      {aiInsight && (
        <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium mb-1">Insight de Productividad</p>
                <p className="text-sm text-muted-foreground">{aiInsight}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
