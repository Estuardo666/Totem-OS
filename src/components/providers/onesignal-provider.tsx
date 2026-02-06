"use client";

import { useEffect, useCallback, useState } from "react";
import { useSession } from "next-auth/react";

// Tipo para OneSignal
declare global {
  interface Window {
    OneSignal?: OneSignalInstance;
    OneSignalDeferred?: Array<(oneSignal: OneSignalInstance) => void>;
  }
}

interface OneSignalInstance {
  init: (config: OneSignalConfig) => Promise<void>;
  User: {
    PushSubscription: {
      optIn: () => Promise<void>;
      optOut: () => Promise<void>;
      id: string | null;
    };
    addTag: (key: string, value: string) => Promise<void>;
    addTags: (tags: Record<string, string>) => Promise<void>;
  };
  Notifications: {
    permission?: boolean;
    permissionNative?: NotificationPermission;
    requestPermission: () => Promise<void>;
    addEventListener?: (event: string, callback: (data: NotificationEventData) => void) => void;
  };
  login: (externalId: string) => Promise<void>;
  logout: () => Promise<void>;
}

interface OneSignalConfig {
  appId: string;
  safari_web_id?: string;
  notifyButton?: { enable: boolean };
  allowLocalhostAsSecureOrigin?: boolean;
  serviceWorkerPath?: string;
}

interface NotificationEventData {
  notification?: {
    title?: string;
    body?: string;
  };
}

const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;

/**
 * Espera a que OneSignal esté disponible en window
 */
function waitForOneSignal(timeout = 5000): Promise<OneSignalInstance | null> {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      if (typeof window !== "undefined" && window.OneSignal) {
        resolve(window.OneSignal);
      } else if (Date.now() - start > timeout) {
        console.warn("[OneSignal] Timeout esperando SDK");
        resolve(null);
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });
}

/**
 * Hook para usar OneSignal en componentes
 */
export function useOneSignal() {
  const requestPermission = useCallback(async () => {
    const oneSignal = await waitForOneSignal();
    if (!oneSignal) return false;
    
    try {
      await oneSignal.Notifications.requestPermission();
      return true;
    } catch (error) {
      console.error("[OneSignal] Error al solicitar permiso:", error);
      return false;
    }
  }, []);

  const getPlayerId = useCallback(async (): Promise<string | null> => {
    const oneSignal = await waitForOneSignal();
    if (!oneSignal) return null;
    return oneSignal.User.PushSubscription.id;
  }, []);

  const setTags = useCallback(async (tags: Record<string, string>) => {
    const oneSignal = await waitForOneSignal();
    if (!oneSignal) return;
    await oneSignal.User.addTags(tags);
  }, []);

  return { requestPermission, getPlayerId, setTags };
}

/**
 * Provider que inicializa OneSignal y registra el playerId del usuario
 */
export function OneSignalProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  // Desactivado temporalmente por problemas en producción
  // TODO: Reactivar cuando NextAuth esté funcionando correctamente
  return <>{children}</>;

  /*
  const [oneSignalReady, setOneSignalReady] = useState(false);

  // Inicializar OneSignal una sola vez
  useEffect(() => {
    // TODO: implementar cuando NextAuth esté listo
  }, []);

  // Cuando el usuario inicia sesión y OneSignal está listo, registrar
  useEffect(() => {
    // TODO: implementar cuando NextAuth esté listo
  }, [session?.user?.id]);

  return <>{children}</>;
  */
}

/**
 * Registra el playerId en nuestra base de datos
 */
async function registerPlayerInDb(playerId: string, userId: string) {
  try {
    const response = await fetch("/api/onesignal/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerId,
        userId,
        device: getDeviceType(),
        browser: getBrowserName(),
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    console.log("[OneSignal] PlayerId registrado en BD");
  } catch (error) {
    console.error("[OneSignal] Error al registrar playerId:", error);
  }
}

function getDeviceType(): string {
  if (typeof navigator === "undefined") return "unknown";
  
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "web";
}

function getBrowserName(): string {
  if (typeof navigator === "undefined") return "unknown";
  
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("safari") && !ua.includes("chrome")) return "safari";
  if (ua.includes("firefox")) return "firefox";
  if (ua.includes("edge")) return "edge";
  if (ua.includes("chrome")) return "chrome";
  return "other";
}

export default OneSignalProvider;
