"use client";

import dynamic from "next/dynamic";
import { CardSkeleton } from "@/components/ui/skeletons-composite";

type Props = Parameters<(typeof import("./revenue-roi-panel"))["RevenueROIPanel"]>[0];

// Recharts is deferred until component mounts — only loaded on client
const RevenueROIPanel = dynamic(
  () => import("./revenue-roi-panel").then((m) => ({ default: m.RevenueROIPanel })),
  { ssr: false, loading: () => <CardSkeleton /> }
);

export function RevenueROIPanelClient(props: Props) {
  return <RevenueROIPanel {...props} />;
}
