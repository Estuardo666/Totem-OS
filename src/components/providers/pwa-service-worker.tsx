"use client";

import { useEffect } from "react";
import { FINANCE_OFFLINE_ROUTES } from "@/lib/finance-offline-types";

export function PwaServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let disposed = false;

    const warmFinanceRoutes = async () => {
      if (disposed || !navigator.onLine) return;

      try {
        const registration = await navigator.serviceWorker.ready;
        registration.active?.postMessage({
          type: "CACHE_URLS",
          urls: FINANCE_OFFLINE_ROUTES,
        });
      } catch (error) {
        console.error("Finance route warmup failed", error);
      }
    };

    navigator.serviceWorker
      .register("/sw.js", {
        scope: "/",
      })
      .then(() => warmFinanceRoutes())
      .catch((error) => console.error("SW registration failed", error));

    window.addEventListener("online", warmFinanceRoutes);

    return () => {
      disposed = true;
      window.removeEventListener("online", warmFinanceRoutes);
    };
  }, []);

  return null;
}
