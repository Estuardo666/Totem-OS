import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/actions/user.actions";
import { getConnectedMetaAccount } from "@/actions/meta-actions";
import { ConnectMetaButton } from "@/components/features/admin/connect-meta-button";
import { DetectedPagesList } from "@/components/features/admin/detected-pages-list";
import { DisconnectMetaButton } from "@/components/features/admin/disconnect-meta-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";
import { PageHeader } from "@/components/shared";

async function IntegrationsContent() {
  const userResult = await getCurrentUser();

  if (!userResult.success || !userResult.data) {
    redirect("/sign-in");
  }

  const user = userResult.data;

  // Solo ADMIN puede ver esta página
  const userRole = user.roleLegacy;
  if (userRole !== "ADMIN") {
    redirect("/");
  }

  const metaAccountResult = await getConnectedMetaAccount();

  return (
    <div className="space-y-6 p-2 md:p-3">
      <PageHeader
        title="Integraciones"
        description="Conecta Totem OS con plataformas externas para automatizar tareas y sincronizar datos"
      />

      {/* Meta (Facebook & Instagram) Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>Meta (Facebook & Instagram)</span>
          </CardTitle>
          <CardDescription>
            Conecta tu cuenta de Facebook para gestionar páginas e Instagram Business automáticamente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!metaAccountResult.success || !metaAccountResult.data ? (
            <>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Conecta tu cuenta de Facebook para acceder a las páginas que gestionas y vincularlas
                  con los clientes de Totem OS. Esto permite leer métricas de forma automática sin que
                  caduque la sesión del usuario.
                </AlertDescription>
              </Alert>
              <ConnectMetaButton />
            </>
          ) : (
            <>
              {metaAccountResult.data.permissions?.missing &&
                metaAccountResult.data.permissions.missing.length > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-1">
                        <p className="font-semibold">Permisos faltantes:</p>
                        <ul className="list-disc list-inside text-sm space-y-1">
                          {metaAccountResult.data.permissions.missing.map((perm) => {
                            const permissionNames: Record<string, string> = {
                              public_profile: "Perfil público",
                              pages_show_list: "Ver páginas",
                              pages_read_engagement: "Leer comentarios/likes",
                              read_insights: "Leer métricas de Insights",
                            };
                            return (
                              <li key={perm}>
                                {permissionNames[perm] || perm}
                              </li>
                            );
                          })}
                        </ul>
                        <p className="text-sm mt-2">
                          Por favor, reconecta tu cuenta de Facebook y otorga todos los permisos necesarios.
                        </p>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              
              {/* Información de la cuenta conectada con botón de desvincular */}
              <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                <div>
                  <p className="font-medium">{metaAccountResult.data.name}</p>
                  <p className="text-sm text-muted-foreground">
                    ID: {metaAccountResult.data.facebookUserId}
                  </p>
                </div>
                <DisconnectMetaButton />
              </div>

              <DetectedPagesList metaAccount={metaAccountResult.data} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const params = await searchParams;
  const hasSuccess = params.success === "true";
  const error = params.error;

  return (
    <>
      {hasSuccess && (
        <div className="p-2 md:p-3 pb-0">
          <Alert className="bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              Conexión con Meta realizada exitosamente. Ahora puedes vincular páginas con tus clientes.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {error && (
        <div className="p-2 md:p-3 pb-0">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{decodeURIComponent(error)}</AlertDescription>
          </Alert>
        </div>
      )}

      <Suspense fallback={<div className="p-2 md:p-3">Cargando...</div>}>
        <IntegrationsContent />
      </Suspense>
    </>
  );
}

