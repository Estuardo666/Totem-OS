import { NextRequest, NextResponse } from 'next/server';
import { GoogleCalendarService } from '@/lib/google-calendar';
import { auth } from '@/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const isConnected = await GoogleCalendarService.isConnected(session.user.id);
    
    return NextResponse.json({ 
      connected: isConnected,
      message: isConnected ? 'Google Calendar está conectado' : 'Google Calendar no está conectado'
    });
  } catch (error) {
    console.error('Error verificando estado de Google Calendar:', error);
    return NextResponse.json(
      { error: 'Error al verificar estado de Google Calendar' },
      { status: 500 }
    );
  }
}
