"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { DollarSign, TrendingUp, Target, Award } from "lucide-react";
import { formatCurrency } from "@/lib/metrics-calculations";

interface TaskWithMetrics {
  id: string;
  title: string;
  publishedAt: Date | null;
  metrics: {
    revenue: number;
    conversions: number;
    salesCount: number;
    conversionRate: number;
    cpa: number;
    roas: number;
    metaReach: number;
    ttViews: number;
  } | null;
}

interface RevenueROIPanelProps {
  tasks: TaskWithMetrics[];
  totalRevenue: number;
  totalConversions: number;
  totalSales: number;
  averageConversionRate: number;
  averageCPA: number;
  averageROAS: number;
}

export function RevenueROIPanel({
  tasks,
  totalRevenue,
  totalConversions,
  totalSales,
  averageConversionRate,
  averageCPA,
  averageROAS,
}: RevenueROIPanelProps) {
  // Calcular alcance total para el embudo
  const totalReach = tasks.reduce((sum, task) => {
    if (!task.metrics) return sum;
    return sum + (task.metrics.metaReach || 0) + (task.metrics.ttViews || 0);
  }, 0);

  // Preparar datos para el gráfico de embudo
  const funnelData = [
    {
      name: "Alcance Total",
      value: totalReach,
      fill: "#3b82f6",
    },
    {
      name: "Conversiones",
      value: totalConversions,
      fill: "#10b981",
    },
    {
      name: "Ventas",
      value: totalSales,
      fill: "#f59e0b",
    },
  ];

  // Top 3 contenidos por revenue
  const topSellingContent = tasks
    .filter((task) => task.metrics && task.metrics.revenue > 0)
    .sort((a, b) => (b.metrics?.revenue || 0) - (a.metrics?.revenue || 0))
    .slice(0, 3);

  return (
    <Card className="border-l-4 border-l-green-600">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-green-600" />
          Revenue & ROI Dashboard
        </CardTitle>
        <CardDescription>
          Análisis de conversión y retorno de inversión
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Total Revenue - Número más grande */}
        <div className="text-center py-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-lg border border-green-200 dark:border-green-800">
          <p className="text-sm text-muted-foreground mb-2">Total Revenue Generado</p>
          <p className="text-5xl font-bold text-green-600 dark:text-green-400">
            {formatCurrency(totalRevenue)}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Ingresos totales generados por el contenido
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                Conversion Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{averageConversionRate.toFixed(2)}%</p>
              <p className="text-xs text-muted-foreground mt-1">
                Tasa promedio de conversión
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                CPA Promedio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {averageCPA > 0 ? formatCurrency(averageCPA) : "N/A"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Costo por adquisición
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Award className="h-4 w-4 text-muted-foreground" />
                ROAS Promedio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {averageROAS > 0 ? `${averageROAS.toFixed(2)}x` : "N/A"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Retorno sobre inversión
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Conversion Funnel */}
        <div>
          <h4 className="text-sm font-semibold mb-4">Embudo de Conversión</h4>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart
              data={funnelData}
              layout="vertical"
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={100} />
              <Tooltip
                formatter={(value: number) => value.toLocaleString()}
              />
              <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                {funnelData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Selling Content */}
        {topSellingContent.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-4">Top 3 Contenidos por Revenue</h4>
            <div className="space-y-3">
              {topSellingContent.map((task, index) => (
                <Card key={task.id} className="border-l-4 border-l-green-600">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {task.title.length > 40
                              ? `${task.title.substring(0, 40)}...`
                              : task.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {task.metrics?.salesCount || 0} ventas
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-green-600">
                          {formatCurrency(task.metrics?.revenue || 0)}
                        </p>
                        {task.metrics?.roas && task.metrics.roas > 0 && (
                          <p className="text-xs text-muted-foreground">
                            ROAS: {task.metrics.roas.toFixed(2)}x
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {topSellingContent.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">
              No hay contenido con revenue registrado aún
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

