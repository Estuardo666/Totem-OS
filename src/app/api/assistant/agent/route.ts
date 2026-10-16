import { z } from "zod";
import { auth } from "@/auth";
import { resolveRoleCode } from "@/lib/roles";
import { checkRateLimit } from "@/lib/rate-limiter";
import { runAssistantTurn } from "@/lib/assistant/agent";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .min(1)
    .max(20),
});

/** Endpoint que llama la voz en vivo cuando necesita datos o acciones. */
export async function POST(request: Request) {
  const session = await auth();
  const role = resolveRoleCode(session?.user);
  if (!session?.user?.id || !role) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const limit = checkRateLimit(session.user.id, "assistant-agent", 30, 60_000);
  if (!limit.allowed) {
    return Response.json({ error: "Demasiadas consultas; espera un momento." }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  try {
    const result = await runAssistantTurn(
      { id: session.user.id, name: session.user.name ?? "usuario", role },
      parsed.data.messages
    );
    if ("error" in result) return Response.json(result, { status: 400 });
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Error del asistente" },
      { status: 500 }
    );
  }
}
