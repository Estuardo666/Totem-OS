import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { checkPermissions, exchangeCodeForToken, getFacebookUserInfo } from "@/lib/meta/auth-service";
import { saveAgencyToken } from "@/lib/meta/token-store";
import { META_STATE_COOKIE, clearOAuthCookies, readOAuthCookie, safeEqual } from "@/lib/oauth-state";
import type { IntegrationErrorCode } from "@/lib/integration-errors";

function redirectWithError(request: NextRequest, code: IntegrationErrorCode) {
  return NextResponse.redirect(
    new URL(`/admin/settings/integrations?error=${code}`, request.url)
  );
}

/**
 * API Route para recibir el callback de OAuth de Meta
 * GET /api/auth/callback/meta?code=XXX&error=XXX
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Verificar que el usuario esté autenticado (solo ADMIN: este token pasa
    //    a ser el de toda la agencia)
    const session = await auth();
    if (!session?.user) {
      return NextResponse.redirect(
        new URL("/auth/signin?error=Unauthorized", request.url)
      );
    }

    if (session.user.role !== "ADMIN") {
      return redirectWithError(request, "unauthorized");
    }

    // 2. Obtener parámetros de la query
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const errorReason = searchParams.get("error_reason");
    const errorDescription = searchParams.get("error_description");

    // 3. Manejar errores de autorización
    if (error) {
      console.error("Error en autorización de Meta:", {
        error,
        errorReason,
        errorDescription,
      });
      return redirectWithError(request, "provider_denied");
    }

    // 4. Validar que existe el código
    if (!code) {
      return redirectWithError(request, "missing_code");
    }

    // 4b. Validar el state contra la cookie: sin esto el callback aceptaria
    // cualquier codigo, permitiendo conectar la cuenta de Meta de un atacante
    // a la sesion de la victima.
    const returnedState = searchParams.get("state");
    const expectedState = await readOAuthCookie(META_STATE_COOKIE);
    await clearOAuthCookies(META_STATE_COOKIE);

    if (!safeEqual(returnedState ?? undefined, expectedState)) {
      console.error("[Meta OAuth] state invalido o ausente; se descarta el callback");
      return redirectWithError(request, "invalid_state");
    }

    // 5. Intercambiar código por token de larga duración
    let longLivedToken;
    try {
      longLivedToken = await exchangeCodeForToken(code);
    } catch (tokenError) {
      console.error("Error al intercambiar código por token:", tokenError);
      return redirectWithError(request, "token_exchange_failed");
    }

    // 6. Obtener información del usuario de Facebook
    let userInfo;
    try {
      userInfo = await getFacebookUserInfo(longLivedToken.access_token);
    } catch (userError) {
      console.error("Error al obtener información del usuario:", userError);
      return redirectWithError(request, "user_info_failed");
    }

    // 7. Calcular fecha de expiración del token
    const expiresIn = longLivedToken.expires_in && typeof longLivedToken.expires_in === 'number' ? longLivedToken.expires_in : 5184000; // 60 días por defecto
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);

    // 8. Registrar qué permisos otorgó realmente el usuario.
    //    Guardarlos deja que el dispatcher salte plataformas sin gastar una
    //    llamada fallida a Graph por cada cliente.
    let grantedScopes: string | null = null;
    try {
      const { permissions } = await checkPermissions(longLivedToken.access_token);
      grantedScopes = Object.entries(permissions)
        .filter(([, granted]) => granted)
        .map(([name]) => name)
        .join(",");
    } catch (permError) {
      // No aborta la conexión: el banner de permisos volverá a consultarlos
      // al abrir la página de integraciones.
      console.warn("No se pudieron leer los permisos otorgados:", permError);
    }

    // 9. Guardar el token cifrado en la base de datos
    try {
      await saveAgencyToken({
        facebookUserId: userInfo.id,
        name: userInfo.name,
        accessToken: longLivedToken.access_token,
        tokenExpiresAt: expiresAt,
        scopes: grantedScopes,
      });
    } catch (dbError) {
      console.error("Error al guardar token en la base de datos:", dbError);
      return redirectWithError(request, "save_failed");
    }

    // 9. Redirigir a la página de integraciones con éxito
    return NextResponse.redirect(
      new URL("/admin/settings/integrations?success=true", request.url)
    );
  } catch (error) {
    console.error("Error inesperado en callback de Meta:", error);
    return redirectWithError(request, "unexpected");
  }
}

