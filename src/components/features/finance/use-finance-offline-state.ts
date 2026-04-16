"use client";

import { useEffect, useState } from "react";
import {
  readFinanceQueue,
  subscribeFinanceOffline,
} from "@/lib/finance-offline-store";

export function useFinanceOfflineState() {
  const [queue, setQueue] = useState(() => readFinanceQueue());
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof navigator === "undefined") return true;
    return navigator.onLine;
  });

  useEffect(() => {
    const updateQueue = () => setQueue(readFinanceQueue());
    const updateConnectivity = () => {
      if (typeof navigator === "undefined") return;
      setIsOnline(navigator.onLine);
    };

    const unsubscribe = subscribeFinanceOffline(updateQueue);
    window.addEventListener("online", updateConnectivity);
    window.addEventListener("offline", updateConnectivity);

    return () => {
      unsubscribe();
      window.removeEventListener("online", updateConnectivity);
      window.removeEventListener("offline", updateConnectivity);
    };
  }, []);

  return {
    queue,
    isOnline,
    pendingCount: queue.length,
  };
}