import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getFinanceSettings } from "@/actions/finance-settings-actions";
import { getUsers } from "@/actions/user.actions";
import { FinanceSettingsForm } from "@/components/features/finance/finance-settings-form";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared";

export default async function FinanceSettingsPage() {
  const session = await auth();

  if (!session) {
    redirect("/sign-in");
  }

  if (session.user.role !== "ADMIN") {
    return (
      <div className="container mx-auto p-3">
        <PageHeader
          title="Configuración financiera"
          description="Define reglas internas de cupos, categorías controladas y analítica opcional."
        />
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-destructive">No tienes permisos para ver la configuración financiera.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [settingsResult, usersResult] = await Promise.all([
    getFinanceSettings(),
    getUsers(),
  ]);

  if (!settingsResult.success || !settingsResult.data || !usersResult.success || !usersResult.data) {
    return (
      <div className="container mx-auto p-3">
        <PageHeader
          title="Configuración financiera"
          description="Define reglas internas de cupos, categorías controladas y analítica opcional."
        />
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-destructive">
              {settingsResult.error || usersResult.error || "No se pudo cargar la configuración financiera."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const adminUsers = usersResult.data.filter((user) => {
    const roleLegacy = (user as Record<string, unknown>).roleLegacy;
    const role = (user as Record<string, unknown>).role;

    return roleLegacy === "ADMIN" || role === "ADMIN";
  });

  return (
    <div className="container mx-auto space-y-6 p-3">
      <PageHeader
        title="Configuración financiera"
        description="Administra cupos mensuales, categorías monitoreadas y analítica privada entre usuarios."
      />
      <FinanceSettingsForm initialSettings={settingsResult.data} adminUsers={adminUsers} />
    </div>
  );
}
