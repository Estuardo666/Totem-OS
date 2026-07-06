import { Suspense } from "react";
import { auth } from "@/auth";
import { AppearanceForm } from "@/components/features/settings/appearance-form";
import { NotificationSettings } from "@/components/features/settings/notification-settings";
import { AiConfigForm } from "@/components/features/admin/ai-config-form";
import { BrandingSettings } from "@/components/features/admin/branding-settings";
import { SessionControlSettings } from "@/components/features/admin/session-control-settings";
import { GoogleCalendarSettings } from "@/components/features/admin/google-calendar-settings";
import { GoogleCalendarSuccessToast } from "@/components/features/admin/google-calendar-success-toast";
import { SettingsSkeleton } from "@/components/features/settings/settings-skeleton";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Settings, Palette, Bell, Link2, Sparkles, Shield } from "lucide-react";
import { PushTestPanel } from "@/components/features/admin/push-test-panel";

async function SettingsContent() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

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

  if (!user) {
    redirect("/sign-in");
  }

  if (user.roleLegacy !== "ADMIN") {
    redirect("/");
  }

  const isAdmin = user.roleLegacy === "ADMIN";

  return (
    <div className="min-h-screen bg-muted/30">
      <GoogleCalendarSuccessToast />
      
      {/* Header iOS-style */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
              <Settings className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Configuración</h1>
              <p className="text-xs text-muted-foreground">Personaliza tu experiencia</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        {/* SECCIÓN: Apariencia y Preferencias */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Palette className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Apariencia y Preferencias
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <AppearanceForm
              primaryColor={user.primaryColor || "#2563eb"}
              darkMode={user.darkMode ?? false}
            />
            <NotificationSettings
              soundNotifications={user.soundNotifications ?? true}
            />
          </div>
        </section>

        {/* SECCIÓN: Integraciones */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Link2 className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Integraciones
            </h2>
          </div>
          <GoogleCalendarSettings />
        </section>

        {/* SECCIÓN: Identidad de Marca (Solo Admin) */}
        {isAdmin && (
          <section className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Identidad de Marca
              </h2>
            </div>
            <BrandingSettings />
          </section>
        )}

        {/* SECCIÓN: Inteligencia Artificial (Solo Admin) */}
        {isAdmin && (
          <section className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Inteligencia Artificial
              </h2>
            </div>
            <AiConfigForm />
          </section>
        )}

        {/* SECCIÓN: Notificaciones Push (Solo Admin) */}
        {isAdmin && (
          <section className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Notificaciones Push
              </h2>
            </div>
            <PushTestPanel />
          </section>
        )}

        {/* SECCIÓN: Seguridad y Control (Solo Admin) */}
        {isAdmin && (
          <section className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Seguridad y Control
              </h2>
            </div>
            <SessionControlSettings />
          </section>
        )}

        {/* Spacer para scroll */}
        <div className="h-8" />
      </div>
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

