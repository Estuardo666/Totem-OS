import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { isWorkerRequestAuthorized } from "@/lib/worker-auth";
import { getWhatsAppConfig } from "@/lib/whatsapp/config";
import { normalizePhone } from "@/lib/whatsapp/enqueue";

const noticeSchema = z.discriminatedUnion("event", [
  z.object({ event: z.enum(["QR_REQUIRED", "LOGGED_OUT"]) }).strict(),
  z.object({ event: z.literal("APPROVAL_RESOLVED"), requestId: z.string().min(1).max(128) }).strict(),
]);

/** Worker transport only: caller cannot supply message text or recipients. */
export async function POST(request: Request) {
  if (!isWorkerRequestAuthorized(request.headers.get("authorization"), process.env.WA_WORKER_SECRET)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  let notice: z.infer<typeof noticeSchema>;
  try {
    const text = await request.text();
    if (Buffer.byteLength(text) > 2048) return NextResponse.json({ error: "Solicitud demasiado grande" }, { status: 413 });
    notice = noticeSchema.parse(JSON.parse(text));
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  try {
    let userIds: string[];
    let message: string;
    let title: string;
    let type: string;
    let url: string;
    if (notice.event === "APPROVAL_RESOLVED") {
      const approval = await db.whatsAppApprovalRequest.findUnique({
        where: { id: notice.requestId },
        select: { status: true, task: { select: { title: true, assignedEditorId: true, assignedCommunityId: true } } },
      });
      if (!approval?.task || !["APPROVED", "CHANGES"].includes(approval.status)) {
        return NextResponse.json({ error: "La aprobación no está resuelta" }, { status: 409 });
      }
      userIds = [...new Set([approval.task.assignedEditorId, approval.task.assignedCommunityId].filter((id): id is string => Boolean(id)))];
      const changes = approval.status === "CHANGES";
      title = changes ? "Cambios solicitados" : "Contenido aprobado";
      message = changes ? `El cliente pidió cambios para “${approval.task.title}”. Revisa los comentarios en Totem.` : `El cliente aprobó “${approval.task.title}”.`;
      type = changes ? "TASK_CLIENT_CHANGES" : "TASK_CLIENT_APPROVED";
      url = "/content";
    } else {
      const config = await getWhatsAppConfig();
      const users = await db.user.findMany({ select: { id: true, phone: true, roleCode: true } });
      const owner = config.ownerPhone ? users.find((user) => user.phone && normalizePhone(user.phone) === normalizePhone(config.ownerPhone!)) : null;
      userIds = owner ? [owner.id] : users.filter((user) => user.roleCode === "ADMIN").map((user) => user.id);
      title = "Vincular Totem Bot";
      message = notice.event === "LOGGED_OUT" ? "WhatsApp cerró la sesión de Totem Bot. Vuelve a escanear el QR desde el panel WhatsApp." : "El QR de Totem Bot está listo. Abre el panel WhatsApp para vincular el teléfono.";
      type = "WHATSAPP_WORKER";
      url = "/admin/whatsapp";
    }
    if (!userIds.length) return NextResponse.json({ success: false, error: "No hay destinatarios configurados" }, { status: 409 });
    const { sendNotification } = await import("@/actions/notification-actions");
    const { sendPushNotification } = await import("@/actions/push-actions");
    const notifications = await Promise.all(userIds.map((userId) => sendNotification({ userId, message, type, createdBy: "Totem Bot" })));
    const pushed = await sendPushNotification({ title, message, userIds, url });
    if (notifications.some((result) => !result.success) || !pushed.success) {
      return NextResponse.json({ success: false, error: "No se pudo entregar uno de los avisos" }, { status: 503 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: "No se pudo entregar el aviso del worker" }, { status: 503 });
  }
}
