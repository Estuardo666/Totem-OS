"use client";

import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISSED_KEY = "onesignal-permission-dismissed-v1";

interface PushPermissionBannerProps {
  onEnable: () => Promise<boolean>;
}

export function PushPermissionBanner({ onEnable }: PushPermissionBannerProps) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // No mostrar si el browser no soporta notificaciones
    if (typeof window === "undefined" || !("Notification" in window)) return;
    // No mostrar si ya concedió o denegó permiso
    if (Notification.permission !== "default") return;
    // No mostrar si ya lo cerró antes
    if (localStorage.getItem(DISMISSED_KEY)) return;
    setVisible(true);
  }, []);

  if (!visible) return null;

  async function handleEnable() {
    setLoading(true);
    const success = await onEnable();
    setLoading(false);
    if (success || Notification.permission === "granted") {
      setVisible(false);
    } else if (Notification.permission === "denied") {
      setVisible(false);
      localStorage.setItem(DISMISSED_KEY, "1");
    }
    // Si sigue en default (cerró el prompt sin decidir), dejar el banner visible
  }

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-3 md:p-4 pointer-events-none">
      <div className="mx-auto max-w-lg pointer-events-auto">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur-sm">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bell className="h-4 w-4" />
          </div>
          <p className="flex-1 text-sm text-foreground">
            Activa las notificaciones para recibir avisos de tareas y contenido.
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              variant="default"
              disabled={loading}
              onClick={handleEnable}
              className="h-8 text-xs"
            >
              {loading ? "Activando…" : "Activar"}
            </Button>
            <button
              onClick={handleDismiss}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
