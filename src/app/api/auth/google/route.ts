import { NextRequest, NextResponse } from 'next/server';
import { GoogleCalendarService } from '@/lib/google-calendar';
import { auth } from '@/auth';
import {
  GOOGLE_STATE_COOKIE,
  GOOGLE_VERIFIER_COOKIE,
  clearOAuthCookies,
  createPkcePair,
  createState,
  readOAuthCookie,
  safeEqual,
  setOAuthCookie,
} from '@/lib/oauth-state';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      console.error('Error en OAuth de Google:', error);
      return NextResponse.redirect(
        new URL('/admin/settings?error=google_oauth_error', request.url)
      );
    }

    if (!code) {
      // Inicio del flujo: se genera un state y un par PKCE, se guardan en
      // cookies httpOnly y se envian al proveedor. Al volver se comprueba que
      // el callback corresponde a este mismo navegador y a esta peticion.
      const state = createState();
      const { verifier, challenge } = createPkcePair();
      await setOAuthCookie(GOOGLE_STATE_COOKIE, state);
      await setOAuthCookie(GOOGLE_VERIFIER_COOKIE, verifier);

      const authUrl = GoogleCalendarService.getAuthUrl(state, challenge);
      return NextResponse.redirect(authUrl);
    }

    // Vuelta del proveedor: el state recibido debe coincidir con la cookie.
    const returnedState = searchParams.get('state');
    const expectedState = await readOAuthCookie(GOOGLE_STATE_COOKIE);
    const codeVerifier = await readOAuthCookie(GOOGLE_VERIFIER_COOKIE);
    await clearOAuthCookies(GOOGLE_STATE_COOKIE, GOOGLE_VERIFIER_COOKIE);

    if (!safeEqual(returnedState ?? undefined, expectedState) || !codeVerifier) {
      console.error('[Google OAuth] state invalido o ausente; se descarta el callback');
      return NextResponse.redirect(
        new URL('/admin/settings?error=google_oauth_state', request.url)
      );
    }

    // Intercambiar código por tokens
    const tokens = await GoogleCalendarService.exchangeCodeForTokens(code, codeVerifier);
    
    // Guardar tokens en la base de datos
    await GoogleCalendarService.saveTokens(session.user.id, tokens);

    // Registrar webhook channel para sync bidireccional
    try {
      const webhookBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || request.nextUrl.origin;
      const webhookUrl = `${webhookBaseUrl}/api/google-calendar/webhook`;
      const secretToken = process.env.GOOGLE_CALENDAR_WEBHOOK_SECRET;
      if (!secretToken) {
        // Sin secreto no se registra el canal: un webhook sin token no se
        // puede verificar y aceptaria notificaciones de cualquier origen.
        throw new Error("Falta GOOGLE_CALENDAR_WEBHOOK_SECRET: no se registra el webhook.");
      }
      await GoogleCalendarService.registerWebhookChannel(session.user.id, webhookUrl, secretToken);
    } catch (webhookError) {
      // Don't fail the connection if webhook registration fails
      console.error('Error registrando webhook channel:', webhookError);
    }

    // Redirigir a settings con éxito
    return NextResponse.redirect(
      new URL('/admin/settings?success=google_calendar_connected', request.url)
    );
  } catch (error) {
    console.error('Error en OAuth de Google:', error);
    return NextResponse.redirect(
      new URL('/admin/settings?error=google_calendar_failed', request.url)
    );
  }
}
