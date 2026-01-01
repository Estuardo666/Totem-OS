"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

interface DeliverablesProgressChartProps {
  deliverables: {
    reelsCompleted: number;
    flyersCompleted: number;
    reelsContracted: number;
    flyersContracted: number;
    completedTasks: Array<{
      id: string;
      title: string;
      type: string;
      publishedAt: Date | null;
    }>;
  };
  month: string;
  year: number;
}

const chartConfig = {
  completados: {
    label: "Completados",
    color: "hsl(142, 76%, 36%)", // Verde
  },
  contratados: {
    label: "Contratados",
    color: "hsl(217, 91%, 60%)", // Azul
  },
};

export function DeliverablesProgressChart({
  deliverables,
  month,
  year,
}: DeliverablesProgressChartProps) {
  const chartData = [
    {
      tipo: "Reels",
      completados: deliverables.reelsCompleted,
      contratados: deliverables.reelsContracted,
    },
    {
      tipo: "Flyers",
      completados: deliverables.flyersCompleted,
      contratados: deliverables.flyersContracted,
    },
  ];

  return (
    <Card className="bg-white shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-600" />
          Progreso de Entregables - {month} {year}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="tipo"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                className="text-sm"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                className="text-sm"
                allowDecimals={false}
              />
              <ChartTooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-sm">
                      <div className="grid gap-2">
                        {payload.map((item, index) => (
                          <div key={index} className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                              <div
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: item.color }}
                              />
                              <span className="text-xs text-muted-foreground">
                                {item.name === "completados" && "Completados"}
                                {item.name === "contratados" && "Contratados"}
                              </span>
                            </div>
                            <span className="font-medium tabular-nums">
                              {item.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="completados"
                fill="hsl(142, 76%, 36%)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="contratados"
                fill="hsl(217, 91%, 60%)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
        <p className="text-xs text-muted-foreground mt-4 text-center">
          Comparativa entre entregables completados y contratados
        </p>
      </CardContent>
    </Card>
  );
}

