import { auth } from "@/auth";
import { db } from "@/lib/db";
import { resolveRoleCode } from "@/lib/roles";
import { checkRateLimit } from "@/lib/rate-limiter";
import { generateDigest, type Digest } from "@/lib/assistant/digest";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * El digest se genera una vez al día por usuario (hora de Ecuador) y se guarda
 * en GlobalConfig, así sobrevive entre instancias y visitas. GET devuelve el
 * del día (o lo genera si aún no existe); POST lo regenera a pedido.
 */
const keyOf = (userId: string) => `assistant-digest:${userId}`;
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil" }).format(new Date());

async function readStored(userId: string): Promise<{ day: string; digest: Digest } | null> {
  const row = await db.globalConfig.findUnique({ where: { key: keyOf(userId) } });
  if (!row) return null;
  try {
    return JSON.parse(row.value) as { day: string; digest: Digest };
  } catch {
    return null;
  }
}

async function generateAndStore(userId: string, name: string, role: NonNullable<ReturnType<typeof resolveRoleCode>>) {
  const result = await generateDigest({ id: userId, name, role });
  if ("error" in result) return result;
  const value = JSON.stringify({ day: today(), digest: result });
  await db.globalConfig.upsert({ where: { key: keyOf(userId) }, create: { key: keyOf(userId), value }, update: { value } });
  return result;
}

async function handle(refresh: boolean) {
  const session = await auth();
  const role = resolveRoleCode(session?.user);
  if (!session?.user?.id || !role) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  const userId = session.user.id;
  const stored = await readStored(userId);

  if (!refresh && stored?.day === today()) {
    return Response.json({ digest: stored.digest, cached: true });
  }

  const limit = checkRateLimit(userId, "assistant-digest", 6, 10 * 60_000);
  if (!limit.allowed) {
    if (stored) return Response.json({ digest: stored.digest, cached: true });
    return Response.json({ error: "Demasiadas solicitudes; espera unos minutos." }, { status: 429 });
  }

  try {
    const result = await generateAndStore(userId, session.user.name?.split(" ")[0] ?? "usuario", role);
    if ("error" in result) {
      if (stored) return Response.json({ digest: stored.digest, cached: true, error: result.error });
      return Response.json({ error: result.error }, { status: 502 });
    }
    return Response.json({ digest: result, cached: false });
  } catch (error) {
    console.error("[assistant/digest]", error);
    if (stored) return Response.json({ digest: stored.digest, cached: true });
    return Response.json({ error: "No se pudo generar el digest." }, { status: 500 });
  }
}

export async function GET() {
  return handle(false);
}

export async function POST() {
  return handle(true);
}
