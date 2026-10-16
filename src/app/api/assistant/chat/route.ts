import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import { auth } from "@/auth";
import { resolveRoleCode } from "@/lib/roles";
import { checkRateLimit } from "@/lib/rate-limiter";
import { getAssistantModel } from "@/lib/assistant/config";
import { buildAssistantTools } from "@/lib/assistant/tools";
import { buildSystemPrompt } from "@/lib/assistant/prompt";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Solo se envían los últimos mensajes: mantiene cada consulta barata. */
const MAX_HISTORY = 20;

export async function POST(request: Request) {
  const session = await auth();
  const role = resolveRoleCode(session?.user);
  if (!session?.user?.id || !role) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const limit = checkRateLimit(session.user.id, "assistant-chat", 30, 60_000);
  if (!limit.allowed) {
    return Response.json({ error: "Demasiadas consultas; espera un momento." }, { status: 429 });
  }

  const resolved = await getAssistantModel();
  if ("error" in resolved) {
    return Response.json({ error: resolved.error }, { status: 400 });
  }

  const { messages } = (await request.json()) as { messages: UIMessage[] };
  const user = { id: session.user.id, name: session.user.name ?? "usuario", role };
  const tools = buildAssistantTools(user);

  const result = streamText({
    model: resolved.model,
    system: buildSystemPrompt(user),
    messages: await convertToModelMessages(messages.slice(-MAX_HISTORY), { tools }),
    tools,
    stopWhen: stepCountIs(6),
    maxOutputTokens: 1024,
  });

  return result.toUIMessageStreamResponse({
    onError: (error) => (error instanceof Error ? error.message : "Error del asistente"),
  });
}
