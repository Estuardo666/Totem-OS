import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { getTikTokConnection } from "@/actions/tiktok-actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConnectTikTokButton } from "./connect-tiktok-button";
import { DisconnectTikTokButton } from "./disconnect-tiktok-button";
import { TestTikTokButton } from "./test-tiktok-button";

/**
 * Tarjeta de la integración de TikTok.
 *
 * Distingue tres estados que conviene no mezclar:
 *   sin configurar  → faltan las claves de la app; lo resuelve un administrador
 *   sin conectar    → hay claves, falta autorizar el perfil
 *   conectado       → muestra vencimientos y permite probar la conexión
 */
export async function TikTokIntegrationCard() {
  const result = await getTikTokConnection();

  if (!result.success || !result.data) {
    return null;
  }

  const { configured, connected, displayName, tokenExpiresAt, refreshExpiresAt, needsReconnect, scopes } =
    result.data;

  const formatDate = (date: Date | null) =>
    date
      ? new Intl.DateTimeFormat("es-EC", { dateStyle: "long", timeStyle: "short" }).format(
          new Date(date)
        )
      : "—";

  return (
    <Card>
      <CardHeader>
        <CardTitle>TikTok</CardTitle>
        <CardDescription>
          Conecta un perfil de TikTok para leer seguidores, visualizaciones e interacciones de
          forma automática.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {!configured ? (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-semibold">Falta configurar las claves de la app</p>
                <p className="text-sm">
                  Registra la app en{" "}
                  <a
                    href="https://developers.tiktok.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    developers.tiktok.com
                  </a>{" "}
                  con los productos <strong>Login Kit</strong> y <strong>Display API</strong>,
                  agrega la URL de retorno{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">
                    /api/auth/callback/tiktok
                  </code>{" "}
                  y solicita estos permisos:
                </p>
                <ul className="list-inside list-disc text-sm">
                  {scopes.map((scope) => (
                    <li key={scope}>
                      <code className="text-xs">{scope}</code>
                    </li>
                  ))}
                </ul>
                <p className="text-sm">
                  Después carga <code className="text-xs">TIKTOK_CLIENT_KEY</code> y{" "}
                  <code className="text-xs">TIKTOK_CLIENT_SECRET</code> en las variables de
                  entorno.
                </p>
              </div>
            </AlertDescription>
          </Alert>
        ) : !connected ? (
          <>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Se pedirán permisos de solo lectura. Totem no puede publicar ni borrar contenido
                en TikTok.
              </AlertDescription>
            </Alert>
            <ConnectTikTokButton />
          </>
        ) : (
          <>
            {needsReconnect && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-semibold">La renovación del token falló</p>
                    <p className="text-sm">
                      Vuelve a conectar la cuenta para seguir sincronizando métricas de TikTok.
                    </p>
                    <ConnectTikTokButton label="Reconectar TikTok" />
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                Cuenta conectada: <strong>{displayName}</strong>
              </AlertDescription>
            </Alert>

            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Token de acceso vence</dt>
                {/* Dura 24 h y se renueva solo antes de cada consulta. */}
                <dd>{formatDate(tokenExpiresAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Autorización vence</dt>
                {/* A los 365 días hay que volver a autorizar a mano. */}
                <dd>{formatDate(refreshExpiresAt)}</dd>
              </div>
            </dl>

            <div className="flex flex-wrap items-center gap-2">
              <TestTikTokButton />
              <DisconnectTikTokButton />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
