import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SmartTimer } from "@/components/features/chronos/smart-timer";
import { TimeStats } from "@/components/features/chronos/time-stats";

export default async function ChronosPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/api/auth/signin");
  }

  return (
    <div className="container mx-auto py-6 px-4 md:px-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Totem Chronos</h1>
        <p className="text-muted-foreground">
          Control de tiempo, cálculo de salario y estadísticas de productividad
        </p>
      </div>

      {/* Timer Principal */}
      <SmartTimer />

      {/* Estadísticas */}
      <TimeStats userId={session.user.id} />
    </div>
  );
}
