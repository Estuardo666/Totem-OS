"use client";

import { useState, useEffect } from "react";

const DISMISSED_KEY = "webpush-permission-dismissed-v1";

interface PushPermissionBannerProps {
  onEnable: () => Promise<boolean>;
}

// All critical positioning uses inline styles to guarantee visibility on mobile.
// Tailwind classes + body overflow rules were clipping the banner on mobile browsers.
export function PushPermissionBanner({ onEnable }: PushPermissionBannerProps) {
  const [visible, setVisible] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isDenied, setIsDenied] = useState(false);

  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "denied") {
      setIsDenied(true);
    }
  }, []);

  if (!visible) return null;

  async function handleEnable() {
    setLoading(true);
    const success = await onEnable();
    setLoading(false);
    if (success || (typeof Notification !== "undefined" && Notification.permission === "granted")) {
      setVisible(false);
    } else if (typeof Notification !== "undefined" && Notification.permission === "denied") {
      setVisible(false);
      localStorage.setItem(DISMISSED_KEY, "1");
    }
  }

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  }

  const wrapperStyle: React.CSSProperties = {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 2147483647,
    padding: "12px",
    pointerEvents: "none",
  };

  const cardStyle: React.CSSProperties = {
    maxWidth: "32rem",
    margin: "0 auto",
    pointerEvents: "auto",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    borderRadius: "12px",
    border: "1px solid hsl(var(--border))",
    background: "hsl(var(--background) / 0.95)",
    padding: "12px 16px",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    touchAction: "auto",
  };

  if (isDenied) {
    return (
      <div style={wrapperStyle}>
        <div style={{ ...cardStyle, borderColor: "hsl(var(--destructive) / 0.3)" }}>
          <p style={{ flex: 1, fontSize: "14px", color: "hsl(var(--muted-foreground))" }}>
            Notificaciones bloqueadas. Actívalas en Ajustes del navegador.
          </p>
          <button
            onClick={handleDismiss}
            style={{ background: "none", border: "1px solid hsl(var(--border))", borderRadius: "6px", padding: "4px 12px", cursor: "pointer", fontSize: "12px", color: "hsl(var(--foreground))", touchAction: "auto" }}
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={wrapperStyle}>
      <div style={cardStyle}>
        <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "hsl(var(--primary) / 0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "18px" }}>
          🔔
        </div>
        <p style={{ flex: 1, fontSize: "14px", color: "hsl(var(--foreground))", lineHeight: 1.4 }}>
          Activa las notificaciones para recibir avisos de tareas y contenido.
        </p>
        <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
          <button
            onClick={handleEnable}
            disabled={loading}
            style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", border: "none", borderRadius: "6px", padding: "8px 16px", cursor: loading ? "wait" : "pointer", fontSize: "13px", fontWeight: 500, touchAction: "auto", whiteSpace: "nowrap" }}
          >
            {loading ? "Activando…" : "Activar"}
          </button>
          <button
            onClick={handleDismiss}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px", padding: "4px 6px", color: "hsl(var(--muted-foreground))", touchAction: "auto" }}
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
