"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Pusher from "pusher-js";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/use-toast";
import {
  getUnreadNotifications,
  markAsRead,
  getUnreadCount,
} from "@/actions/notification-actions";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useNotificationAudio } from "@/hooks";
import { getCurrentUser } from "@/actions/user.actions";

type NotificationWithCreator = {
  id: string;
  message: string;
  type: string;
  read: boolean;
  createdBy: string | null;
  createdAt: Date;
  clientLogo?: string | null;
  clientName?: string | null;
  createdByUser?: {
    name: string;
    image: string | null;
  };
};

interface NotificationBellProps {
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
}

export function NotificationBell({ align = "start", side = "right" }: NotificationBellProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<NotificationWithCreator[]>(
    []
  );
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [soundNotificationsEnabled, setSoundNotificationsEnabled] = useState(true);
  const processedNotificationIds = useRef<Set<string>>(new Set());
  const pusherRef = useRef<Pusher | null>(null);
  const channelRef = useRef<any>(null);
  const toastShownRef = useRef<Set<string>>(new Set());
  const isProcessingRef = useRef<Set<string>>(new Set());

  const userId = session?.user?.id;
  const { playNotificationSound } = useNotificationAudio(soundNotificationsEnabled);

  // Cargar notificaciones iniciales y configuración de usuario
  useEffect(() => {
    if (!userId) return;

    const loadNotifications = async () => {
      try {
        const [notificationsResult, countResult, userResult] = await Promise.all([
          getUnreadNotifications(),
          getUnreadCount(),
          getCurrentUser(),
        ]);

        if (notificationsResult.success && notificationsResult.data) {
          setNotifications(notificationsResult.data);
        }

        if (countResult.success && countResult.data !== undefined) {
          setUnreadCount(countResult.data);
        }

        if (userResult.success && userResult.data) {
          setSoundNotificationsEnabled(userResult.data.soundNotifications ?? true);
        }
      } catch (error) {
        console.error("Error al cargar notificaciones:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadNotifications();
  }, [userId]);

  // Configurar Pusher para notificaciones en tiempo real
  useEffect(() => {
    if (!userId || typeof window === "undefined") return;

    // Limpiar suscripción anterior si existe
    if (pusherRef.current) {
      if (channelRef.current) {
        channelRef.current.unbind_all();
        pusherRef.current.unsubscribe(`user-${userId}`);
      }
      pusherRef.current.disconnect();
      pusherRef.current = null;
      channelRef.current = null;
    }

    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

    if (!pusherKey || !pusherCluster) {
      console.warn("⚠️ Pusher no está configurado para notificaciones");
      return;
    }

    const pusher = new Pusher(pusherKey, {
      cluster: pusherCluster,
    });
    pusherRef.current = pusher;

    // Suscribirse al canal privado del usuario
    const channel = pusher.subscribe(`user-${userId}`);
    channelRef.current = channel;

    channel.bind("pusher:subscription_succeeded", () => {
      console.log(`✅ Suscrito al canal de notificaciones: user-${userId}`);
    });

    // Debounce para prevenir duplicados rápidos
    const processingTimeouts = new Map<string, NodeJS.Timeout>();

    // Escuchar nuevas notificaciones
    const handleNewNotification = (data: {
      id: string;
      message: string;
      type: string;
      createdBy: string | null;
      createdAt: string;
    }) => {
      console.log("🔔 Nueva notificación recibida:", data);

      // Prevenir duplicados con verificación triple: ID, mensaje y timestamp
      const notificationKey = `${data.id}-${data.message}-${data.createdAt}`;
      
      // Verificar si ya se procesó
      if (processedNotificationIds.current.has(notificationKey)) {
        console.log("⚠️ Notificación ya procesada, ignorando:", notificationKey);
        return;
      }

      // Verificar si ya se está procesando
      if (isProcessingRef.current.has(notificationKey)) {
        console.log("⚠️ Notificación ya en proceso, ignorando:", notificationKey);
        return;
      }

      // Verificar si ya se mostró un toast con este mensaje recientemente (últimos 3 segundos)
      if (toastShownRef.current.has(data.message)) {
        console.log("⚠️ Toast ya mostrado para este mensaje, ignorando:", data.message);
        return;
      }

      // Limpiar timeout anterior si existe
      const existingTimeout = processingTimeouts.get(notificationKey);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Marcar como en proceso y procesado inmediatamente
      isProcessingRef.current.add(notificationKey);
      processedNotificationIds.current.add(notificationKey);
      toastShownRef.current.add(data.message);

      // Limpiar el mensaje del set después de 3 segundos para permitir notificaciones futuras con el mismo mensaje
      setTimeout(() => {
        toastShownRef.current.delete(data.message);
        isProcessingRef.current.delete(notificationKey);
      }, 3000);

      // Reproducir sonido usando el hook (respetando soundNotifications)
      playNotificationSound();

      // Obtener información del usuario que creó la notificación
      const fetchCreatorInfo = async () => {
        try {
          // Recargar notificaciones para obtener la info completa
          const result = await getUnreadNotifications();
          if (result.success && result.data) {
            setNotifications(result.data);
            setUnreadCount((prev) => prev + 1);

            // Encontrar la notificación más reciente para obtener el avatar
            const latestNotification = result.data[0];
            if (latestNotification?.createdByUser || latestNotification?.clientLogo) {
              // Mostrar toast con avatar (prioridad: logo cliente → avatar usuario)
              const avatarSrc = latestNotification.clientLogo || latestNotification.createdByUser?.image || undefined;
              const avatarAlt = latestNotification.clientName || latestNotification.createdByUser?.name || "Usuario";
              const avatarFallback = latestNotification.clientName 
                ? latestNotification.clientName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
                : latestNotification.createdByUser?.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?";
              
              toast({
                title: (
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage
                        src={avatarSrc}
                        alt={avatarAlt}
                      />
                      <AvatarFallback>
                        {avatarFallback}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{data.message}</span>
                    </div>
                  </div>
                ),
                duration: 20000,
              });
            } else {
              // Fallback sin avatar
              toast({
                title: "Nueva notificación",
                description: data.message,
                duration: 20000,
              });
            }
          }
        } catch (error) {
          console.error("Error al obtener información del creador:", error);
        } finally {
          // Limpiar el timeout después de procesar
          processingTimeouts.delete(notificationKey);
        }
      };

      fetchCreatorInfo();
    };

    channel.bind("new-notification", handleNewNotification);

    // Cleanup
    return () => {
      // Limpiar todos los timeouts pendientes
      processingTimeouts.forEach((timeout) => clearTimeout(timeout));
      processingTimeouts.clear();
      
      if (channelRef.current) {
        channelRef.current.unbind_all();
      }
      if (pusherRef.current) {
        pusherRef.current.unsubscribe(`user-${userId}`);
        pusherRef.current.disconnect();
        pusherRef.current = null;
      }
      channelRef.current = null;
    };
  }, [userId, toast, playNotificationSound]);

  // Recargar notificaciones cuando se abre el popover
  useEffect(() => {
    if (isOpen && userId) {
      const loadNotifications = async () => {
        try {
          const [notificationsResult, countResult] = await Promise.all([
            getUnreadNotifications(),
            getUnreadCount(),
          ]);

          if (notificationsResult.success && notificationsResult.data) {
            setNotifications(notificationsResult.data);
          }

          if (countResult.success && countResult.data !== undefined) {
            setUnreadCount(countResult.data);
          }
        } catch (error) {
          console.error("Error al recargar notificaciones:", error);
        }
      };

      loadNotifications();
    }
  }, [isOpen, userId]);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const result = await markAsRead(notificationId);
      if (result.success) {
        // Actualizar estado local
        setNotifications((prev) =>
          prev.map((notif) =>
            notif.id === notificationId ? { ...notif, read: true } : notif
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Error al marcar como leída:", error);
    }
  };

  if (!userId) {
    return null;
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notificaciones"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[calc(100vw-32px)] sm:w-[380px] p-0 rounded-3xl bg-white dark:bg-background/5 dark:backdrop-blur-xl border border-black/5 dark:border-white/10 shadow-2xl data-[state=open]:slide-in-from-left-5 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-5 data-[state=closed]:fade-out-0 data-[state=closed]:scale-100"
        align={align}
        side={side}
        sideOffset={20}
        collisionPadding={10}
      >
        <div>
          <div className="p-4 border-b">
            <h3 className="font-semibold text-sm">Notificaciones</h3>
          </div>
          <div className="max-h-[85vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Cargando...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No tienes notificaciones nuevas
              </div>
            ) : (
              <>
                <div className="divide-y">
                  {notifications.slice(0, 5).map((notification) => (
                    <button
                      key={notification.id}
                      onClick={() => handleMarkAsRead(notification.id)}
                      className={cn(
                        "w-full p-4 text-left hover:bg-accent/50 transition-colors",
                        !notification.read && "bg-accent/30"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {/* Avatar: prioridad logo cliente → avatar usuario */}
                        {(notification.clientLogo || notification.createdByUser) && (
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage
                              src={notification.clientLogo || notification.createdByUser?.image || undefined}
                              alt={notification.clientName || notification.createdByUser?.name || "Usuario"}
                            />
                            <AvatarFallback>
                              {notification.clientName
                                ? notification.clientName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
                                : notification.createdByUser?.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?"}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground">
                            {notification.message}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(notification.createdAt), {
                              addSuffix: true,
                              locale: es,
                            })}
                          </p>
                        </div>
                        {!notification.read && (
                          <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
                {notifications.length > 5 && (
                  <div className="p-2 border-t">
                    <Button
                      variant="ghost"
                      className="w-full text-sm"
                      onClick={() => {
                        setIsOpen(false);
                        router.push("/admin/notifications");
                      }}
                    >
                      Ver todas las notificaciones
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

