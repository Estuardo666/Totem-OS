"use client";

/**
 * Web Push Provider
 * Replaces OneSignalProvider. Handles:
 * - Service Worker registration
 * - Push subscription (Web Push / VAPID)
 * - iOS PWA standalone detection
 * - In-app foreground notifications + sound
 * - Re-subscription on each app load (iOS reliability)
 */

import { useEffect, useCallback, useState } from "react";
import { useSession } from "next-auth/react";
import { PushPermissionBanner } from "./PushPermissionBanner";
import { Button } from "@/components/ui/button";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert base64url string to Uint8Array — required for applicationServerKey.
 * Base64url uses - and _ instead of + and /, and may lack padding.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Check if running as installed PWA (standalone mode).
 * On iOS, push only works in standalone mode.
 */
function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    (window.navigator as any).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

/**
 * Check if the current browser is iOS Safari (not Chrome iOS, not Android).
 */
function isIOSSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
}

// ---------------------------------------------------------------------------
// In-app notification (shown when app is in foreground)
// ---------------------------------------------------------------------------

function showInAppNotification(title: string, body: string) {
  const existing = document.getElementById("webpush-inapp-notification");
  if (existing) existing.remove();

  const el = document.createElement("div");
  el.id = "webpush-inapp-notification";
  el.innerHTML = `
    <div style="
      position: fixed; top: 20px; right: 20px; left: 20px; max-width: 400px;
      margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white; padding: 16px 20px; border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3); z-index: 999999;
      animation: wpSlideDown 0.3s ease-out; cursor: pointer;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    ">
      <style>
        @keyframes wpSlideDown { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes wpSlideUp { from { transform: translateY(0); opacity: 1; } to { transform: translateY(-100%); opacity: 0; } }
      </style>
      <div style="display: flex; align-items: flex-start; gap: 12px;">
        <div style="width:40px;height:40px;background:rgba(255,255,255,0.2);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">🔔</div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:15px;margin-bottom:4px;">${title}</div>
          <div style="font-size:14px;opacity:0.9;line-height:1.4;">${body}</div>
        </div>
        <button style="background:rgba(255,255,255,0.2);border:none;color:white;width:24px;height:24px;border-radius:50%;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;" onclick="this.closest('#webpush-inapp-notification').remove()">✕</button>
      </div>
    </div>
  `;

  document.body.appendChild(el);

  setTimeout(() => {
    const notification = document.getElementById("webpush-inapp-notification");
    if (notification) {
      notification.style.animation = "wpSlideUp 0.3s ease-out forwards";
      setTimeout(() => notification.remove(), 300);
    }
  }, 5000);
}

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // Audio not available
  }
}

// ---------------------------------------------------------------------------
// Service Worker registration (separate from subscription)
// ---------------------------------------------------------------------------

async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  try {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    return reg;
  } catch (error) {
    console.error("[WebPush] SW registration failed:", error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Subscribe logic — ONLY call when Notification.permission === "granted"
// ---------------------------------------------------------------------------

async function subscribeAndRegister(): Promise<boolean> {
  if (!VAPID_PUBLIC_KEY) {
    console.warn("[WebPush] NEXT_PUBLIC_VAPID_PUBLIC_KEY not set");
    return false;
  }

  try {
    const registration = await registerServiceWorker();
    if (!registration) return false;

    // Check existing subscription first (re-subscribe scenario)
    let subscription = await registration.pushManager.getSubscription();

    // If no subscription, create one
    if (!subscription) {
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource;
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    }

    if (!subscription) {
      console.error("[WebPush] Failed to get subscription");
      return false;
    }

    // Extract keys — browser returns them as base64url strings.
    // We store them as-is in the database. web-push accepts them directly.
    const rawKey = subscription.getKey("p256dh");
    const rawAuth = subscription.getKey("auth");

    if (!rawKey || !rawAuth) {
      console.error("[WebPush] Missing subscription keys");
      return false;
    }

    // Convert ArrayBuffer to base64url string for transport/storage
    const p256dh = btoa(String.fromCharCode(...new Uint8Array(rawKey)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const auth = btoa(String.fromCharCode(...new Uint8Array(rawAuth)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    // POST to backend
    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        keys: { p256dh, auth },
      }),
    });

    if (!response.ok) {
      console.error("[WebPush] Subscribe API failed:", response.status);
      return false;
    }

    console.log("[WebPush] Subscription registered successfully");
    return true;
  } catch (error) {
    console.error("[WebPush] subscribeAndRegister error:", error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Provider Component
// ---------------------------------------------------------------------------

export function WebPushProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [showBanner, setShowBanner] = useState(false);
  const [showInstallHint, setShowInstallHint] = useState(false);

  // On mount: check permission state, show banner or re-subscribe
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      console.log("[WebPush] Push not supported in this browser");
      return;
    }

    let mounted = true;

    async function init() {
      // On iOS non-standalone: show "Add to Home Screen" hint
      if (isIOSSafari() && !isStandalone()) {
        console.log("[WebPush] iOS non-standalone — showing install hint");
        if (mounted) setShowInstallHint(true);
        return;
      }

      // Register SW early (always safe, no permission needed)
      await registerServiceWorker();

      if (!mounted) return;

      // On iOS, Notification might not be available immediately — retry
      let permission: string = "denied";
      if (typeof Notification !== "undefined") {
        permission = Notification.permission;
      } else if (isIOSSafari()) {
        // Retry after 1s — iOS PWA sometimes delays Notification availability
        await new Promise((r) => setTimeout(r, 1000));
        if (!mounted) return;
        permission = "Notification" in window ? window.Notification.permission : "denied";
      }

      if (permission === "granted") {
        await subscribeAndRegister();
      } else if (permission === "default") {
        if (!localStorage.getItem("webpush-permission-dismissed-v1")) {
          setShowBanner(true);
        }
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  // Listen for messages from the service worker (foreground notifications)
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "PUSH_NOTIFICATION") {
        const { title, body } = event.data;
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        playNotificationSound();
        if (document.visibilityState === "visible") {
          showInAppNotification(title || "Nueva notificación", body || "");
        }
      }
    };

    navigator.serviceWorker.addEventListener("message", handleMessage);
    return () => navigator.serviceWorker.removeEventListener("message", handleMessage);
  }, []);

  // When session is available and permission granted, ensure subscription is linked to user
  useEffect(() => {
    if (!session?.user?.id) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

    // Re-subscribe to update userId association in DB
    subscribeAndRegister().catch((err) =>
      console.error("[WebPush] Re-subscribe after login failed:", err)
    );
  }, [session?.user?.id]);

  // CRITICAL for Safari: requestPermission() must be called synchronously
  // inside a click handler — no await before it.
  const handleEnableNotifications = useCallback(async (): Promise<boolean> => {
    if (typeof Notification === "undefined") return false;

    try {
      // requestPermission() is synchronous in spec but returns a promise.
      // Safari requires it to be the FIRST call in the click handler.
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        setShowBanner(false);
        // Now subscribe (permission is granted, this will work)
        const success = await subscribeAndRegister();
        return success;
      }
      if (permission === "denied") {
        setShowBanner(false);
      }
      return false;
    } catch (error) {
      console.error("[WebPush] Permission request failed:", error);
      return false;
    }
  }, []);

  return (
    <>
      {children}
      {showBanner && session?.user?.id && (
        <PushPermissionBanner onEnable={handleEnableNotifications} />
      )}
      {showInstallHint && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-3 md:p-4 pointer-events-none">
          <div className="mx-auto max-w-lg pointer-events-auto">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur-sm">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                📲
              </div>
              <p className="flex-1 text-sm text-foreground">
                Para recibir notificaciones, añade esta app a tu pantalla de inicio: <strong>Compartir → Añadir a pantalla de inicio</strong>.
              </p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  localStorage.setItem("webpush-install-dismissed", "1");
                  setShowInstallHint(false);
                }}
                className="h-8 text-xs shrink-0"
              >
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
