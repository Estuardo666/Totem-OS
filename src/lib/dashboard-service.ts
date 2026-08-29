import type { Prisma } from "@prisma/client";
import type {
  DashboardApproval,
  DashboardData,
  DashboardTask,
  DashboardTransaction,
  DashboardWorkload,
} from "../contracts/api-contracts.ts";
import { resolveRoleCode } from "./roles.ts";
import type { ApiActor } from "./api-actor.ts";
import { db } from "./db.ts";
import { getReceivablesFromDb } from "./finance-transaction-service.ts";

const EDITOR_PENDING_STATUSES = new Set(["RECORDED", "EDITING", "REVIEW_CLIENT"]);
const COMMUNITY_PENDING_STATUSES = new Set(["IDEA", "SCRIPT", "CLIENT_APPROVED"]);
const APPROVAL_STATUSES = new Set(["REVIEW_INTERNAL", "REVIEW_CLIENT", "CLIENT_APPROVED", "APPROVED"]);
const PIPELINE_STAGES = [
  ["IDEA", "Idea"],
  ["SCRIPT", "Guion"],
  ["PRODUCTION", "Producción"],
  ["EDITING", "Edición"],
  ["REVIEW", "Revisión"],
  ["PUBLISHED", "Publicado"],
] as const;

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date): Date {
  const end = startOfDay(date);
  end.setDate(end.getDate() + 1);
  return end;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getPipelineKey(status: string): string {
  if (status === "IDEA") return "IDEA";
  if (status === "SCRIPT") return "SCRIPT";
  if (status === "RECORDED") return "PRODUCTION";
  if (status === "EDITING") return "EDITING";
  if (["REVIEW_INTERNAL", "REVIEW_CLIENT"].includes(status)) return "REVIEW";
  return "PUBLISHED";
}

function isOverdueBy24Hours(dueDate: Date | null, now: Date): boolean {
  return Boolean(dueDate && dueDate.getTime() <= now.getTime() - 24 * 60 * 60 * 1000);
}

function mapTask(task: {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  dueDate: Date | null;
  scheduledAt: Date | null;
  updatedAt: Date;
  client: { id: string; name: string; logo: string | null };
  assignedEditor: { id: string; name: string; image: string | null } | null;
  assignedCommunity: { id: string; name: string; image: string | null } | null;
}): DashboardTask {
  const assignee = task.assignedEditor ?? task.assignedCommunity;
  return {
    id: task.id,
    title: task.title,
    type: task.type,
    status: task.status,
    priority: task.priority,
    dueDate: iso(task.dueDate),
    scheduledAt: iso(task.scheduledAt),
    updatedAt: task.updatedAt.toISOString(),
    client: { id: task.client.id, name: task.client.name, logoUrl: task.client.logo },
    assignedTo: assignee ? { id: assignee.id, name: assignee.name, imageUrl: assignee.image } : null,
  };
}

/**
 * Builds one compact projection for both clients. This is deliberately a
 * service (rather than a Server Action) so API handlers, React and Swift use
 * the same authorization and aggregation rules.
 */
export async function loadDashboard(actor: ApiActor): Promise<DashboardData> {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const monthStart = startOfMonth(now);
  const fourDaysFromNow = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);

  const activeClientFilter: Prisma.ClientWhereInput = { status: { not: "INACTIVE" } };
  const taskWhere: Prisma.ContentTaskWhereInput = actor.role === "EDITOR"
    ? {
        client: activeClientFilter,
        OR: [{ assignedEditorId: actor.userId }, { assignedCommunityId: actor.userId }],
      }
    : { client: activeClientFilter };
  const clientWhere: Prisma.ClientWhereInput = actor.role === "EDITOR"
    ? { ...activeClientFilter, OR: [{ editorId: actor.userId }, { communityId: actor.userId }] }
    : activeClientFilter;

  const [user, activeClients, tasks, pendingFeedbacks, users, paidInvoiceTotal, paidIncomeTotal, receivableInvoices, receivableTransactions, recentTransactions] = await Promise.all([
    db.user.findUnique({
      where: { id: actor.userId },
      select: { id: true, name: true, image: true, roleCode: true, roleLegacy: true, specialty: true },
    }),
    db.client.count({ where: clientWhere }),
    db.contentTask.findMany({
      where: taskWhere,
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        priority: true,
        dueDate: true,
        scheduledAt: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
        assignedEditorId: true,
        assignedCommunityId: true,
        client: { select: { id: true, name: true, logo: true } },
        assignedEditor: { select: { id: true, name: true, image: true } },
        assignedCommunity: { select: { id: true, name: true, image: true } },
      },
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
    }),
    db.clientFeedback.findMany({
      where: { viewed: false, client: activeClientFilter },
      select: { id: true, clientId: true, createdAt: true, client: { select: { name: true, logo: true } } },
      orderBy: { createdAt: "desc" },
    }),
    actor.role === "ADMIN"
      ? db.user.findMany({
          select: { id: true, name: true, image: true, roleCode: true, roleLegacy: true, specialty: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    actor.role === "ADMIN"
      ? db.invoice.aggregate({
          where: { status: "PAID", generatedAt: { gte: monthStart, lt: todayEnd } },
          _sum: { amount: true },
        })
      : Promise.resolve({ _sum: { amount: null } }),
    actor.role === "ADMIN"
      ? db.transaction.aggregate({
          where: { type: "INCOME", status: "PAID", createdAt: { gte: monthStart, lt: todayEnd } },
          _sum: { amount: true },
        })
      : Promise.resolve({ _sum: { amount: null } }),
    actor.role === "ADMIN"
      ? db.invoice.aggregate({ where: { status: { in: ["PENDING", "SENT"] } }, _sum: { amount: true } })
      : Promise.resolve({ _sum: { amount: null } }),
    actor.role === "ADMIN"
      ? db.transaction.aggregate({ where: { type: "INCOME", status: "PENDING" }, _sum: { amount: true } })
      : Promise.resolve({ _sum: { amount: null } }),
    actor.role === "ADMIN"
      ? db.transaction.findMany({
          where: { type: { in: ["INCOME", "EXPENSE", "HONORARIOS"] }, status: { not: "CANCELLED" } },
          select: { id: true, description: true, type: true, amount: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 3,
        })
      : Promise.resolve([]),
  ]);

  if (!user) throw new Error("Dashboard actor does not exist");

  const receivablesResult = actor.role === "ADMIN"
    ? await getReceivablesFromDb(actor.userId, now)
    : null;
  const authoritativeReceivable = receivablesResult?.success
    ? receivablesResult.data?.totalReceivable ?? 0
    : (receivableInvoices._sum.amount ?? 0) + (receivableTransactions._sum.amount ?? 0);

  const taskRows = tasks;
  const dashboardTasks = taskRows.map(mapTask);
  const agenda = dashboardTasks
    .filter((task) => task.scheduledAt && new Date(task.scheduledAt) >= todayStart && new Date(task.scheduledAt) < todayEnd && task.status !== "PUBLISHED")
    .sort((left, right) => Date.parse(left.scheduledAt!) - Date.parse(right.scheduledAt!))
    .slice(0, 6);
  const priorityTasks = dashboardTasks
    .filter((task) => task.dueDate && task.status !== "PUBLISHED" && new Date(task.dueDate) <= fourDaysFromNow)
    .sort((left, right) => Date.parse(left.dueDate!) - Date.parse(right.dueDate!))
    .slice(0, 6);
  const monthTasks = taskRows.filter((task) => (task.publishedAt ?? task.dueDate ?? task.createdAt) >= monthStart);
  const pendingApprovalTasks = taskRows.filter((task) => APPROVAL_STATUSES.has(task.status));

  const approvals: DashboardApproval[] = [
    ...pendingFeedbacks.map((feedback) => ({
      id: feedback.id,
      title: `Feedback de ${feedback.client.name}`,
      kind: "feedback" as const,
      clientId: feedback.clientId,
      clientName: feedback.client.name,
      clientLogoUrl: feedback.client.logo,
      updatedAt: feedback.createdAt.toISOString(),
    })),
    ...pendingApprovalTasks.map((task) => ({
      id: task.id,
      title: task.title,
      kind: "task" as const,
      clientId: task.client.id,
      clientName: task.client.name,
      clientLogoUrl: task.client.logo,
      updatedAt: task.updatedAt.toISOString(),
    })),
  ].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));

  const role = resolveRoleCode(user) ?? actor.role;
  const workloadUsers = actor.role === "ADMIN" ? users : [user];
  const workloads: DashboardWorkload[] = workloadUsers
    .map((workloadUser) => {
      const workloadRole = resolveRoleCode(workloadUser) ?? "USER";
      const pendingTasksCount = taskRows.reduce((count, task) => {
        const editorCount = task.assignedEditorId === workloadUser.id && EDITOR_PENDING_STATUSES.has(task.status) ? 1 : 0;
        const communityCount = task.assignedCommunityId === workloadUser.id && COMMUNITY_PENDING_STATUSES.has(task.status) ? 1 : 0;
        return count + editorCount + communityCount;
      }, 0);
      const weeklyCapacity = workloadRole === "ADMIN" ? 15 : workloadRole === "EDITOR" ? 10 : 5;
      return {
        userId: workloadUser.id,
        userName: workloadUser.name,
        userRole: workloadRole,
        userSpecialty: workloadUser.specialty,
        userImageUrl: "image" in workloadUser ? workloadUser.image : user.image,
        pendingTasksCount,
        weeklyCapacity,
        utilizationPct: Math.round((pendingTasksCount / weeklyCapacity) * 100),
      };
    })
    .filter((workload) => actor.role !== "ADMIN" || workload.pendingTasksCount > 0 || workload.userId === actor.userId)
    .slice(0, 5);

  const transactions: DashboardTransaction[] = recentTransactions.map((transaction) => ({
    id: transaction.id,
    description: transaction.description?.trim() || "Transacción",
    type: transaction.type as DashboardTransaction["type"],
    amount: transaction.amount,
    date: transaction.createdAt.toISOString(),
  }));

  return {
    generatedAt: now.toISOString(),
    user: { id: user.id, name: user.name, role, specialty: user.specialty },
    summary: {
      activeClients,
      assignedTasks: taskRows.length,
      overdueEditingTasks: taskRows.filter((task) => task.status === "EDITING" && isOverdueBy24Hours(task.dueDate, now)).length,
      overduePublicationTasks: taskRows.filter((task) => ["CLIENT_APPROVED", "APPROVED"].includes(task.status) && isOverdueBy24Hours(task.dueDate, now)).length,
      publishedThisMonth: monthTasks.filter((task) => task.status === "PUBLISHED").length,
      pendingApprovals: approvals.length,
      scheduledToday: agenda.length,
      priorityTasks: priorityTasks.length,
      totalIncome: actor.role === "ADMIN" ? (paidInvoiceTotal._sum.amount ?? 0) + (paidIncomeTotal._sum.amount ?? 0) : null,
      totalReceivable: actor.role === "ADMIN" ? authoritativeReceivable : null,
    },
    pipeline: PIPELINE_STAGES.map(([key, label]) => ({
      key,
      label,
      count: monthTasks.filter((task) => getPipelineKey(task.status) === key).length,
    })),
    agenda,
    priorityTasks,
    approvals: approvals.slice(0, 6),
    workloads,
    recentTransactions: transactions,
  };
}
