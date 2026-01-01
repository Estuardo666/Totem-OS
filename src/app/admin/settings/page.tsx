import { Suspense } from "react";
import { getCurrentUser } from "@/actions/user.actions";
import { AppearanceForm } from "@/components/features/settings/appearance-form";
import { NotificationSettings } from "@/components/features/settings/notification-settings";
import { AiConfigForm } from "@/components/features/admin/ai-config-form";
import { BrandingSettings } from "@/components/features/admin/branding-settings";
import { SettingsSkeleton } from "@/components/features/settings/settings-skeleton";
import { redirect } from "next/navigation";

async function SettingsContent() {
  const result = await getCurrentUser();

  if (!result.success || !result.data) {
    redirect("/sign-in");
  }

  const user = result.data;

  return (
    <div className="space-y-6 p-4 md:p-6">
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
      </div>

      {/* Configuración de IA - Solo para ADMIN */}
      {user.role === "ADMIN" && (
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

