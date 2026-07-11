"use client";

import dynamic from "next/dynamic";
import { CardSkeleton } from "@/components/ui/skeletons-composite";

type Props = Parameters<(typeof import("./tiktok-panel"))["TikTokPanel"]>[0];

// Recharts is deferred until component mounts — only loaded on client
const TikTokPanel = dynamic(
  () => import("./tiktok-panel").then((m) => ({ default: m.TikTokPanel })),
  { ssr: false, loading: () => <CardSkeleton /> }
);

export function TikTokPanelClient(props: Props) {
  return <TikTokPanel {...props} />;
}
