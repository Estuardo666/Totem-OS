"use client";

import { useEffect, useState, useCallback } from "react";
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

  const generateInsight = useCallback((weekly: typeof weeklyData, monthly: typeof monthlyData) => {
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
      setAiInsight("Has mantenido un ritmo de trabajo estable y dentro de lo esperado.");
    }
  }, []);

  const loadStats = useCallback(async () => {
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
        if (weeklyResult.success && weeklyResult.data) {
          generateInsight(weeklyResult.data, monthlyResult.data);
        }
      }
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, generateInsight]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="col-span-1 md:col-span-2">
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Estadísticas Semanales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="col-span-1 md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Horas Semanales
            </CardTitle>
          </CardHeader>
          <CardContent>
            {weeklyData ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyData.dailyStats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="hours" fill="#8884d8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No hay datos disponibles</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Resumen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Horas Totales</p>
              <p className="text-2xl font-bold">{weeklyData?.totalHours.toFixed(1) || 0}h</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ganancias Semanales</p>
              <p className="text-2xl font-bold text-green-600">${weeklyData?.totalEarnings.toFixed(2) || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Promedio Diario</p>
              <p className="text-xl font-semibold">
                {weeklyData ? (weeklyData.totalHours / 7).toFixed(1) : 0}h/día
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Estadísticas Mensuales e Insight */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Rendimiento Mensual
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {monthlyData ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Horas</p>
                  <p className="text-xl font-bold">{monthlyData.monthlyHours.toFixed(1)}</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Ganancias</p>
                  <p className="text-xl font-bold text-green-600">${monthlyData.monthlyEarnings.toFixed(2)}</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Tarifa Hora</p>
                  <p className="text-xl font-bold">${monthlyData.averageHourlyRate.toFixed(2)}</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Registros</p>
                  <p className="text-xl font-bold">{monthlyData.entryCount}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No hay datos mensuales</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-yellow-500" />
              Insight IA
            </CardTitle>
          </CardHeader>
          <CardContent>
            {aiInsight ? (
              <p className="text-sm leading-relaxed">{aiInsight}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Los insights aparecerán aquí después de cargar tus estadísticas.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}