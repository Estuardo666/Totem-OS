import { google } from 'googleapis';
import { db } from '@/lib/db';

const googleCalendarToken = (db as any).googleCalendarToken;

const getGoogleApiErrorMessage = (error: unknown, fallback: string) => {
  const apiMessage = (error as any)?.response?.data?.error?.message;
  if (apiMessage && typeof apiMessage === "string") {
    return apiMessage;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
};

export interface CalendarEventInput {
  title: string;
  startTime: Date;
  endTime: Date;
  address?: string;
  mapLink?: string;
  notes?: string;
  client: { name: string; emails?: string[] };
  crew: Array<{ name: string; email: string }>;
}

export interface GoogleCalendarEvent {
  id: string;
  htmlLink: string;
  status: string;
}

export class GoogleCalendarService {
  private static oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  /**
   * Obtiene la URL de autorización para Google Calendar
   */
  static getAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent', // Forzar refresh token
    });
  }

  /**
   * Intercambia el código de autorización por tokens
   */
  static async exchangeCodeForTokens(code: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    scope: string;
  }> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      
      if (!tokens.access_token || !tokens.refresh_token) {
        throw new Error('No se pudieron obtener los tokens necesarios');
      }

      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresIn: tokens.expiry_date ? Math.floor((tokens.expiry_date - Date.now()) / 1000) : 3600,
        scope: tokens.scope || 'https://www.googleapis.com/auth/calendar'
      };
    } catch (error) {
      console.error('Error intercambiando código por tokens:', error);
      throw new Error('Error al obtener tokens de Google Calendar');
    }
  }

  /**
   * Guarda los tokens en la base de datos
   */
  static async saveTokens(userId: string, tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    scope: string;
  }): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokens.expiresIn);

    await googleCalendarToken.upsert({
      where: { userId },
      update: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt,
        scope: tokens.scope,
      },
      create: {
        userId,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt,
        scope: tokens.scope,
      },
    });
  }

  /**
   * Obtiene un cliente autenticado para un usuario
   */
  static async getAuthenticatedClient(userId: string) {
    const token = await googleCalendarToken.findUnique({
      where: { userId },
    });

    if (!token) {
      throw new Error('Usuario no tiene Google Calendar conectado');
    }

    // Verificar si el token ha expirado y refresh si es necesario
    if (token.expiresAt < new Date()) {
      await this.refreshToken(userId);
      const refreshedToken = await googleCalendarToken.findUnique({
        where: { userId },
      });
      
      if (!refreshedToken) {
        throw new Error('No se pudo refrescar el token');
      }
      
      token.accessToken = refreshedToken.accessToken;
    }

    this.oauth2Client.setCredentials({
      access_token: token.accessToken,
      refresh_token: token.refreshToken,
    });

    return this.oauth2Client;
  }

  /**
   * Refresca el token de acceso
   */
  static async refreshToken(userId: string): Promise<void> {
    const token = await googleCalendarToken.findUnique({
      where: { userId },
    });

    if (!token) {
      throw new Error('Token no encontrado');
    }

    try {
      this.oauth2Client.setCredentials({
        refresh_token: token.refreshToken,
      });

      const { credentials } = await this.oauth2Client.refreshAccessToken();
      
      if (!credentials.access_token) {
        throw new Error('No se pudo refrescar el access token');
      }

      const expiresAt = new Date();
      if (credentials.expiry_date) {
        expiresAt.setTime(credentials.expiry_date);
      } else {
        expiresAt.setHours(expiresAt.getHours() + 1);
      }

      await googleCalendarToken.update({
        where: { userId },
        data: {
          accessToken: credentials.access_token,
          expiresAt,
        },
      });
    } catch (error) {
      console.error('Error refrescando token:', error);
      throw new Error('Error al refrescar el token de Google Calendar');
    }
  }

  /**
   * Crea un evento en Google Calendar para un rodaje
   */
  static async createEvent(
    userId: string,
    shootData: CalendarEventInput
  ): Promise<GoogleCalendarEvent> {
    try {
      const auth = await this.getAuthenticatedClient(userId);
      const calendar = google.calendar({ version: 'v3', auth });

      // Preparar attendees
      const attendees: Array<{ email: string; displayName?: string }> = [];
      
      // Agregar emails del cliente si existen
      (shootData.client.emails || []).forEach((email) => {
        attendees.push({
          email,
          displayName: shootData.client.name,
        });
      });

      // Agregar emails del crew
      shootData.crew.forEach(crewMember => {
        attendees.push({
          email: crewMember.email,
          displayName: crewMember.name,
        });
      });

      // Crear descripción del evento
      const description = [
        `Rodaje: ${shootData.title}`,
        `Cliente: ${shootData.client.name}`,
        shootData.address ? `Dirección: ${shootData.address}` : '',
        shootData.notes ? `Notas: ${shootData.notes}` : '',
        shootData.mapLink ? `Maps: ${shootData.mapLink}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      const event = {
        summary: `Rodaje: ${shootData.title} - ${shootData.client.name}`,
        description,
        location: shootData.address || undefined,
        start: {
          dateTime: shootData.startTime.toISOString(),
          timeZone: 'America/Guayaquil', // Zona horaria de Ecuador
        },
        end: {
          dateTime: shootData.endTime.toISOString(),
          timeZone: 'America/Guayaquil',
        },
        attendees: attendees.length > 0 ? attendees : undefined,
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, // 1 día antes
            { method: 'popup', minutes: 30 }, // 30 minutos antes
          ],
        },
      };

      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
        sendUpdates: 'all', // Enviar invitaciones a todos los attendees
      });

      if (!response.data.id || !response.data.htmlLink) {
        throw new Error('No se pudo crear el evento correctamente');
      }

      return {
        id: response.data.id,
        htmlLink: response.data.htmlLink,
        status: response.data.status || 'confirmed',
      };
    } catch (error) {
      const message = getGoogleApiErrorMessage(
        error,
        'Error al crear evento en Google Calendar'
      );
      console.error('Error creando evento en Google Calendar:', error);
      throw new Error(message);
    }
  }

  /**
   * Actualiza un evento existente
   */
  static async updateEvent(
    userId: string,
    eventId: string,
    shootData: CalendarEventInput
  ): Promise<GoogleCalendarEvent> {
    try {
      const auth = await this.getAuthenticatedClient(userId);
      const calendar = google.calendar({ version: 'v3', auth });

      // Preparar attendees (misma lógica que createEvent)
      const attendees: Array<{ email: string; displayName?: string }> = [];
      
      (shootData.client.emails || []).forEach((email) => {
        attendees.push({
          email,
          displayName: shootData.client.name,
        });
      });

      shootData.crew.forEach(crewMember => {
        attendees.push({
          email: crewMember.email,
          displayName: crewMember.name,
        });
      });

      const description = [
        `Rodaje: ${shootData.title}`,
        `Cliente: ${shootData.client.name}`,
        shootData.address ? `Dirección: ${shootData.address}` : '',
        shootData.notes ? `Notas: ${shootData.notes}` : '',
        shootData.mapLink ? `Maps: ${shootData.mapLink}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      const event = {
        summary: `Rodaje: ${shootData.title} - ${shootData.client.name}`,
        description,
        location: shootData.address || undefined,
        start: {
          dateTime: shootData.startTime.toISOString(),
          timeZone: 'America/Guayaquil',
        },
        end: {
          dateTime: shootData.endTime.toISOString(),
          timeZone: 'America/Guayaquil',
        },
        attendees: attendees.length > 0 ? attendees : undefined,
      };

      const response = await calendar.events.patch({
        calendarId: 'primary',
        eventId,
        requestBody: event,
        sendUpdates: 'all',
      });

      if (!response.data.id || !response.data.htmlLink) {
        throw new Error('No se pudo actualizar el evento correctamente');
      }

      return {
        id: response.data.id,
        htmlLink: response.data.htmlLink,
        status: response.data.status || 'confirmed',
      };
    } catch (error) {
      const message = getGoogleApiErrorMessage(
        error,
        'Error al actualizar evento en Google Calendar'
      );
      console.error('Error actualizando evento en Google Calendar:', error);
      throw new Error(message);
    }
  }

  /**
   * Elimina un evento
   */
  static async deleteEvent(userId: string, eventId: string): Promise<void> {
    try {
      const auth = await this.getAuthenticatedClient(userId);
      const calendar = google.calendar({ version: 'v3', auth });

      await calendar.events.delete({
        calendarId: 'primary',
        eventId,
      });
    } catch (error) {
      console.error('Error eliminando evento en Google Calendar:', error);
      throw new Error('Error al eliminar evento en Google Calendar');
    }
  }

  /**
   * Verifica si un usuario tiene Google Calendar conectado
   */
  static async isConnected(userId: string): Promise<boolean> {
    const token = await googleCalendarToken.findUnique({
      where: { userId },
    });
    
    return !!token;
  }

  /**
   * Desconecta Google Calendar para un usuario
   */
  static async disconnect(userId: string): Promise<void> {
    await googleCalendarToken.delete({
      where: { userId },
    });
  }
}
