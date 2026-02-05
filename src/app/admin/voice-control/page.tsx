import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { VoiceControlPanel } from "@/components/features/admin/voice-control/voice-control-panel";
import { db } from "@/lib/db";

export default async function VoiceControlPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  if (session.user.roleLegacy !== "ADMIN") {
    redirect("/");
  }

  const clients = await db.client.findMany({
    select: {
      id: true,
      name: true,
      logo: true,
      color: true,
    },
    orderBy: { name: "asc" },
  });

  const users = await db.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      createdAt: true,
      updatedAt: true,
      firstName: true,
      lastName: true,
      emailVerified: true,
      roleLegacy: true,
      primaryColor: true,
      darkMode: true,
      soundNotifications: true,
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Control por voz (beta)</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Habla, transcribe y deja que la IA sugiera tareas o rodajes. Los resultados se
          generan solo en esta pantalla.
        </p>
      </div>
      <VoiceControlPanel clients={clients} users={users as any} />
    </div>
  );
}
