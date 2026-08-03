"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

export function HomeMotion({ children }: { children: ReactNode }) {
  const [replayKey, setReplayKey] = useState(0);

  useEffect(() => {
    const replay = () => setReplayKey((key) => key + 1);
    window.addEventListener("totem:dashboard-refresh", replay);
    return () => window.removeEventListener("totem:dashboard-refresh", replay);
  }, []);

  return <div key={replayKey} className="contents">{children}</div>;
}
