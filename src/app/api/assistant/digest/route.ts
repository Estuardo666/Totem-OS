import { auth } from "@/auth";
import { resolveRoleCode } from "@/lib/roles";
import { checkRateLimit } from "@/lib/rate-limiter";
import { generateDigest, type Digest } from "@/lib/assistant/digest";

export const runtime = "nodejs";
export const maxDuration = 60;

/** El digest cambia poco en minutos: se cachea por usuario para no gastar tokens en cada visita. */
const TTL = 30 * 60_000;
const cache = new Map<string, { at: number; digest: Digest }>();

export async function GET(request: Request) {
  const session = await auth();
  const role = resolveRoleCode(session?.user);
  if (!session?.user?.id || !role) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const userId = session.user.id;
  const refresh = new URL(request.url).searchParams.get("refresh") === "1";
  const hit = cache.get(userId);
  if (!refresh && hit && Date.now() - hit.at < TTL) {
    return Response.json({ digest: hit.digest, cached: true });
  }

  const limit = checkRateLimit(userId, "assistant-digest", 6, 10 * 60_000);
  if (!limit.allowed) {
    if (hit) return Response.json({ digest: hit.digest, cached: true });
    return Response.json({ error: "Demasiadas solicitudes; espera unos minutos." }, { status: 429 });
  }

  try {
    const result = await generateDigest({ id: userId, name: session.user.name?.split(" ")[0] ?? "usuario", role });
    if ("error" in result) return Response.json({ error: result.error }, { status: 502 });
    cache.set(userId, { at: Date.now(), digest: result });
    return Response.json({ digest: result, cached: false });
  } catch (error) {
    console.error("[assistant/digest]", error);
    return Response.json({ error: "No se pudo generar el digest." }, { status: 500 });
  }
}
