import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SmartTimer } from "@/components/features/chronos/smart-timer";
import { TimeStatsClient } from "@/components/features/chronos/time-stats-client";
import { PageHeader } from "@/components/shared";

export default async function ChronosPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/api/auth/signin");
  }

  return (
      <div className="container mx-auto py-3 px-2 md:px-3 space-y-6">
      <PageHeader
        title="Totem Chronos"
        description="Control de tiempo, cálculo de salario y estadísticas de productividad"
      />

      {/* Timer Principal */}
      <SmartTimer />

      {/* Estadísticas */}
      <TimeStatsClient userId={session.user.id} />
    </div>
  );
}
