"use client";

import dynamic from "next/dynamic";

/**
 * Carga diferida del gráfico: Recharts no renderiza en el servidor.
 */
export const ReachTrendChartClient = dynamic(
  () => import("./reach-trend-chart").then((m) => ({ default: m.ReachTrendChart })),
  {
    ssr: false,
    loading: () => (
      <div className="h-[280px] w-full animate-pulse rounded-lg bg-muted/40" />
    ),
  }
);
