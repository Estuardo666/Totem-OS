import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getUserNotifications, markAllAsRead } from "@/actions/notification-actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { NotificationsList } from "@/components/features/shared/notifications-list";
import { MarkAllAsReadButton } from "@/components/features/shared/mark-all-as-read-button";
import { AppPageHeader } from "@/components/shared/app-page-header";

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
        <AppPageHeader title="Notificaciones" description="Historial completo de tus notificaciones" />
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
      <AppPageHeader title="Notificaciones" description="Historial completo de tus notificaciones" />

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

