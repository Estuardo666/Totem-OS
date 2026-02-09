"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { markAsRead } from "@/actions/notification-actions";
import { useState } from "react";
import { useRouter } from "next/navigation";

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

interface NotificationsListProps {
  notifications: NotificationWithCreator[];
}

export function NotificationsList({ notifications }: NotificationsListProps) {
  const router = useRouter();
  const [localNotifications, setLocalNotifications] = useState(notifications);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const result = await markAsRead(notificationId);
      if (result.success) {
        setLocalNotifications((prev) =>
          prev.map((notif) =>
            notif.id === notificationId ? { ...notif, read: true } : notif
          )
        );
      }
    } catch (error) {
      console.error("Error al marcar como leída:", error);
    }
  };

  if (localNotifications.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">
          No tienes notificaciones aún
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {localNotifications.map((notification) => (
        <button
          key={notification.id}
          onClick={() => handleMarkAsRead(notification.id)}
          className={cn(
            "w-full p-4 text-left rounded-lg border transition-colors hover:bg-accent/50",
            !notification.read && "bg-accent/30 border-primary/20"
          )}
        >
          <div className="flex items-start gap-3">
            {/* Avatar: Prioridad logo del cliente, fallback a usuario creador */}
            {(notification.clientLogo || notification.createdByUser) && (
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage
                  src={notification.clientLogo || notification.createdByUser?.image || undefined}
                  alt={notification.clientName || notification.createdByUser?.name || "Notificación"}
                />
                <AvatarFallback>
                  {notification.clientName
                    ? notification.clientName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)
                    : notification.createdByUser
                    ? notification.createdByUser.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)
                    : "N"}
                </AvatarFallback>
              </Avatar>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
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
  );
}

