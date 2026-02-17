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

  // Verificar rol de ADMIN
  if (session.user.roleLegacy !== "ADMIN") {
    redirect("/");
  }

  // Obtener todas las notificaciones del usuario
  const notificationsResult = await getUserNotifications();

  if (!notificationsResult.success || !notificationsResult.data) {
    return (
      <div className="min-h-screen bg-muted/30">
        <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg flex-shrink-0">
                <Bell className="h-5 w-5 text-white" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-xl font-bold text-foreground dark:text-white line-clamp-1">
                  Notificaciones
                </h1>
                <p className="text-xs text-muted-foreground line-clamp-1">
                  Historial completo de tus notificaciones
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 pt-6 pb-6">
          <Card>
            <CardContent className="py-12">
              <p className="text-destructive text-center">
                {notificationsResult.error || "Error al cargar las notificaciones"}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const notifications = notificationsResult.data;
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg flex-shrink-0">
              <Bell className="h-5 w-5 text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold text-foreground dark:text-white line-clamp-1">
                Notificaciones
              </h1>
              <p className="text-xs text-muted-foreground line-clamp-1">
                Historial completo de tus notificaciones
              </p>
            </div>
          </div>
          {unreadCount > 0 && <MarkAllAsReadButton />}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pt-6 pb-6">
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
    </div>
  );
}

