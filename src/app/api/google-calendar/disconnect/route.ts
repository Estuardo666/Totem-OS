import { NextRequest, NextResponse } from 'next/server';
import { GoogleCalendarService } from '@/lib/google-calendar';
import { auth } from '@/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    await GoogleCalendarService.disconnect(session.user.id);
    
    return NextResponse.json({ 
      message: 'Google Calendar desconectado correctamente'
    });
  } catch (error) {
    console.error('Error desconectando Google Calendar:', error);
    return NextResponse.json(
      { error: 'Error al desconectar Google Calendar' },
      { status: 500 }
    );
  }
}
