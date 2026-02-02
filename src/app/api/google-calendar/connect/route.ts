import { NextResponse } from 'next/server';
import { GoogleCalendarService } from '@/lib/google-calendar';
import { auth } from '@/auth';

export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const authUrl = GoogleCalendarService.getAuthUrl();
    
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
