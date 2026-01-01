"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface MetricsChartProps {
  data: Array<{
    date: string;
    impressions: number;
  }>;
}

/**
 * Componente que muestra un gráfico de línea con la evolución de impresiones
 */
export function MetricsChart({ data }: MetricsChartProps) {
  // Formatear datos para el gráfico
  const chartData = data.map((item) => ({
    date: format(new Date(item.date), "dd MMM", { locale: es }),
    fullDate: item.date,
    impressions: item.impressions,
  }));

  // Formatear tooltip
  const formatTooltip = (value: number | string) => {
    return new Intl.NumberFormat("es-ES").format(Number(value));
  };

  if (chartData.length === 0) {
    return (
      <Card className="border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Evolución de Impresiones</CardTitle>
          <CardDescription className="text-xs">
            No hay datos disponibles para mostrar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
            Sincroniza las métricas para ver los datos
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Evolución de Impresiones</CardTitle>
        <CardDescription className="text-xs">
          Últimos {data.length} días disponibles
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              className="text-xs"
              tick={{ fill: "hsl(var(--muted-foreground))" }}
            />
            <YAxis
              className="text-xs"
              tick={{ fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={formatTooltip}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
              }}
              formatter={(value: number) => formatTooltip(value)}
              labelFormatter={(label) => {
                const item = chartData.find((d) => d.date === label);
                return item
                  ? format(new Date(item.fullDate), "dd MMMM yyyy", { locale: es })
                  : label;
              }}
            />
            <Line
              type="monotone"
              dataKey="impressions"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ fill: "hsl(var(--primary))", r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

