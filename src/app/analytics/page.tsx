import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { resolveRoleCode } from "@/lib/roles";
import { getAgencyAnalytics } from "@/actions/metrics-actions";
import { AgencyAnalyticsPanel } from "@/components/features/analytics/agency-analytics-panel";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

/**
 * Panel global de analítica.
 *
 * Solo ADMIN: cruza tarifas con desempeño de toda la cartera, que no es
 * información para el resto del equipo. La acción vuelve a comprobar el rol —
 * esta guarda es para la navegación, no la única defensa.
 */
export default async function AgencyAnalyticsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  if (resolveRoleCode(session.user) !== "ADMIN") redirect("/");

  const result = await getAgencyAnalytics(28);

  if (!result.success || !result.data) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {result.error ?? "No se pudo cargar la analítica de agencia."}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <AgencyAnalyticsPanel initial={result.data} />
    </div>
  );
}
