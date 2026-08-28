import { NextResponse } from 'next/server';
import { GoogleCalendarService } from '@/lib/google-calendar';
import { auth } from '@/auth';
import {
  GOOGLE_STATE_COOKIE,
  GOOGLE_VERIFIER_COOKIE,
  createPkcePair,
  createState,
  setOAuthCookie,
} from '@/lib/oauth-state';

export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Mismo mecanismo que /api/auth/google: state + PKCE en cookies httpOnly,
    // para que el callback pueda comprobar que la vuelta corresponde a este
    // navegador y a esta peticion.
    const state = createState();
    const { verifier, challenge } = createPkcePair();
    await setOAuthCookie(GOOGLE_STATE_COOKIE, state);
    await setOAuthCookie(GOOGLE_VERIFIER_COOKIE, verifier);

    const authUrl = GoogleCalendarService.getAuthUrl(state, challenge);
    
    return NextResponse.json({ 
      authUrl,
      message: 'URL de autorización generada correctamente'
    });
  } catch (error) {
    console.error('Error generando URL de autorización:', error);
    return NextResponse.json(
      { error: 'Error al generar URL de autorización' },
      { status: 500 }
    );
  }
}
