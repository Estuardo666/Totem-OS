import type { Prisma } from "@prisma/client";
import type { CanonicalRole } from "./roles.ts";

export type AccessActor = { userId: string; role: CanonicalRole };

export function canSubscribeToChannel(actor: AccessActor | null, channel: unknown): boolean {
  return Boolean(actor?.userId && (channel === "private-content" || channel === `private-user-${actor.userId}`));
}

export function taskScope(actor: AccessActor): Prisma.ContentTaskWhereInput {
  return actor.role === "ADMIN" ? {} : {
    OR: [{ assignedEditorId: actor.userId }, { assignedCommunityId: actor.userId }],
  };
}

export function clientScope(actor: AccessActor): Prisma.ClientWhereInput {
  return actor.role === "ADMIN" ? {} : {
    OR: [
      { editorId: actor.userId }, { communityId: actor.userId },
      { tasks: { some: taskScope(actor) } },
    ],
  };
}

export function shootScope(actor: AccessActor): Prisma.ShootWhereInput {
  return actor.role === "ADMIN" ? {} : {
    OR: [{ crew: { some: { id: actor.userId } } }, { tasks: { some: taskScope(actor) } }],
  };
}

const EDITOR_FIELDS = new Set(["status", "postCopy", "scriptUrl", "coverImageUrl", "audioBriefUrl"]);
const EDITOR_TRANSITIONS: Record<string, readonly string[]> = {
  RECORDED: ["EDITING"],
  EDITING: ["REVIEW_CLIENT"],
  REVIEW_INTERNAL: ["EDITING", "REVIEW_CLIENT"],
  REVIEW_CLIENT: ["EDITING"],
  REJECTED: ["EDITING"],
};

export function canEditAssignedTask(actor: AccessActor, task: {
  status: string; assignedEditorId: string | null; assignedCommunityId: string | null;
}): boolean {
  return actor.role === "ADMIN" || (actor.role === "EDITOR" && Boolean(EDITOR_TRANSITIONS[task.status]) &&
    (task.assignedEditorId === actor.userId || task.assignedCommunityId === actor.userId));
}

export function editorNextStatuses(status: string): readonly string[] {
  return EDITOR_TRANSITIONS[status] ?? [];
}

export function assertTaskChanges(
  actor: AccessActor,
  task: { status: string; assignedEditorId: string | null; assignedCommunityId: string | null },
  changes: Record<string, unknown>,
): void {
  if (actor.role === "ADMIN") return;
  if (actor.role !== "EDITOR" ||
    (task.assignedEditorId !== actor.userId && task.assignedCommunityId !== actor.userId)) {
    throw new Error("No autorizado para modificar esta tarea");
  }
  if (!EDITOR_TRANSITIONS[task.status]) throw new Error("La tarea no está en una etapa editable");
  if (Object.keys(changes).some((key) => !EDITOR_FIELDS.has(key))) {
    throw new Error("No autorizado para modificar esos campos");
  }
  if (changes.status !== undefined && changes.status !== task.status &&
    !EDITOR_TRANSITIONS[task.status].includes(String(changes.status))) {
    throw new Error("Transición de estado no autorizada");
  }
}

/** Public/operational projections are allowlists: new database fields stay private. */
function pick<T extends object>(value: T, keys: readonly string[]): Partial<T> {
  return Object.fromEntries(keys.filter((key) => key in value).map((key) => [key, value[key as keyof T]])) as Partial<T>;
}

const CLIENT_FIELDS = ["id", "name", "color", "logo", "brandKit", "brandDNA", "metricsConfig",
  "monthlyReels", "monthlyFlyers", "monthlyShoots", "editorId", "communityId", "lastPostDate", "createdAt", "updatedAt"];

export function operationalClient<T extends object>(value: T): T {
  // Neutral values preserve the existing view contracts without exposing commercial data.
  return { ...pick(value, CLIENT_FIELDS), status: "ACTIVE", monthlyRate: 0, paymentDay: null,
    billingStartDate: null, vault: null, planConfig: null, contactEmails: null, shareToken: null,
    pageAccessToken: null, credentials: [] } as T;
}

export function publicClient<T extends object>(value: T): Pick<T, Extract<keyof T, "id" | "name" | "logo" | "color">> {
  return pick(value, ["id", "name", "logo", "color"]) as Pick<T, Extract<keyof T, "id" | "name" | "logo" | "color">>;
}

export function directoryUser<T extends object>(value: T): T {
  return { ...pick(value, ["id", "name", "image", "specialty", "roleCode", "roleLegacy"]),
    _count: { tasksAsEditor: 0, tasksAsCommunity: 0 } } as T;
}

export function withoutPassword<T extends { password?: unknown }>(value: T): Omit<T, "password"> {
  const { password: _password, ...safe } = value;
  return safe;
}
