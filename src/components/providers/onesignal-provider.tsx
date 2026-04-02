"use client";

import { useEffect, useCallback, useState } from "react";
import { useSession } from "next-auth/react";
import { PushPermissionBanner } from "./PushPermissionBanner";

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
    addEventListener: (event: string, callback: (data: ForegroundNotificationEvent | NotificationEventData) => void) => void;
    removeEventListener: (event: string, callback: (data: ForegroundNotificationEvent | NotificationEventData) => void) => void;
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

interface ForegroundNotificationEvent {
  notification: {
    title?: string;
    body?: string;
    data?: Record<string, unknown>;
  };
  preventDefault: () => void;
}

interface NotificationEventData {
  notification?: {
    title?: string;
    body?: string;
  };
}

const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
const ONESIGNAL_SAFARI_WEB_ID = process.env.NEXT_PUBLIC_ONESIGNAL_SAFARI_WEB_ID;

/**
 * Carga dinámicamente el script de OneSignal desde el cliente
 */
function loadOneSignalScript(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve();
      return;
    }

    // Si ya está cargado
    if (window.OneSignal) {
      resolve();
      return;
    }

    // Si ya está cargando, espera
    if ((window as any).OneSignalScriptLoading) {
      const checkInterval = setInterval(() => {
        if (window.OneSignal) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      return;
    }

    (window as any).OneSignalScriptLoading = true;

    const script = document.createElement("script");
    // URL correcta del SDK v16 de OneSignal
    script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.es6.js";
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      console.error("[OneSignal] Error al cargar el SDK desde CDN");
      (window as any).OneSignalScriptLoading = false;
      resolve();
    };
    script.onload = () => {
      console.log("[OneSignal] Script cargado desde CDN");
      (window as any).OneSignalScriptLoading = false;
      resolve();
    };
    document.head.appendChild(script);
  });
}

/**
 * Espera a que OneSignal esté disponible en window
 */
function waitForOneSignal(timeout = 20000): Promise<OneSignalInstance | null> {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      if (typeof window !== "undefined" && window.OneSignal) {
        resolve(window.OneSignal);
      } else if (Date.now() - start > timeout) {
        console.warn("[OneSignal] Timeout esperando SDK (20s)");
        resolve(null);
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });
}
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
  const [showBanner, setShowBanner] = useState(false);

  // Inicializar OneSignal una sola vez
  useEffect(() => {
    if (!ONESIGNAL_APP_ID) {
      console.warn("[OneSignal] App ID no configurado");
      return;
    }

    let mounted = true;

    // Handler para notificaciones en primer plano
    const handleForegroundNotification = (event: ForegroundNotificationEvent | NotificationEventData) => {
      console.log("[OneSignal] Notificación recibida en primer plano:", event);
      
      // Extraer datos de la notificación
      const notification = "notification" in event ? event.notification : null;
      const title = notification?.title || "Nueva notificación";
      const body = notification?.body || "";
      
      // Vibrar el dispositivo si está disponible (móvil/PWA)
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }
      
      // Reproducir sonido de notificación
      playNotificationSound();
      
      // Mostrar notificación in-app visual cuando la página está activa
      // Esto funciona en todos los navegadores incluido iOS Safari
      if (document.visibilityState === "visible") {
        showInAppNotification(title, body);
      }
    };

    // Mostrar notificación visual in-app (especialmente para iOS)
    const showInAppNotification = (title: string, body: string) => {
      // Crear el elemento de notificación
      const notificationEl = document.createElement("div");
      notificationEl.id = "onesignal-inapp-notification";
      notificationEl.innerHTML = `
        <div style="
          position: fixed;
          top: 20px;
          right: 20px;
          left: 20px;
          max-width: 400px;
          margin: 0 auto;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 16px 20px;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.3);
          z-index: 999999;
          animation: slideDown 0.3s ease-out;
          cursor: pointer;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        ">
          <style>
            @keyframes slideDown {
              from { transform: translateY(-100%); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
            @keyframes slideUp {
              from { transform: translateY(0); opacity: 1; }
              to { transform: translateY(-100%); opacity: 0; }
            }
          </style>
          <div style="display: flex; align-items: flex-start; gap: 12px;">
            <div style="
              width: 40px;
              height: 40px;
              background: rgba(255,255,255,0.2);
              border-radius: 10px;
              display: flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
            ">
              🔔
            </div>
            <div style="flex: 1; min-width: 0;">
              <div style="font-weight: 600; font-size: 15px; margin-bottom: 4px;">${title}</div>
              <div style="font-size: 14px; opacity: 0.9; line-height: 1.4;">${body}</div>
            </div>
            <button style="
              background: rgba(255,255,255,0.2);
              border: none;
              color: white;
              width: 24px;
              height: 24px;
              border-radius: 50%;
              cursor: pointer;
              font-size: 14px;
              display: flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
            " onclick="this.closest('#onesignal-inapp-notification').remove()">✕</button>
          </div>
        </div>
      `;
      
      // Remover notificación anterior si existe
      const existing = document.getElementById("onesignal-inapp-notification");
      if (existing) existing.remove();
      
      // Agregar al DOM
      document.body.appendChild(notificationEl);
      
      // Auto-cerrar después de 5 segundos
      setTimeout(() => {
        const el = document.getElementById("onesignal-inapp-notification");
        if (el) {
          el.style.animation = "slideUp 0.3s ease-out forwards";
          setTimeout(() => el.remove(), 300);
        }
      }, 5000);
    };

    // Función para reproducir sonido
    const playNotificationSound = () => {
      try {
        // Crear un contexto de audio para reproducir el sonido
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        // Crear un oscilador para generar un tono de notificación
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Configurar el tono (frecuencia agradable para notificación)
        oscillator.frequency.value = 880; // Nota A5
        oscillator.type = "sine";
        
        // Configurar volumen con fade out
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        // Reproducir por 300ms
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
      } catch (error) {
        // Si el audio no está disponible, ignorar silenciosamente
        console.log("[OneSignal] No se pudo reproducir sonido:", error);
      }
    };

    async function initOneSignal() {
      try {
        // Primero cargar el script
        await loadOneSignalScript();
        
        // Luego esperar a que esté disponible
        const oneSignal = await waitForOneSignal();
        if (!oneSignal || !mounted) return;

        const initConfig: OneSignalConfig = {
          appId: ONESIGNAL_APP_ID!,
          allowLocalhostAsSecureOrigin: true,
          serviceWorkerPath: "/sw.js",
        };

        // Agregar Safari Web ID si está configurado (requerido para iOS)
        if (ONESIGNAL_SAFARI_WEB_ID) {
          initConfig.safari_web_id = ONESIGNAL_SAFARI_WEB_ID;
          console.log("[OneSignal] Safari Web ID configurado para iOS");
        } else {
          console.warn("[OneSignal] ⚠️ Safari Web ID no configurado - notificaciones PUSH en iOS no funcionarán");
        }

        await oneSignal.init(initConfig);

        // Habilitar notificaciones en primer plano
        // El listener 'foregroundWillDisplay' permite mostrar notificaciones
        // incluso cuando la app/pestaña está activa
        oneSignal.Notifications.addEventListener(
          "foregroundWillDisplay",
          handleForegroundNotification
        );

        console.log("[OneSignal] SDK inicializado correctamente (con soporte para notificaciones en primer plano)");
        if (mounted) {
          setOneSignalReady(true);
          // Mostrar banner si el usuario aún no tomó una decisión sobre notificaciones
          if (
            typeof window !== "undefined" &&
            "Notification" in window &&
            oneSignal.Notifications.permissionNative === "default"
          ) {
            setShowBanner(true);
          }
        }
      } catch (error) {
        console.error("[OneSignal] Error al inicializar:", error);
      }
    }

    initOneSignal();

    return () => {
      mounted = false;
      // Limpiar listener al desmontar
      waitForOneSignal().then((oneSignal) => {
        if (oneSignal) {
          oneSignal.Notifications.removeEventListener(
            "foregroundWillDisplay",
            handleForegroundNotification
          );
        }
      });
    };
  }, []);

  // Cuando el usuario inicia sesión y OneSignal está listo, registrar
  useEffect(() => {
    if (!oneSignalReady || !session?.user?.id) return;

    let mounted = true;
    let retryInterval: NodeJS.Timeout | null = null;

    async function tryRegisterUser() {
      try {
        const oneSignal = await waitForOneSignal();
        if (!oneSignal || !mounted) return false;

        const playerId = oneSignal.User.PushSubscription.id;
        if (!playerId) {
          return false; // No registrado aún
        }

        console.log("[OneSignal] PlayerId obtenido:", playerId);

        // 1. Establecer el External ID (CRÍTICO para asociar al usuario)
        // Esto es lo que permite que OneSignal emparejecorrectamente las notificaciones
        await oneSignal.login(session.user.id);
        console.log("[OneSignal] External ID configurado:", session.user.id);

        // 2. Agregar tags del usuario
        await oneSignal.User.addTags({
          userId: session.user.id,
          userName: session.user.name || "Usuario",
          userRole: session.user.role || "EDITOR",
        });
        console.log("[OneSignal] Tags agregados:", {
          userId: session.user.id,
          userName: session.user.name,
          userRole: session.user.role,
        });

        // 3. Registrar en BD
        await registerPlayerInDb(playerId, session.user.id);
        console.log("[OneSignal] Usuario registrado en BD");

        return true; // Éxito
      } catch (error) {
        console.error("[OneSignal] Error al registrar usuario:", error);
        return false;
      }
    }

    async function registerWithRetry() {
      // Intento inicial
      const success = await tryRegisterUser();
      if (success || !mounted) return;

      console.log("[OneSignal] No hay playerId aún, reintentando cada 3s...");
      
      // Reintentar cada 3 segundos hasta que funcione (max 60s)
      let attempts = 0;
      const maxAttempts = 20;
      
      retryInterval = setInterval(async () => {
        if (!mounted || attempts >= maxAttempts) {
          if (retryInterval) clearInterval(retryInterval);
          if (attempts >= maxAttempts) {
            console.log("[OneSignal] Máximo de intentos alcanzado");
          }
          return;
        }
        
        attempts++;
        const success = await tryRegisterUser();
        if (success && retryInterval) {
          clearInterval(retryInterval);
        }
      }, 3000);
    }

    registerWithRetry();

    return () => {
      mounted = false;
      if (retryInterval) clearInterval(retryInterval);
    };
  }, [oneSignalReady, session?.user?.id, session?.user?.name, session?.user?.role]);

  const handleEnableNotifications = useCallback(async (): Promise<boolean> => {
    const oneSignal = await waitForOneSignal();
    if (!oneSignal) return false;
    try {
      await oneSignal.Notifications.requestPermission();
      const granted = oneSignal.Notifications.permission === true;
      if (granted) setShowBanner(false);
      return granted;
    } catch {
      return false;
    }
  }, []);

  return (
    <>
      {children}
      {showBanner && session?.user?.id && (
        <PushPermissionBanner onEnable={handleEnableNotifications} />
      )}
    </>
  );
}

/**
 * Registra el playerId en nuestra base de datos
 */
async function registerPlayerInDb(playerId: string, userId: string) {
  try {
    console.log("[OneSignal] Intentando registrar playerId:", playerId, "para userId:", userId);
    
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
      const errorText = await response.text();
      console.error("[OneSignal] Error respuesta del servidor:", response.status, errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log("[OneSignal] PlayerId registrado en BD exitosamente:", data);
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
