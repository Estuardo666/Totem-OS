"use client";

import dynamic from "next/dynamic";
import { CardSkeleton } from "@/components/ui/skeletons-composite";

type Props = Parameters<(typeof import("./weekly-effort-chart"))["WeeklyEffortChart"]>[0];

// Recharts is deferred until component mounts — only loaded on client
const WeeklyEffortChart = dynamic(
  () => import("./weekly-effort-chart").then((m) => ({ default: m.WeeklyEffortChart })),
  { ssr: false, loading: () => <CardSkeleton /> }
);

export function WeeklyEffortChartClient(props: Props) {
  return <WeeklyEffortChart {...props} />;
}
