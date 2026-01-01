"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Music } from "lucide-react";

interface TaskWithMetrics {
  id: string;
  title: string;
  publishedAt: Date | null;
  metrics: {
    ttViews: number;
    ttLikes: number;
    ttComments: number;
    ttShares: number;
    ttSaves: number;
    erTikTok: number;
  } | null;
}

interface TikTokPanelProps {
  tasks: TaskWithMetrics[];
}

export function TikTokPanel({ tasks }: TikTokPanelProps) {
  // Filtrar solo tareas con métricas TikTok
  const tasksWithTikTokMetrics = tasks
    .filter((task) => task.metrics && task.metrics.ttViews > 0)
    .slice(0, 10)
    .sort((a, b) => {
      // Ordenar por fecha de publicación (más reciente primero)
      if (!a.publishedAt || !b.publishedAt) return 0;
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });

  if (tasksWithTikTokMetrics.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="h-5 w-5" />
            Panel TikTok
          </CardTitle>
          <CardDescription>
            Tendencias de reproducciones en TikTok
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No hay métricas de TikTok disponibles
          </p>
        </CardContent>
      </Card>
    );
  }

  // Preparar datos para el gráfico: Tendencias de Views
  const chartData = tasksWithTikTokMetrics.map((task) => ({
    name: task.title.length > 20 ? `${task.title.substring(0, 20)}...` : task.title,
    fullName: task.title,
    views: task.metrics?.ttViews || 0,
    likes: task.metrics?.ttLikes || 0,
    comments: task.metrics?.ttComments || 0,
    shares: task.metrics?.ttShares || 0,
  }));

  // Calcular totales
  const totalViews = tasksWithTikTokMetrics.reduce(
    (sum, task) => sum + (task.metrics?.ttViews || 0),
    0
  );
  const totalInteractions = tasksWithTikTokMetrics.reduce(
    (sum, task) =>
      sum +
      (task.metrics?.ttLikes || 0) +
      (task.metrics?.ttComments || 0) +
      (task.metrics?.ttShares || 0) +
      (task.metrics?.ttSaves || 0),
    0
  );
  const averageER = tasksWithTikTokMetrics.reduce(
    (sum, task) => sum + (task.metrics?.erTikTok || 0),
    0
  ) / tasksWithTikTokMetrics.length;

  return (
    <Card className="border-l-4 border-l-black dark:border-l-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Music className="h-5 w-5" />
          Panel TikTok
        </CardTitle>
        <CardDescription>
          Análisis de tendencias de reproducciones e interacciones
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Resumen de métricas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Vistas Totales</p>
            <p className="text-2xl font-bold">
              {totalViews.toLocaleString()}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Interacciones Totales</p>
            <p className="text-2xl font-bold text-cyan-600">
              {totalInteractions.toLocaleString()}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">ER Promedio</p>
            <p className="text-2xl font-bold">
              {averageER.toFixed(2)}%
            </p>
          </div>
        </div>

        {/* Gráfico de líneas: Tendencias de Views */}
        <div>
          <h4 className="text-sm font-semibold mb-4">Tendencia de Reproducciones</h4>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
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
                formatter={(value: number) => value.toLocaleString()}
                labelFormatter={(label, payload) => {
                  if (payload && payload[0]) {
                    return payload[0].payload.fullName;
                  }
                  return label;
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="views"
                stroke="#000000"
                strokeWidth={2}
                name="Vistas"
                dot={{ fill: "#000000", r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="likes"
                stroke="#06b6d4"
                strokeWidth={2}
                name="Likes"
                dot={{ fill: "#06b6d4", r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

