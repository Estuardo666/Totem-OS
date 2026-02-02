import { NextRequest, NextResponse } from 'next/server';
import { GoogleCalendarService } from '@/lib/google-calendar';
import { auth } from '@/auth';

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
      // Si no hay código, redirigir a la autorización
      const authUrl = GoogleCalendarService.getAuthUrl();
      return NextResponse.redirect(authUrl);
    }

    // Intercambiar código por tokens
    const tokens = await GoogleCalendarService.exchangeCodeForTokens(code);
    
    // Guardar tokens en la base de datos
    await GoogleCalendarService.saveTokens(session.user.id, tokens);

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
