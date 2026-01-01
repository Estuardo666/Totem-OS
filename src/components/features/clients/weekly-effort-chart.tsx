"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

interface WeeklyEffortChartProps {
  weeklyEffort: Array<{
    week: string;
    weekNumber: number;
    tasksCount: number;
  }>;
  month: string;
  year: number;
}

const chartConfig = {
  tareas: {
    label: "Tareas Publicadas",
    color: "hsl(217, 91%, 60%)", // Azul
  },
};

export function WeeklyEffortChart({
  weeklyEffort,
  month,
  year,
}: WeeklyEffortChartProps) {
  const chartData = weeklyEffort.map((week) => ({
    semana: week.week,
    tareas: week.tasksCount,
  }));

  return (
    <Card className="print:border-gray-300 print:shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-600" />
          Volumen de Contenido Generado - {month} {year}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="semana"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                className="text-xs"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                className="text-xs"
                allowDecimals={false}
              />
              <ChartTooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-sm">
                      <div className="grid gap-2">
                        {payload.map((item, index) => (
                          <div key={index} className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                              <div
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: item.color }}
                              />
                              <span className="text-xs text-muted-foreground">
                                Tareas Publicadas
                              </span>
                            </div>
                            <span className="font-medium tabular-nums">
                              {item.value} {Number(item.value) === 1 ? "tarea" : "tareas"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="tareas"
                fill="hsl(217, 91%, 60%)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
        <p className="text-xs text-muted-foreground mt-4 text-center">
          Distribución semanal del contenido publicado durante el mes
        </p>
      </CardContent>
    </Card>
  );
}

