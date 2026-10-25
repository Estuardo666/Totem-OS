import "server-only";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasCapability, resolveRoleCode, type ApiCapability } from "./roles";
import { assertTaskChanges, clientScope, taskScope, type AccessActor } from "./access-policy";

export async function requireActor(capability?: ApiCapability): Promise<AccessActor> {
  const session = await auth();
  const role = resolveRoleCode(session?.user);
  if (typeof session?.user?.id !== "string" || !session.user.id.trim() || !role) throw new Error("No autenticado");
  if (capability && !hasCapability(role, capability)) throw new Error("No autorizado");
  return { userId: session.user.id, role };
}

export async function requireAdmin(): Promise<AccessActor> {
  return requireActor("admin.users");
}

export async function requireClientAccess(clientId: string): Promise<AccessActor> {
  if (typeof clientId !== "string" || !clientId.trim()) throw new Error("Cliente no disponible");
  const actor = await requireActor("clients.read");
  const client = await db.client.findFirst({
    where: { AND: [{ id: clientId }, clientScope(actor)] }, select: { id: true },
  });
  if (!client) throw new Error("Cliente no disponible");
  return actor;
}

export async function requireTaskAccess(taskId: string, changes?: Record<string, unknown>): Promise<AccessActor & { taskStatus: string }> {
  if (typeof taskId !== "string" || !taskId.trim()) throw new Error("Tarea no disponible");
  const actor = await requireActor(changes ? "content.write" : "content.read");
  const task = await db.contentTask.findFirst({
    where: { AND: [{ id: taskId }, taskScope(actor)] },
    select: { id: true, status: true, assignedEditorId: true, assignedCommunityId: true },
  });
  if (!task) throw new Error("Tarea no disponible");
  if (changes) assertTaskChanges(actor, task, changes);
  return { ...actor, taskStatus: task.status };
}

export async function requireReportAccess(clientId: string, shareToken?: string): Promise<void> {
  if (typeof clientId !== "string" || !clientId.trim()) throw new Error("Cliente no disponible");
  if (shareToken !== undefined) {
    if (typeof shareToken !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(shareToken)) {
      throw new Error("Enlace no válido");
    }
    const client = await db.client.findFirst({
      where: { id: clientId, shareToken }, select: { id: true },
    });
    if (!client) throw new Error("Enlace no válido");
    return;
  }
  await requireAdmin();
}
