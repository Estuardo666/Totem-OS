import { Suspense } from "react";
import { auth } from "@/auth";
import { AppearanceForm } from "@/components/features/settings/appearance-form";
import { NotificationSettings } from "@/components/features/settings/notification-settings";
import { AiConfigForm } from "@/components/features/admin/ai-config-form";
import { BrandingSettings } from "@/components/features/admin/branding-settings";
import { GoogleCalendarSettings } from "@/components/features/admin/google-calendar-settings";
import { GoogleCalendarSuccessToast } from "@/components/features/admin/google-calendar-success-toast";
import { SettingsSkeleton } from "@/components/features/settings/settings-skeleton";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

async function SettingsContent() {
  // ✅ Verificar sesión PRIMERO (antes de cualquier otra lógica)
  const session = await auth();

  // ✅ Redirect ANTES de cualquier llamada a Prisma
  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  // ✅ Obtener datos del usuario desde la BD
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      roleLegacy: true,
      primaryColor: true,
      darkMode: true,
      soundNotifications: true,
    },
  });

  // ✅ Verificar usuario después de la query
  if (!user) {
    redirect("/sign-in");
  }

  // ✅ Verificar rol de ADMIN para acceder a configuración de admin
  if (user.roleLegacy !== "ADMIN") {
    redirect("/");
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <GoogleCalendarSuccessToast />
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Personaliza tu experiencia en Totem OS
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <AppearanceForm
          primaryColor={user.primaryColor || "#2563eb"}
          darkMode={user.darkMode ?? false}
        />
        <NotificationSettings
          soundNotifications={user.soundNotifications ?? true}
        />
        <GoogleCalendarSettings />
      </div>

      {/* Configuración de IA - Solo para ADMIN */}
      {user.roleLegacy === "ADMIN" && (
        <div className="mt-6 space-y-6">
          <BrandingSettings />
          <AiConfigForm />
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsSkeleton />}>
      <SettingsContent />
    </Suspense>
  );
}

