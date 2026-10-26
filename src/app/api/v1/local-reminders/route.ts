import { API_CAPABILITIES } from "@/lib/api-actor";
import { apiSuccess } from "@/lib/api-kernel";
import { withApiProtection } from "@/lib/api-protection";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// An authoritative snapshot, including an empty list, for the signed-in device.
export const GET = withApiProtection(async (context) => {
  const userId = context.actor!.userId;
  const now = new Date();
  const sinceValue = new URL(context.request.url).searchParams.get("since");
  const sinceDate = sinceValue ? new Date(sinceValue) : now;
  const since = Number.isFinite(sinceDate.getTime())
    ? new Date(Math.max(now.getTime() - 7 * 86400_000, Math.min(now.getTime(), sinceDate.getTime()))) : now;
  const actor = context.actor!;
  const strategic = actor.capabilities.has(API_CAPABILITIES.financeStrategicRead);
  const personal = actor.capabilities.has(API_CAPABILITIES.financePersonalRead);
  const [assignments, publications, transactions, pendingCount, pendingTasks] = await Promise.all([
    db.notification.findMany({
      where: { userId, type: "ASSIGNED", createdAt: { gt: since, lte: now } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, message: true, createdAt: true },
    }),
    db.contentTask.findMany({
      where: { status: "PUBLISHED", publishedAt: { gt: since, lte: now },
        ...(!actor.capabilities.has(API_CAPABILITIES.contentRead) ? { id: "__none__" } : {}),
        ...(actor.role !== "ADMIN" ? { OR: [{ assignedEditorId: userId }, { assignedCommunityId: userId }] } : {}),
      },
      orderBy: [{ publishedAt: "asc" }, { id: "asc" }],
      select: { id: true, title: true, publishedAt: true },
    }),
    strategic || personal ? db.transaction.findMany({
      where: { updatedAt: { gt: since, lte: now }, type: { in: ["INCOME", "EXPENSE", "HONORARIOS"] },
        ...(!strategic ? { OR: [{ type: "EXPENSE", assignedToId: userId }, { type: "HONORARIOS", userId }] } : {}),
      },
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      select: { id: true, type: true, status: true, amount: true, description: true, updatedAt: true },
    }) : [],
    db.contentTask.count({ where: { status: { not: "PUBLISHED" }, OR: [{ assignedEditorId: userId }, { assignedCommunityId: userId }] } }),
    db.contentTask.findMany({
      where: { status: { not: "PUBLISHED" }, OR: [{ assignedEditorId: userId }, { assignedCommunityId: userId }] },
      orderBy: [{ dueDate: "asc" }, { id: "asc" }], take: 3, select: { title: true },
    }),
  ]);
  const shoots = await db.shoot.findMany({
    where: {
      status: "SCHEDULED",
      startTime: { gt: new Date() },
      crew: { some: { id: userId } },
    },
    orderBy: [{ startTime: "asc" }, { id: "asc" }],
    take: 60,
    select: { id: true, title: true, startTime: true },
  });
  return apiSuccess(context, {
    userId,
    cursor: now.toISOString(),
    dailySummary: `${pendingCount} tareas pendientes.${pendingTasks.length ? " " + pendingTasks.map((task) => task.title).join(" · ") : ""}`,
    notices: [
      ...assignments.map((item) => ({ id: `assignment-${item.id}`, title: "Nueva tarea asignada", body: item.message })),
      ...publications.map((item) => ({ id: `published-${item.id}-${item.publishedAt!.toISOString()}`, title: "Tarea publicada", body: item.title })),
      ...transactions.map((item) => ({
        id: `finance-${item.id}-${item.updatedAt.toISOString()}`,
        title: ({ INCOME: "Ingreso", EXPENSE: "Gasto", HONORARIOS: "Honorarios" } as Record<string, string>)[item.type],
        body: `${item.description || item.type} · $${item.amount.toFixed(2)} · ${({ PAID: "Pagado", PENDING: "Pendiente", CANCELLED: "Cancelado" } as Record<string, string>)[item.status] ?? item.status}`,
      })),
    ],
    events: shoots.map((shoot) => ({
      id: shoot.id, title: shoot.title, startTime: shoot.startTime.toISOString(),
    })),
  });
}, {
  requiredCapability: API_CAPABILITIES.notificationsSelf,
  rateLimit: { bucket: "local-reminders.read", limit: 60, windowMs: 60_000 },
});
