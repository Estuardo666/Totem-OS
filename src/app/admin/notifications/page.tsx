import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getUserNotifications, markAllAsRead } from "@/actions/notification-actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bell } from "lucide-react";
import { NotificationsList } from "@/components/features/shared/notifications-list";
import { MarkAllAsReadButton } from "@/components/features/shared/mark-all-as-read-button";

export default async function AdminNotificationsPage() {
  // Verificar autenticación
  const session = await auth();

  if (!session) {
    redirect("/sign-in");
  }

  // Obtener todas las notificaciones del usuario
  const notificationsResult = await getUserNotifications();

  if (!notificationsResult.success || !notificationsResult.data) {
    return (
      <div className="container mx-auto py-6 px-4 md:px-6">
        <Card>
          <CardContent className="py-12">
            <p className="text-destructive text-center">
              {notificationsResult.error || "Error al cargar las notificaciones"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const notifications = notificationsResult.data;
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Notificaciones
              </h1>
              <p className="text-muted-foreground mt-1">
                Historial completo de tus notificaciones
              </p>
            </div>
          </div>
          {unreadCount > 0 && (
            <MarkAllAsReadButton />
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Historial de Notificaciones</CardTitle>
              <CardDescription>
                {notifications.length}{" "}
                {notifications.length === 1
                  ? "notificación"
                  : "notificaciones"}
                {unreadCount > 0 && (
                  <span className="ml-2 text-primary font-medium">
                    • {unreadCount} sin leer
                  </span>
                )}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <NotificationsList notifications={notifications} />
        </CardContent>
      </Card>
    </div>
  );
}

