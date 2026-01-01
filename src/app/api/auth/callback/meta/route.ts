import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { exchangeCodeForToken, getFacebookUserInfo } from "@/lib/meta/auth-service";
import { db } from "@/lib/db";

/**
 * API Route para recibir el callback de OAuth de Meta
 * GET /api/auth/callback/meta?code=XXX&error=XXX
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Verificar que el usuario esté autenticado (solo ADMIN y EDITOR)
    const session = await auth();
    if (!session?.user) {
      return NextResponse.redirect(
        new URL("/auth/signin?error=Unauthorized", request.url)
      );
    }

    if (session.user.role !== "ADMIN" && session.user.role !== "EDITOR") {
      return NextResponse.redirect(
        new URL("/admin/settings/integrations?error=Unauthorized", request.url)
      );
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
      return NextResponse.redirect(
        new URL(
          `/admin/settings/integrations?error=${encodeURIComponent(
            errorDescription || errorReason || "Error al autorizar con Meta"
          )}`,
          request.url
        )
      );
    }

    // 4. Validar que existe el código
    if (!code) {
      return NextResponse.redirect(
        new URL(
          "/admin/settings/integrations?error=" + encodeURIComponent("Código de autorización no recibido"),
          request.url
        )
      );
    }

    // 5. Intercambiar código por token de larga duración
    let longLivedToken;
    try {
      longLivedToken = await exchangeCodeForToken(code);
    } catch (tokenError) {
      console.error("Error al intercambiar código por token:", tokenError);
      return NextResponse.redirect(
        new URL(
          `/admin/settings/integrations?error=${encodeURIComponent(
            tokenError instanceof Error ? tokenError.message : "Error al obtener token"
          )}`,
          request.url
        )
      );
    }

    // 6. Obtener información del usuario de Facebook
    let userInfo;
    try {
      userInfo = await getFacebookUserInfo(longLivedToken.access_token);
    } catch (userError) {
      console.error("Error al obtener información del usuario:", userError);
      return NextResponse.redirect(
        new URL(
          `/admin/settings/integrations?error=${encodeURIComponent(
            userError instanceof Error ? userError.message : "Error al obtener información del usuario"
          )}`,
          request.url
        )
      );
    }

    // 7. Calcular fecha de expiración del token
    const expiresIn = longLivedToken.expires_in && typeof longLivedToken.expires_in === 'number' ? longLivedToken.expires_in : 5184000; // 60 días por defecto
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);

    // 8. Guardar o actualizar el token en la base de datos
    try {
      await db.agencyMetaAccount.upsert({
        where: {
          facebookUserId: userInfo.id,
        },
        update: {
          name: userInfo.name,
          accessToken: longLivedToken.access_token,
          tokenExpiresAt: expiresAt,
          updatedAt: new Date(),
        },
        create: {
          facebookUserId: userInfo.id,
          name: userInfo.name,
          accessToken: longLivedToken.access_token,
          tokenExpiresAt: expiresAt,
        },
      });
    } catch (dbError) {
      console.error("Error al guardar token en la base de datos:", dbError);
      return NextResponse.redirect(
        new URL(
          "/admin/settings/integrations?error=" + encodeURIComponent("Error al guardar la conexión"),
          request.url
        )
      );
    }

    // 9. Redirigir a la página de integraciones con éxito
    return NextResponse.redirect(
      new URL("/admin/settings/integrations?success=true", request.url)
    );
  } catch (error) {
    console.error("Error inesperado en callback de Meta:", error);
    return NextResponse.redirect(
      new URL(
        `/admin/settings/integrations?error=${encodeURIComponent(
          error instanceof Error ? error.message : "Error inesperado"
        )}`,
        request.url
      )
    );
  }
}

