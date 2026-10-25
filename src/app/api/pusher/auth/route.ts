import { requireActor } from "@/lib/server-access";
import { canSubscribeToChannel } from "@/lib/access-policy";
import { pusherServer } from "@/lib/pusher";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let actor;
  try {
    actor = await requireActor();
  } catch {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  try {
    const form = await request.formData();
    const channel = form.get("channel_name");
    const socketId = form.get("socket_id");
    if (typeof socketId !== "string" || !/^\d+\.\d+$/.test(socketId) || typeof channel !== "string") {
      return Response.json({ error: "Solicitud inválida" }, { status: 400 });
    }
    if (!canSubscribeToChannel(actor, channel)) {
      return Response.json({ error: "No autorizado" }, { status: 403 });
    }
    return Response.json(pusherServer.authorizeChannel(socketId, channel));
  } catch {
    return Response.json({ error: "Solicitud inválida" }, { status: 400 });
  }
}
