"use client";

import { PieChart, Pie, Cell } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

interface ExpensesPieChartProps {
  data: Array<{
    category: string;
    amount: number;
  }>;
}

function getCategoryLabel(category: string): string {
  switch (category) {
    case "COMIDA":
      return "Comida";
    case "TRANSPORTE":
      return "Transporte";
    case "INVITACIONES":
      return "Invitaciones";
    case "SOFTWARE":
      return "Software";
    case "OFICINA":
      return "Oficina";
    case "EQUIPOS":
      return "Equipos";
    case "OTROS":
      return "Otros";
    default:
      return category;
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function ExpensesPieChart({ data }: ExpensesPieChartProps) {
  const chartData = data.map((item, index) => ({
    name: getCategoryLabel(item.category),
    value: item.amount,
    fill: `hsl(var(--chart-${(index % 5) + 1}))`,
  }));

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No hay datos para mostrar
      </div>
    );
  }

  const chartConfig: ChartConfig = chartData.reduce((acc, item, index) => {
    const key = item.name.toLowerCase().replace(/\s+/g, "");
    acc[key] = {
      label: item.name,
      color: `hsl(var(--chart-${(index % 5) + 1}))`,
    };
    return acc;
  }, {} as ChartConfig);

  return (
    <ChartContainer config={chartConfig} className="h-[300px]">
      <PieChart>
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent hideLabel formatter={(value) => formatCurrency(Number(value))} />}
        />
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={80}
          label={({ name, percent }) =>
            `${name} ${(percent * 100).toFixed(0)}%`
          }
        >
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.fill}
            />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  );
}

