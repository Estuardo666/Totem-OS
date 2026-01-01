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
import { Facebook, Instagram } from "lucide-react";

interface TaskWithMetrics {
  id: string;
  title: string;
  publishedAt: Date | null;
  metrics: {
    metaReach: number;
    metaLikes: number;
    metaComments: number;
    metaShares: number;
    metaSaves: number;
    metaViews: number;
    erMeta: number;
  } | null;
}

interface MetaPanelProps {
  tasks: TaskWithMetrics[];
}

export function MetaPanel({ tasks }: MetaPanelProps) {
  // Filtrar solo tareas con métricas Meta
  const tasksWithMetaMetrics = tasks
    .filter((task) => task.metrics && (task.metrics.metaReach > 0 || task.metrics.metaViews > 0))
    .slice(0, 10);

  if (tasksWithMetaMetrics.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Instagram className="h-5 w-5 text-pink-600" />
              <Facebook className="h-5 w-5 text-blue-600" />
            </div>
            Panel Meta (IG/FB)
          </CardTitle>
          <CardDescription>
            Métricas de alcance e interacciones en Meta
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No hay métricas de Meta disponibles
          </p>
        </CardContent>
      </Card>
    );
  }

  // Preparar datos para el gráfico: Alcance vs Interacciones
  const chartData = tasksWithMetaMetrics.map((task) => ({
    name: task.title.length > 20 ? `${task.title.substring(0, 20)}...` : task.title,
    fullName: task.title,
    reach: task.metrics?.metaReach || 0,
    interactions: (task.metrics?.metaLikes || 0) + (task.metrics?.metaComments || 0) + (task.metrics?.metaShares || 0) + (task.metrics?.metaSaves || 0),
  }));

  // Calcular totales
  const totalReach = tasksWithMetaMetrics.reduce(
    (sum, task) => sum + (task.metrics?.metaReach || 0),
    0
  );
  const totalInteractions = tasksWithMetaMetrics.reduce(
    (sum, task) =>
      sum +
      (task.metrics?.metaLikes || 0) +
      (task.metrics?.metaComments || 0) +
      (task.metrics?.metaShares || 0) +
      (task.metrics?.metaSaves || 0),
    0
  );
  const averageER = tasksWithMetaMetrics.reduce(
    (sum, task) => sum + (task.metrics?.erMeta || 0),
    0
  ) / tasksWithMetaMetrics.length;

  return (
    <Card className="border-l-4 border-l-blue-600">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Instagram className="h-5 w-5 text-pink-600" />
            <Facebook className="h-5 w-5 text-blue-600" />
          </div>
          Panel Meta (IG/FB)
        </CardTitle>
        <CardDescription>
          Análisis de alcance e interacciones en Instagram y Facebook
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Resumen de métricas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Alcance Total</p>
            <p className="text-2xl font-bold text-blue-600">
              {totalReach.toLocaleString()}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Interacciones Totales</p>
            <p className="text-2xl font-bold text-pink-600">
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

        {/* Gráfico de barras: Alcance vs Interacciones */}
        <div>
          <h4 className="text-sm font-semibold mb-4">Alcance vs Interacciones</h4>
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
                formatter={(value: number) => value.toLocaleString()}
                labelFormatter={(label, payload) => {
                  if (payload && payload[0]) {
                    return payload[0].payload.fullName;
                  }
                  return label;
                }}
              />
              <Legend />
              <Bar dataKey="reach" fill="#3b82f6" name="Alcance" />
              <Bar dataKey="interactions" fill="#ec4899" name="Interacciones" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

