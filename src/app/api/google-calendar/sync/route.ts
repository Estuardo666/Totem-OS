import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { GoogleCalendarService } from "@/lib/google-calendar";
import { fullCalendarSync } from "@/lib/calendar-to-shoot-sync";
import { revalidatePath } from "next/cache";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    if (!(await GoogleCalendarService.isConnected(session.user.id))) {
      return NextResponse.json({ error: "Conecta Google Calendar desde Configuración." }, { status: 409 });
    }
    const result = await fullCalendarSync(session.user.id);
    revalidatePath("/content/shoots");
    if (result.errors.length > 0) {
      console.error("[Calendar Sync] Import failed:", result.errors);
      return NextResponse.json({ error: "No se completó la sincronización. Reintenta o reconecta Google Calendar desde Configuración." }, { status: 502 });
    }
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[Calendar Sync] Unexpected error:", error);
    return NextResponse.json({ error: "No se pudo sincronizar Google Calendar." }, { status: 500 });
  }
}
