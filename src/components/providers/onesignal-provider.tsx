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
  const [oneSignalReady, setOneSignalReady] = useState(false);

  // Inicializar OneSignal una sola vez
  useEffect(() => {
    if (typeof window === "undefined" || !ONESIGNAL_APP_ID) {
      return;
    }

    // Flag para evitar doble inicialización
    const flagKey = "__onesignal_init";
    if ((window as unknown as Record<string, boolean>)[flagKey]) {
      setOneSignalReady(true);
      return;
    }
    (window as unknown as Record<string, boolean>)[flagKey] = true;

    // No initializar en localhost a menos que sea explícito
    const isLocalhost = typeof window !== "undefined" && (
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"
    );

    if (isLocalhost) {
      console.info("[OneSignal] Saltando inicialización en localhost (requiere HTTPS y dominio autorizado)");
      setOneSignalReady(false);
      return;
    }

    // Cargar el SDK de OneSignal
    const script = document.createElement("script");
    script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
    script.defer = true;
    
    script.onload = async () => {
      try {
        const oneSignal = await waitForOneSignal(10000);
        if (!oneSignal) {
          console.warn("[OneSignal] SDK no disponible después de carga");
          setOneSignalReady(false);
          return;
        }

        // Verificar si ya fue inicializado
        try {
          await oneSignal.init({
            appId: ONESIGNAL_APP_ID,
            serviceWorkerPath: "/OneSignalSDKWorker.js",
            notifyButton: { enable: false },
          });
          console.log("[OneSignal] SDK inicializado correctamente");
        } catch (initError) {
          // Si ya está inicializado, continuar
          if (initError instanceof Error && initError.message.includes("already initialized")) {
            console.log("[OneSignal] SDK ya estaba inicializado");
          } else {
            throw initError;
          }
        }

        setOneSignalReady(true);
      } catch (error) {
        console.error("[OneSignal] Error al inicializar:", error);
        setOneSignalReady(false);
      }
    };

    script.onerror = () => {
      console.error("[OneSignal] Error al cargar el SDK");
      setOneSignalReady(false);
    };

    document.head.appendChild(script);

    return () => {
      // Cleanup: no removemos el script
    };
  }, []);

  // Cuando el usuario inicia sesión y OneSignal está listo, registrar
  useEffect(() => {
    if (!session?.user?.id || !oneSignalReady) return;

    const registerUser = async () => {
      const oneSignal = await waitForOneSignal(3000);
      if (!oneSignal) {
        console.warn("[OneSignal] SDK no disponible para registrar usuario");
        return;
      }

      try {
        // Obtener playerId sin hacer login (que causa el error)
        const playerId = oneSignal.User.PushSubscription.id;
        if (playerId) {
          await registerPlayerInDb(playerId, session.user.id);
          console.log("[OneSignal] PlayerId registrado:", playerId);
        }
      } catch (error) {
        console.warn("[OneSignal] No se pudo registrar playerId:", error);
      }
    };

    registerUser();
  }, [session?.user?.id, oneSignalReady]);

  return <>{children}</>;
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
