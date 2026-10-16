import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { enqueueWhatsAppTeamDailySummaries } from "@/lib/whatsapp/team-daily";

export async function POST(request: NextRequest) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    const result = await enqueueWhatsAppTeamDailySummaries();
    return NextResponse.json({ success: true, data: result });
  } catch {
    // Do not write contact data, message contents, or environment values to logs.
    return NextResponse.json({ success: false, error: "No se pudo preparar el resumen del equipo" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
