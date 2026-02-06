import { NextRequest, NextResponse } from 'next/server';
import { GoogleCalendarService } from '@/lib/google-calendar';
import { auth } from '@/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      console.warn("[Google Calendar] No hay sesión activa");
      // Devolver desconectado en lugar de 401 para no romper la UI
      return NextResponse.json({ 
        connected: false,
        message: 'Usuario no autenticado'
      });
    }

    const isConnected = await GoogleCalendarService.isConnected(session.user.id);
    
    return NextResponse.json({ 
      connected: isConnected,
      message: isConnected ? 'Google Calendar está conectado' : 'Google Calendar no está conectado'
    });
  } catch (error) {
    console.error('Error verificando estado de Google Calendar:', error);
    // No fallar con 500, devolver desconectado
    return NextResponse.json(
      { 
        connected: false,
        message: 'No se pudo verificar el estado'
      }
    );
  }
}
