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
} from "recharts";
import { TrendingUp } from "lucide-react";

interface TaskWithMetrics {
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
    efficiencyScore: number;
  } | null;
}

interface PerformanceChartProps {
  tasks: TaskWithMetrics[];
  metricType?: "views" | "engagement";
}

export function PerformanceChart({ tasks, metricType = "views" }: PerformanceChartProps) {
  // Filtrar solo tareas con métricas y limitar a las últimas 10
  const tasksWithMetrics = tasks
    .filter((task) => task.metrics !== null)
    .slice(0, 10);

  if (tasksWithMetrics.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Rendimiento de Contenidos
          </CardTitle>
          <CardDescription>
            Comparación de métricas de los últimos contenidos publicados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No hay métricas disponibles para mostrar
          </p>
        </CardContent>
      </Card>
    );
  }

  // Preparar datos para el gráfico (combinar métricas de ambas plataformas)
  const chartData = tasksWithMetrics.map((task) => {
    const totalViews = (task.metrics?.metaViews || 0) + (task.metrics?.ttViews || 0);
    const totalReach = (task.metrics?.metaReach || 0) + (task.metrics?.ttViews || 0);
    const avgER = task.metrics?.efficiencyScore || 0;
    
    return {
      name: task.title.length > 20 ? `${task.title.substring(0, 20)}...` : task.title,
      fullName: task.title,
      views: totalViews,
      engagement: avgER,
      totalReach,
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Rendimiento de Contenidos
        </CardTitle>
        <CardDescription>
          Comparación de {metricType === "views" ? "vistas" : "engagement"} de los últimos {tasksWithMetrics.length} contenidos publicados
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              angle={-45}
              textAnchor="end"
              height={100}
              interval={0}
            />
            <YAxis />
            <Tooltip
              formatter={(value: number) => {
                if (metricType === "engagement") {
                  return `${value.toFixed(2)}%`;
                }
                return value.toLocaleString();
              }}
              labelFormatter={(label, payload) => {
                if (payload && payload[0]) {
                  return payload[0].payload.fullName;
                }
                return label;
              }}
            />
            <Legend />
            {metricType === "views" ? (
              <Bar dataKey="views" fill="#3b82f6" name="Vistas" />
            ) : (
              <Bar dataKey="engagement" fill="#10b981" name="Engagement Rate (%)" />
            )}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

