"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { GlobalProfitabilityStats } from "@/actions/finance-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ProfitabilityAreaChartProps {
  stats: GlobalProfitabilityStats;
}

// Función para formatear dinero
function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

const chartConfig = {
  ingresos: {
    label: "Ingresos",
    color: "hsl(142, 76%, 36%)", // Verde
  },
  gastos: {
    label: "Gastos",
    color: "hsl(0, 84%, 60%)", // Rojo
  },
  utilidad: {
    label: "Utilidad",
    color: "hsl(217, 91%, 60%)", // Azul
  },
};

export function ProfitabilityAreaChart({ stats }: ProfitabilityAreaChartProps) {
  const chartData = stats.monthlyData.map((month) => ({
    mes: month.month.split(" ")[0], // Solo el nombre del mes
    ingresos: month.income,
    gastos: month.expenses,
    utilidad: month.profit,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tendencia de Rentabilidad (Últimos 6 Meses)</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <ResponsiveContainer width="100%" height={175}>
            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="colorGastos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="colorUtilidad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="mes"
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
                tickFormatter={(value) => `$${value / 1000}k`}
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
                                {item.name === "ingresos" && "Ingresos"}
                                {item.name === "gastos" && "Gastos"}
                                {item.name === "utilidad" && "Utilidad"}
                              </span>
                            </div>
                            <span className="font-medium tabular-nums">
                              {formatCurrency(Number(item.value))}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="ingresos"
                stroke="hsl(142, 76%, 36%)"
                fill="url(#colorIngresos)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="gastos"
                stroke="hsl(0, 84%, 60%)"
                fill="url(#colorGastos)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="utilidad"
                stroke="hsl(217, 91%, 60%)"
                fill="url(#colorUtilidad)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

