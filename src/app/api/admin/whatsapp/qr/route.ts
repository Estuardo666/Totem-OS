import { auth } from "@/auth";
import { db } from "@/lib/db";
import { resolveRoleCode } from "@/lib/roles";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** The QR credential stays on the server; push notifications link to the admin page. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const actor = await db.user.findUnique({ where: { id: session.user.id }, select: { roleCode: true, roleLegacy: true } });
  if (resolveRoleCode(actor) !== "ADMIN") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const base = process.env.WA_HEALTH_URL;
  const token = process.env.WA_HEALTH_TOKEN;
  if (!base || !token) return NextResponse.json({ error: "Worker sin configurar" }, { status: 503 });
  try {
    const url = new URL(base);
    url.pathname = `${url.pathname.replace(/\/(?:health(?:\/qr)?)?\/?$/, "").replace(/\/$/, "")}/health/qr`;
    url.search = "";
    url.hash = "";
    const result = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (result.status === 404) return NextResponse.json({ error: "No hay un QR pendiente" }, { status: 404 });
    if (!result.ok || !result.headers.get("content-type")?.startsWith("image/png")) throw new Error("QR unavailable");
    const png = await result.arrayBuffer();
    if (png.byteLength > 2 * 1024 * 1024) throw new Error("QR too large");
    return new NextResponse(png, { headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    } });
  } catch {
    return NextResponse.json({ error: "No se pudo consultar el QR" }, { status: 503 });
  }
}
