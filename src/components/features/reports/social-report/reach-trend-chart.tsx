"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { REPORT_SERIES, formatNumber } from "./report-tokens";

interface TrendPoint {
  date: string;
  facebook: number;
  instagram: number;
  tiktok: number;
}

interface ReachTrendChartProps {
  data: TrendPoint[];
  /** Solo se dibujan las plataformas realmente conectadas. */
  activePlatforms: Array<"facebook" | "instagram" | "tiktok">;
}

/**
 * Un solo gráfico de tendencia, no una grilla de seis.
 *
 * Los ejes y la grilla son recesivos: la línea es el dato, todo lo demás es
 * andamiaje. No hay etiqueta de valor en cada punto — el tooltip y el eje
 * cubren la lectura precisa.
 */
export function ReachTrendChart({ data, activePlatforms }: ReachTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">
          Sin datos de visualizaciones para este período.
        </p>
      </div>
    );
  }

  return (
    // Ancho fijo al imprimir: un ResponsiveContainer puede colapsar a 0 en el
    // contexto de impresión y el gráfico saldría vacío en el PDF.
    <div className="h-[280px] w-full print:h-[240px] print:w-[680px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="hsl(var(--border))"
          />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickFormatter={(value: string) => format(parseISO(value), "d MMM", { locale: es })}
            minTickGap={24}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={48}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickFormatter={(value: number) =>
              value >= 1000 ? `${Math.round(value / 1000)}k` : String(value)
            }
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "0.5rem",
              fontSize: "0.8125rem",
            }}
            labelFormatter={(value: string) =>
              format(parseISO(value), "d 'de' MMMM", { locale: es })
            }
            formatter={(value: number, name: string) => [formatNumber(value), name]}
          />
          {activePlatforms.length > 1 && (
            <Legend
              verticalAlign="top"
              align="right"
              height={28}
              iconType="plainline"
              wrapperStyle={{ fontSize: "0.75rem" }}
            />
          )}
          {activePlatforms.map((key) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              name={REPORT_SERIES[key].label}
              stroke={REPORT_SERIES[key].light}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
