"use client";

import dynamic from "next/dynamic";
import { CardSkeleton } from "@/components/ui/skeletons-composite";

type Props = Parameters<(typeof import("./meta-panel"))["MetaPanel"]>[0];

// Recharts is deferred until component mounts — only loaded on client
const MetaPanel = dynamic(
  () => import("./meta-panel").then((m) => ({ default: m.MetaPanel })),
  { ssr: false, loading: () => <CardSkeleton /> }
);

export function MetaPanelClient(props: Props) {
  return <MetaPanel {...props} />;
}
