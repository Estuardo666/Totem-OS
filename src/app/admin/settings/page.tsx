import { Suspense } from "react";
import { auth } from "@/auth";
import { AppearanceForm } from "@/components/features/settings/appearance-form";
import { NotificationSettings } from "@/components/features/settings/notification-settings";
import { AiConfigForm } from "@/components/features/admin/ai-config-form";
import { AssistantSettingsForm } from "@/components/features/admin/assistant-settings-form";
import { BrandingSettings } from "@/components/features/admin/branding-settings";
import { SessionControlSettings } from "@/components/features/admin/session-control-settings";
import { GoogleCalendarSettings } from "@/components/features/admin/google-calendar-settings";
import { GoogleCalendarSuccessToast } from "@/components/features/admin/google-calendar-success-toast";
import { SettingsSkeleton } from "@/components/features/settings/settings-skeleton";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { PushTestPanel } from "@/components/features/admin/push-test-panel";
import { SettingsShell, type SettingsPanel } from "@/components/features/settings/settings-shell";
import { AppPageHeader } from "@/components/shared/app-page-header";
import Link from "next/link";

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
      themeId: true,
      catppuccinAccent: true,
      soundNotifications: true,
    },
  });

  if (!user) {
    redirect("/sign-in");
  }

  if (user.roleLegacy !== "ADMIN") {
    redirect("/");
  }

  const panels: SettingsPanel[] = [
    {
      id: "appearance",
      group: "Personal",
      label: "Apariencia",
      description: "Tema, modo claro u oscuro y color de acento. Se guardan al instante.",
      content: (
        <AppearanceForm
          primaryColor={user.primaryColor || "#3b82f6"}
          darkMode={user.darkMode ?? false}
          themeId={user.themeId === "catppuccin" ? "catppuccin" : "default"}
          catppuccinAccent={user.catppuccinAccent || "mauve"}
        />
      ),
    },
    {
      id: "notifications",
      group: "Personal",
      label: "Notificaciones",
      description: "Cómo te avisa Totem OS dentro de la app y en tus dispositivos.",
      content: (
        <>
          <NotificationSettings soundNotifications={user.soundNotifications ?? true} />
          <PushTestPanel />
        </>
      ),
    },
    {
      id: "integrations",
      group: "Organización",
      label: "Integraciones",
      description: "Servicios externos conectados a la agencia.",
      content: (
        <>
          <GoogleCalendarSettings />
          <Link
            href="/admin/settings/integrations"
            className="flex items-center justify-between rounded-2xl bg-card px-5 py-4 text-sm font-medium transition-colors hover:bg-card/70"
          >
            Ver todas las integraciones
            <span className="text-muted-foreground" aria-hidden>›</span>
          </Link>
        </>
      ),
    },
    {
      id: "brand",
      group: "Organización",
      label: "Identidad de marca",
      description: "Logos y nombre que ven el equipo y los clientes.",
      content: <BrandingSettings />,
    },
    {
      id: "assistant",
      group: "Organización",
      label: "Asistente",
      description: "Voz, personalidad y comportamiento del asistente de IA.",
      content: <AssistantSettingsForm />,
    },
    {
      id: "ai",
      group: "Organización",
      label: "Modelos de IA",
      description: "Proveedor activo y claves de API. Las claves se guardan cifradas en el servidor.",
      content: <AiConfigForm />,
    },
    {
      id: "security",
      group: "Organización",
      label: "Seguridad",
      description: "Control de sesiones y acceso del equipo.",
      content: <SessionControlSettings />,
    },
  ];

  return (
    <div className="min-h-screen">
      <GoogleCalendarSuccessToast />
      <AppPageHeader title="Configuración" description="Preferencias personales y de la agencia" maxWidth="max-w-6xl" />
      <SettingsShell panels={panels} />
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

