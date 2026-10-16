import { db } from "@/lib/db";

/** Read-only client view. The caller must take clientId from WhatsAppGroup, never from message text. */
export function buildClientScopedTools(clientId: string) {
  if (!clientId) throw new Error("clientId requerido");
  return {
    proximosContenidos: async () => {
      const tasks = await db.contentTask.findMany({
        where: { clientId, status: { notIn: ["PUBLISHED", "CANCELLED", "REJECTED"] } },
        select: { title: true, type: true, status: true, scheduledAt: true, dueDate: true },
        orderBy: [{ scheduledAt: { sort: "asc", nulls: "last" } }, { dueDate: { sort: "asc", nulls: "last" } }],
        take: 10,
      });
      return tasks.map(({ title, type, status, scheduledAt, dueDate }) => ({
        titulo: title,
        tipo: type,
        estado: status,
        fecha: scheduledAt?.toISOString() ?? dueDate?.toISOString() ?? null,
      }));
    },
    buscarContenido: async (texto: string) => {
      const query = texto.trim();
      if (!query) return [];
      const tasks = await db.contentTask.findMany({
        where: { clientId, title: { contains: query, mode: "insensitive" } },
        select: { title: true, type: true, status: true, scheduledAt: true, dueDate: true },
        orderBy: { updatedAt: "desc" },
        take: 10,
      });
      return tasks.map(({ title, type, status, scheduledAt, dueDate }) => ({
        titulo: title,
        tipo: type,
        estado: status,
        fecha: scheduledAt?.toISOString() ?? dueDate?.toISOString() ?? null,
      }));
    },
    proximosRodajes: async () => {
      const shoots = await db.shoot.findMany({
        where: { clientId, status: "SCHEDULED", startTime: { gte: new Date() } },
        select: { title: true, startTime: true, status: true },
        orderBy: { startTime: "asc" },
        take: 5,
      });
      return shoots.map(({ title, startTime, status }) => ({ titulo: title, fecha: startTime.toISOString(), estado: status }));
    },
    estadoAprobaciones: async () => {
      const groups = await db.whatsAppGroup.findMany({ where: { clientId }, select: { jid: true } });
      if (groups.length === 0) return [];
      const rows = await db.whatsAppApprovalRequest.findMany({
        where: { status: "PENDING", groupJid: { in: groups.map((group) => group.jid) } },
        select: { fileName: true, sentAt: true, task: { select: { title: true, type: true, status: true } } },
        orderBy: { sentAt: "desc" },
        take: 10,
      });
      return rows.map((row) => ({
        titulo: row.task?.title ?? row.fileName ?? "Contenido enviado",
        tipo: row.task?.type ?? null,
        estado: row.task?.status ?? "REVIEW_CLIENT",
        fecha: row.sentAt.toISOString(),
      }));
    },
  };
}
