"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

interface ExpensesBarChartProps {
  data: Array<{
    clientName: string;
    amount: number;
  }>;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function ExpensesBarChart({ data }: ExpensesBarChartProps) {
  const chartData = data.map((item) => ({
    cliente: item.clientName,
    gasto: item.amount,
  }));

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No hay datos para mostrar
      </div>
    );
  }

  const chartConfig: ChartConfig = {
    gasto: {
      label: "Gastos",
      color: "hsl(var(--chart-1))",
    },
  };

  return (
    <ChartContainer config={chartConfig} className="h-[300px]">
      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="cliente"
          angle={-45}
          textAnchor="end"
          height={100}
          tick={{ fontSize: 12 }}
        />
        <YAxis tickFormatter={formatCurrency} />
        <ChartTooltip
          content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />}
        />
        <Bar dataKey="gasto" fill="var(--color-gasto)" name="Gastos" />
      </BarChart>
    </ChartContainer>
  );
}

