import { NextRequest, NextResponse } from "next/server";
import { compactSyncHistory } from "@/lib/sync-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  return Boolean(request.headers.get("x-vercel-cron-id"))
    || Boolean(process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`);
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    const result = await compactSyncHistory();
    return NextResponse.json({ success: true, data: result, executedAt: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Error desconocido" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
