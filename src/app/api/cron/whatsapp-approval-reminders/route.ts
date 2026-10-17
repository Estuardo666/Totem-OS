import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { enqueueWhatsAppApprovalReminders } from "@/lib/whatsapp/approval-reminders";

export async function POST(request: NextRequest) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    const result = await enqueueWhatsAppApprovalReminders();
    return NextResponse.json({ success: true, data: result });
  } catch {
    return NextResponse.json({ success: false, error: "No se pudieron preparar recordatorios de aprobación" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
