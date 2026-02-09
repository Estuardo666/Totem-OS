"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { getPendingTasksCount } from "@/actions/content-actions";
import { getUnreadCount } from "@/actions/notification-actions";
import { usePwaDetect } from "@/hooks/use-pwa-detect";

const BADGE_REFRESH_INTERVAL = 60000;

type AppBadgeNavigator = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

export function AppBadgeProvider() {
  const { data: session } = useSession();
  const { isPwa } = usePwaDetect();
  const lastCountRef = useRef<number | null>(null);

  useEffect(() => {
    const navigatorWithBadge = navigator as AppBadgeNavigator;

    if (!session?.user?.id) {
      return;
    }

    if (!isPwa || !navigatorWithBadge.setAppBadge) {
      return;
    }

    let isActive = true;

    const updateBadge = async () => {
      try {
        const [pendingTasksResult, unreadResult] = await Promise.all([
          getPendingTasksCount(),
          getUnreadCount(),
        ]);

        const pendingTasks = pendingTasksResult.success
          ? pendingTasksResult.data ?? 0
          : 0;
        const unreadNotifications = unreadResult.success
          ? unreadResult.data ?? 0
          : 0;

        const totalCount = pendingTasks + unreadNotifications;

        if (!isActive || lastCountRef.current === totalCount) {
          return;
        }

        lastCountRef.current = totalCount;

        if (totalCount > 0) {
          await navigatorWithBadge.setAppBadge(totalCount);
        } else if (navigatorWithBadge.clearAppBadge) {
          await navigatorWithBadge.clearAppBadge();
        } else {
          await navigatorWithBadge.setAppBadge(0);
        }
      } catch (error) {
        console.error("Error updating app badge:", error);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        updateBadge();
      }
    };

    updateBadge();
    const intervalId = window.setInterval(updateBadge, BADGE_REFRESH_INTERVAL);
    window.addEventListener("focus", updateBadge);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", updateBadge);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [session?.user?.id, isPwa]);

  return null;
}
