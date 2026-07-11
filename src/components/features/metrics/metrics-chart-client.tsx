"use client";

import dynamic from "next/dynamic";
import { CardSkeleton } from "@/components/ui/skeletons-composite";

type Props = Parameters<(typeof import("./metrics-chart"))["MetricsChart"]>[0];

// Recharts is deferred until component mounts — only loaded on client
const MetricsChart = dynamic(
  () => import("./metrics-chart").then((m) => ({ default: m.MetricsChart })),
  { ssr: false, loading: () => <CardSkeleton /> }
);

export function MetricsChartClient(props: Props) {
  return <MetricsChart {...props} />;
}
