"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Pusher from "pusher-js";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle2, RefreshCw } from "lucide-react";

export function DashboardRefresh() {
  const { data: session } = useSession();
  const router = useRouter();
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const userId = session?.user?.id;

  const triggerRefresh = useCallback(() => {
    setLastUpdated(new Date());
    setIsRefreshing(true);
    window.dispatchEvent(new CustomEvent("totem:dashboard-refresh"));
    setTimeout(() => {
      router.refresh();
      setIsRefreshing(false);
    }, 300);
  }, [router]);

  useEffect(() => {
    if (!userId || typeof window === "undefined") return;

    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

    if (!pusherKey || !pusherCluster) {
      console.warn("⚠️ Pusher no está configurado para actualización del dashboard");
      return;
    }

    const pusher = new Pusher(pusherKey, {
      cluster: pusherCluster,
    });

    // Suscribirse al canal privado del usuario
    const channel = pusher.subscribe(`user-${userId}`);

    channel.bind("pusher:subscription_succeeded", () => {
      console.log(`✅ Suscrito al canal de actualización del dashboard: user-${userId}`);
    });

    // Escuchar eventos de actualización del dashboard
    channel.bind("update-dashboard", (data: {
      message?: string;
      timestamp?: string;
    }) => {
      console.log("🔄 Evento de actualización del dashboard recibido:", data);
      
      triggerRefresh();
    });

    // También escuchar eventos de notificaciones que pueden indicar cambios
    channel.bind("new-notification", () => {
      // Si hay una nueva notificación, puede haber cambios en el dashboard
      // Esperar un momento para que el servidor procese los cambios
      setTimeout(() => {
        triggerRefresh();
      }, 500);
    });

    // Cleanup
    return () => {
      pusher.unsubscribe(`user-${userId}`);
      pusher.disconnect();
    };
  }, [userId, triggerRefresh]);

  // Inicializar lastUpdated al montar
  useEffect(() => {
    if (!lastUpdated) {
      setLastUpdated(new Date());
    }
  }, [lastUpdated]);

  if (!userId || !lastUpdated) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <button
        type="button"
        onClick={triggerRefresh}
        aria-label="Actualizar dashboard"
        title="Actualizar dashboard"
        className="inline-flex size-8 items-center justify-center rounded-lg border border-border/70 bg-card text-muted-foreground shadow-sm transition-[transform,background-color,color] duration-200 hover:bg-muted hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <RefreshCw className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
      </button>
      {isRefreshing ? (
        <span className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          Actualizando...
        </span>
      ) : (
        <span className="flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-green-500" />
          Actualizado {formatDistanceToNow(lastUpdated, { addSuffix: true, locale: es })}
        </span>
      )}
    </div>
  );
}

