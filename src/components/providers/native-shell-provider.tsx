"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { TransactionDialog } from "@/components/features/finance/transaction-dialog";
import { getPublicBrandSettings } from "@/actions/admin-actions";
import { getPendingTasksCount } from "@/actions/content-actions";
import {
  getUnreadCount,
  getUnreadNotifications,
  markAsRead,
} from "@/actions/notification-actions";
import { updateUserSettings } from "@/actions/user.actions";
import { useNativeShell } from "@/hooks/use-native-shell";
import {
  DEFAULT_PRIMARY_COLOR,
  sanitizeHexColor,
  toggleThemeVariantClient,
} from "@/lib/theme";
import type { ThemeVariant } from "@/lib/theme";
import { signOutWithTotemIOSCleanup } from "@/lib/totem-ios-client";
import {
  buildShellSnapshot,
  parseShellCommand,
  SHELL_INTEGRATIONS_ROUTE,
  SHELL_NOTIFICATIONS_ROUTE,
  SHELL_SETTINGS_ROUTE,
  TOTEM_SHELL_BRIDGE_NAME,
  type ShellSnapshot,
  type ShellTransactionTab,
} from "@/lib/totem-shell-contract";

const SHELL_DISPATCH_FUNCTION = "__totemShellDispatch";
const REFRESH_INTERVAL_MS = 60_000;

type WebKitBridge = {
  webkit?: {
    messageHandlers?: Record<string, { postMessage: (value: unknown) => void }>;
  };
};

type ShellNotificationSource = {
  id: string;
  message: string;
  createdAt: Date | string;
  read?: boolean;
  clientName?: string | null;
  clientLogo?: string | null;
  createdByUser?: { name: string; image: string | null } | null;
};

/**
 * Publica el snapshot del shell hacia la app nativa y ejecuta los comandos
 * tipados que envía Swift. Fuera de `TotemOS-iOS` no se monta nada.
 */
export function NativeShellProvider() {
  const isNativeShell = useNativeShell();

  if (!isNativeShell) {
    return null;
  }

  return <NativeShellBridge />;
}

function NativeShellBridge() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const [theme, setTheme] = useState<ThemeVariant>("light");
  const [accentColor, setAccentColor] = useState(DEFAULT_PRIMARY_COLOR);
  const [brand, setBrand] = useState<{ logoLight: string | null; logoDark: string | null } | null>(null);
  const [taskCount, setTaskCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<ShellNotificationSource[]>([]);
  const [isTransactionOpen, setIsTransactionOpen] = useState(false);
  const [transactionTab, setTransactionTab] = useState<ShellTransactionTab>("expense");

  // El tema vive en el DOM: se observa igual que en navbar y sidebar web.
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => {
      setTheme(root.classList.contains("dark") ? "dark" : "light");
      setAccentColor(
        sanitizeHexColor(
          window.getComputedStyle(root).getPropertyValue("--primary-color")
        ) ?? DEFAULT_PRIMARY_COLOR
      );
    };
    sync();

    const observer = new MutationObserver(sync);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme", "data-theme-variant"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let isMounted = true;

    getPublicBrandSettings()
      .then((result) => {
        if (isMounted && result.success && result.data) {
          setBrand(result.data);
        }
      })
      .catch(() => {
        // La marca es decorativa: el shell usa el título como respaldo.
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const refreshCounters = useCallback(async () => {
    if (!userId || (typeof navigator !== "undefined" && !navigator.onLine)) return;

    try {
      const [tasks, unread, recent] = await Promise.all([
        getPendingTasksCount(),
        getUnreadCount(),
        getUnreadNotifications(),
      ]);

      if (tasks.success && typeof tasks.data === "number") setTaskCount(tasks.data);
      if (unread.success && typeof unread.data === "number") setUnreadCount(unread.data);
      if (recent.success && Array.isArray(recent.data)) {
        setNotifications(recent.data as ShellNotificationSource[]);
      }
    } catch {
      // Se reintenta en el siguiente ciclo de refresco.
    }
  }, [userId]);

  useEffect(() => {
    void refreshCounters();
  }, [refreshCounters, pathname]);

  useEffect(() => {
    const interval = window.setInterval(() => void refreshCounters(), REFRESH_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshCounters();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refreshCounters]);

  const snapshot = useMemo<ShellSnapshot>(() => buildShellSnapshot({
    route: pathname || "/",
    theme,
    accentColor,
    user: session?.user
      ? {
        name: session.user.name,
        role: session.user.role,
        image: session.user.image,
      }
      : null,
    logoLight: brand?.logoLight ?? null,
    logoDark: brand?.logoDark ?? null,
    taskCount,
    unreadNotificationCount: unreadCount,
    notifications: notifications.map((item) => ({
      id: item.id,
      message: item.message,
      createdAt: item.createdAt,
      read: item.read,
      authorName: item.clientName ?? item.createdByUser?.name ?? null,
      avatarUrl: item.clientLogo ?? item.createdByUser?.image ?? null,
    })),
    overlayHidden: isTransactionOpen,
  }), [
    pathname,
    theme,
    accentColor,
    session?.user,
    brand,
    taskCount,
    unreadCount,
    notifications,
    isTransactionOpen,
  ]);

  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  // Publicar el snapshot hacia Swift.
  useEffect(() => {
    const handler = (window as Window & WebKitBridge)
      .webkit?.messageHandlers?.[TOTEM_SHELL_BRIDGE_NAME];
    if (!handler) return;

    try {
      handler.postMessage(JSON.stringify(snapshot));
    } catch {
      // Un fallo de serialización no debe romper la navegación web.
    }
  }, [snapshot]);

  const applyThemeVariant = useCallback(async (variant: ThemeVariant) => {
    const current: ThemeVariant = document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";
    if (current === variant) return;

    const next = toggleThemeVariantClient();
    try {
      await updateUserSettings({ darkMode: next.variant === "dark" });
    } catch {
      // El tema queda aplicado en el cliente aunque falle el guardado.
    }
  }, []);

  const runCommand = useCallback(async (rawValue: unknown) => {
    const command = parseShellCommand(rawValue, snapshotRef.current);
    if (!command) return false;

    switch (command.type) {
      case "navigate":
        router.push(command.route);
        return true;
      case "toggleTheme": {
        const next = toggleThemeVariantClient();
        try {
          await updateUserSettings({ darkMode: next.variant === "dark" });
        } catch {
          // Igual que en la web: el cambio local no depende del guardado.
        }
        return true;
      }
      case "setTheme":
        await applyThemeVariant(command.variant);
        return true;
      case "markNotificationRead": {
        const result = await markAsRead(command.notificationId);
        if (result.success) {
          setNotifications((prev) => prev.map((item) =>
            item.id === command.notificationId ? { ...item, read: true } : item
          ));
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
        return result.success;
      }
      case "openNotifications":
        router.push(SHELL_NOTIFICATIONS_ROUTE);
        return true;
      case "openSettings":
        router.push(SHELL_SETTINGS_ROUTE);
        return true;
      case "openIntegrations":
        router.push(SHELL_INTEGRATIONS_ROUTE);
        return true;
      case "openTransaction":
        setTransactionTab(command.tab);
        setIsTransactionOpen(true);
        return true;
      case "signOut":
        await signOutWithTotemIOSCleanup();
        return true;
    }
  }, [applyThemeVariant, router]);

  // Registrar el receptor de comandos: Swift lo invoca con argumentos tipados.
  useEffect(() => {
    const scope = window as unknown as Record<string, unknown>;
    scope[SHELL_DISPATCH_FUNCTION] = (value: unknown) => runCommand(value);

    return () => {
      delete scope[SHELL_DISPATCH_FUNCTION];
    };
  }, [runCommand]);

  return (
    <TransactionDialog
      open={isTransactionOpen}
      onOpenChange={setIsTransactionOpen}
      defaultTab={transactionTab}
    />
  );
}
