"use client";

import { useState, useEffect } from "react";

interface PwaStatus {
  isPwa: boolean;
  platform: "ios" | "android" | "windows" | "macos" | "unknown";
  isStandalone: boolean;
}

/**
 * Detects if the app is running as an installed PWA
 * and identifies the platform
 */
export function usePwaDetect(): PwaStatus {
  const [status, setStatus] = useState<PwaStatus>({
    isPwa: false,
    platform: "unknown",
    isStandalone: false,
  });

  useEffect(() => {
    const detectPwa = () => {
      // Check if running in standalone mode (installed PWA)
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        window.matchMedia("(display-mode: fullscreen)").matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
        document.referrer.includes("android-app://");

      // Detect platform
      const userAgent = navigator.userAgent.toLowerCase();
      let platform: PwaStatus["platform"] = "unknown";

      if (/iphone|ipad|ipod/.test(userAgent)) {
        platform = "ios";
      } else if (/android/.test(userAgent)) {
        platform = "android";
      } else if (/win/.test(userAgent)) {
        platform = "windows";
      } else if (/mac/.test(userAgent)) {
        platform = "macos";
      }

      setStatus({
        isPwa: isStandalone,
        platform,
        isStandalone,
      });
    };

    detectPwa();

    // Listen for display mode changes
    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const handler = () => detectPwa();
    mediaQuery.addEventListener("change", handler);

    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  return status;
}
