"use client";

import dynamic from "next/dynamic";
import { CardSkeleton } from "@/components/ui/skeletons-composite";

type Props = Parameters<(typeof import("./deliverables-progress-chart"))["DeliverablesProgressChart"]>[0];

// Recharts is deferred until component mounts — only loaded on client
const DeliverablesProgressChart = dynamic(
  () => import("./deliverables-progress-chart").then((m) => ({ default: m.DeliverablesProgressChart })),
  { ssr: false, loading: () => <CardSkeleton /> }
);

export function DeliverablesProgressChartClient(props: Props) {
  return <DeliverablesProgressChart {...props} />;
}
