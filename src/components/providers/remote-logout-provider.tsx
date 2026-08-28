"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import Pusher from "pusher-js";
import { toast } from "@/components/ui/use-toast";
import { signOutWithTotemIOSCleanup } from "@/lib/totem-ios-client";

/**
 * Provider que escucha eventos de logout remoto via Pusher
 * Cuando recibe un evento "force-logout" en el canal "system", cierra la sesión
 */
export function RemoteLogoutProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session } = useSession();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

    if (!pusherKey || !pusherCluster) {
      console.warn("⚠️ Pusher no configurado para logout remoto");
      return;
    }

    const pusher = new Pusher(pusherKey, {
      cluster: pusherCluster,
    });

    // Canal global del sistema para eventos broadcast
    const systemChannel = pusher.subscribe("system");

    systemChannel.bind("pusher:subscription_succeeded", () => {
      console.log("✅ Suscrito al canal system para logout remoto");
    });

    // Escuchar evento de logout forzado
    systemChannel.bind("force-logout", (data: {
      message?: string;
      targetUserId?: string | null; // null = todos, string = usuario específico
      timestamp?: string;
    }) => {
      console.log("🔒 Evento force-logout recibido:", data);

      // Si hay un userId objetivo, solo cerrar sesión si coincide
      if (data.targetUserId && session?.user?.id !== data.targetUserId) {
        console.log("⏭️ Logout no aplica a este usuario");
        return;
      }

      // Mostrar notificación antes de cerrar sesión
      toast({
        title: "Sesión cerrada",
        description: data.message || "Tu sesión ha sido cerrada remotamente",
        variant: "destructive",
      });

      // Esperar un momento para que el usuario vea la notificación
      setTimeout(() => {
        void signOutWithTotemIOSCleanup();
      }, 1500);
    });

    return () => {
      systemChannel.unbind_all();
      pusher.unsubscribe("system");
      pusher.disconnect();
    };
  }, [session?.user?.id]);

  return <>{children}</>;
}
