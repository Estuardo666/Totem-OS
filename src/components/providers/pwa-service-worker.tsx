"use client";

import { useEffect } from "react";

export function PwaServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", {
          scope: "/",
        })
        .catch((error) => console.error("SW registration failed", error));
    }
  }, []);

  return null;
}
