import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { exchangeTikTokCodeForToken } from "@/lib/tiktok/auth-service";
import { fetchTikTokProfileStats } from "@/lib/tiktok/metrics-service";
import { saveTikTokToken } from "@/lib/tiktok/token-store";
import {
  TIKTOK_STATE_COOKIE,
  clearOAuthCookies,
  readOAuthCookie,
  safeEqual,
} from "@/lib/oauth-state";
import type { IntegrationErrorCode } from "@/lib/integration-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SETTINGS = "/admin/settings/integrations";

function redirectWithError(request: NextRequest, code: IntegrationErrorCode) {
  return NextResponse.redirect(
    new URL(`${SETTINGS}?error=${code}`, request.url)
  );
}

/**
 * Callback de OAuth de TikTok.
 * GET /api/auth/callback/tiktok?code=...&state=...
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Solo un administrador puede conectar cuentas de la agencia.
    const session = await auth();
    if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "EDITOR")) {
      return redirectWithError(request, "unauthorized");
    }

    const params = request.nextUrl.searchParams;

    // 2. TikTok informa el rechazo del usuario por querystring, no por error HTTP.
    const oauthError = params.get("error");
    if (oauthError) {
      return redirectWithError(request, "provider_denied");
    }

    const code = params.get("code");
    const state = params.get("state");
    if (!code) {
      return redirectWithError(request, "missing_code");
    }

    // 3. Validar el state contra la cookie httpOnly: sin esto, el callback
    //    aceptaría cualquier código y se podría dejar conectada una cuenta ajena.
    const expectedState = await readOAuthCookie(TIKTOK_STATE_COOKIE);
    if (!safeEqual(state ?? undefined, expectedState)) {
      await clearOAuthCookies(TIKTOK_STATE_COOKIE);
      return redirectWithError(request, "invalid_state");
    }
    await clearOAuthCookies(TIKTOK_STATE_COOKIE);

    // 4. Canjear el código por los tokens.
    const token = await exchangeTikTokCodeForToken(code);

    // 5. Leer el perfil para tener un nombre legible que mostrar.
    let displayName = token.open_id;
    try {
      const profile = await fetchTikTokProfileStats(token.access_token);
      if (profile.displayName) displayName = profile.displayName;
    } catch (profileError) {
      // No aborta la conexión: el nombre es cosmético y se corrige al sincronizar.
      console.warn("No se pudo leer el perfil de TikTok:", profileError);
    }

    await saveTikTokToken(token, displayName);

    return NextResponse.redirect(new URL(`${SETTINGS}?success=tiktok`, request.url));
  } catch (error) {
    console.error("Error en el callback de TikTok:", error);
    return redirectWithError(request, "unexpected");
  }
}
