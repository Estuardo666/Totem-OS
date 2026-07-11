"use client";

import dynamic from "next/dynamic";
import { CardSkeleton } from "@/components/ui/skeletons-composite";

// Recharts is deferred until component mounts — only loaded on client
const TimeStats = dynamic(
  () => import("./time-stats").then((m) => ({ default: m.TimeStats })),
  { ssr: false, loading: () => <CardSkeleton /> }
);

export function TimeStatsClient(props: { userId: string }) {
  return <TimeStats {...props} />;
}
