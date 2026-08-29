import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { decodeCursor, encodeCursor } from "./api-kernel.ts";
import { db } from "./db.ts";

export const SYNC_RETENTION_DAYS = 90;
export const SYNC_MAX_MUTATIONS = 50;
export const SYNC_MAX_BATCH_BYTES = 1024 * 1024;
export const SYNC_MAX_PULL = 100;
const syncCursorSchema = z.object({ version: z.literal(1), sequence: z.string().regex(/^\d+$/u) }).strict();

const ENTITY_TYPE = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/u;
const ENTITY_ID = /^[A-Za-z0-9_-]{1,128}$/u;

export type SyncOperation = "create" | "update" | "delete";

export interface SyncMutationInput {
  mutationId: string;
  clientId: string;
  entityType: string;
  entityId: string;
  operation: SyncOperation;
  baseVersion: number | null;
  data: Record<string, unknown> | null;
}

export interface SyncMutationResult {
  mutationId: string;
  duplicate: boolean;
  entityType: string;
  entityId: string;
  operation: SyncOperation;
  version: number;
  deleted: boolean;
  data: Record<string, unknown> | null;
  changedAt: string;
}

export interface SyncChangeResult {
  sequence: string;
  entityType: string;
  entityId: string;
  operation: SyncOperation;
  version: number;
  data: Record<string, unknown> | null;
  deletedAt: string | null;
  changedAt: string;
}

export class SyncConflictError extends Error {
  readonly currentVersion: number | null;
  readonly currentData: Record<string, unknown> | null;

  constructor(message: string, currentVersion: number | null, currentData: Record<string, unknown> | null = null) {
    super(message);
    this.name = "SyncConflictError";
    this.currentVersion = currentVersion;
    this.currentData = currentData;
  }
}

export class SyncMutationReuseError extends Error {
  constructor() {
    super("mutationId was already used with a different payload.");
    this.name = "SyncMutationReuseError";
  }
}

export class SyncCursorExpiredError extends Error {
  readonly oldestSequence: string | null;

  constructor(oldestSequence: string | null) {
    super("The sync cursor is older than the retained change history.");
    this.name = "SyncCursorExpiredError";
    this.oldestSequence = oldestSequence;
  }
}

export function encodeSyncCursor(sequence: bigint | string | number): string {
  return encodeCursor({ version: 1, sequence: String(sequence) });
}

export function decodeSyncCursor(cursor: string): bigint {
  const payload = decodeCursor(cursor, syncCursorSchema);
  return BigInt(payload.sequence);
}

export function validateSyncMutation(input: SyncMutationInput): void {
  if (!ENTITY_TYPE.test(input.entityType)) throw new Error("Invalid sync entity type.");
  if (!ENTITY_ID.test(input.entityId)) throw new Error("Invalid sync entity id.");
  if (!ENTITY_ID.test(input.clientId)) throw new Error("Invalid sync client id.");
  if (!ENTITY_ID.test(input.mutationId)) throw new Error("Invalid sync mutation id.");
  if (input.baseVersion !== null && (!Number.isInteger(input.baseVersion) || input.baseVersion < 0)) {
    throw new Error("Invalid sync base version.");
  }
  if (input.operation === "delete" && input.data !== null) throw new Error("Delete mutations cannot include data.");
  if (input.operation !== "delete" && (!input.data || Array.isArray(input.data))) {
    throw new Error("Create and update mutations require an object payload.");
  }
}

function stableRequestHash(input: SyncMutationInput): string {
  return createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
}

function decodePayload(payload: string | null): Record<string, unknown> | null {
  if (!payload) return null;
  try {
    const parsed: unknown = JSON.parse(payload);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function mutationResponse(
  input: SyncMutationInput,
  version: number,
  deleted: boolean,
  data: Record<string, unknown> | null,
  changedAt: Date,
  duplicate: boolean,
): SyncMutationResult {
  return {
    mutationId: input.mutationId,
    duplicate,
    entityType: input.entityType,
    entityId: input.entityId,
    operation: input.operation,
    version,
    deleted,
    data,
    changedAt: changedAt.toISOString(),
  };
}

/** Registra entidad, cambio y receipt dentro de una única transacción. */
export async function applySyncMutation(
  ownerId: string,
  input: SyncMutationInput,
): Promise<SyncMutationResult> {
  validateSyncMutation(input);
  const requestHash = stableRequestHash(input);

  return db.$transaction(async (tx) => {
    const receipt = await tx.syncMutationReceipt.findUnique({
      where: {
        ownerId_clientId_mutationId: {
          ownerId,
          clientId: input.clientId,
          mutationId: input.mutationId,
        },
      },
    });
    if (receipt) {
      if (receipt.requestHash !== requestHash) throw new SyncMutationReuseError();
      return { ...(JSON.parse(receipt.response) as SyncMutationResult), duplicate: true };
    }

    const existing = await tx.syncEntity.findUnique({
      where: { ownerId_entityType_entityId: { ownerId, entityType: input.entityType, entityId: input.entityId } },
    });
    const currentVersion = existing?.version ?? null;
    const currentData = decodePayload(existing?.payload ?? null);

    if (input.operation === "create" && existing) {
      throw new SyncConflictError("The entity already exists.", currentVersion, currentData);
    }
    if (input.operation !== "create" && (!existing || input.baseVersion !== existing.version)) {
      throw new SyncConflictError("The entity changed on the server.", currentVersion, currentData);
    }
    if (input.operation === "create" && input.baseVersion !== null && input.baseVersion !== 0) {
      throw new SyncConflictError("Create mutations must start at version zero.", currentVersion, currentData);
    }

    const version = (existing?.version ?? 0) + 1;
    const deleted = input.operation === "delete";
    const changedAt = new Date();
    const payload = deleted ? null : JSON.stringify(input.data);
    if (existing) {
      await tx.syncEntity.update({
        where: { id: existing.id },
        data: { version, payload, deletedAt: deleted ? changedAt : null, updatedAt: changedAt },
      });
    } else {
      await tx.syncEntity.create({
        data: {
          ownerId,
          entityType: input.entityType,
          entityId: input.entityId,
          version,
          payload,
          deletedAt: deleted ? changedAt : null,
          createdAt: changedAt,
          updatedAt: changedAt,
        },
      });
    }

    const change = await tx.syncChange.create({
      data: {
        ownerId,
        entityType: input.entityType,
        entityId: input.entityId,
        version,
        operation: input.operation,
        payload,
        deletedAt: deleted ? changedAt : null,
        createdAt: changedAt,
      },
    });
    const response = mutationResponse(input, version, deleted, input.data, changedAt, false);
    await tx.syncMutationReceipt.create({
      data: {
        ownerId,
        clientId: input.clientId,
        mutationId: input.mutationId,
        entityType: input.entityType,
        entityId: input.entityId,
        requestHash,
        status: "APPLIED",
        response: JSON.stringify(response),
        resultVersion: version,
        createdAt: changedAt,
      },
    });
    // Force the change insert to remain part of the transaction and make the
    // value observable to callers without leaking BigInt through JSON.
    void change.sequence;
    return response;
  });
}

export async function pullSyncChanges(
  ownerId: string,
  afterSequence: bigint,
  limit: number,
): Promise<{ changes: SyncChangeResult[]; hasMore: boolean; nextSequence: string | null }> {
  const boundary = await db.syncCursorBoundary.findUnique({ where: { ownerId }, select: { oldestSequence: true } });
  if (boundary && afterSequence < boundary.oldestSequence) {
    throw new SyncCursorExpiredError(boundary.oldestSequence.toString());
  }
  const oldest = await db.syncChange.findFirst({
    where: { ownerId }, orderBy: { sequence: "asc" }, select: { sequence: true, createdAt: true },
  });
  const retentionCutoff = new Date(Date.now() - SYNC_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  if (oldest && oldest.createdAt <= retentionCutoff && afterSequence < oldest.sequence) {
    throw new SyncCursorExpiredError(oldest.sequence.toString());
  }
  const rows = await db.syncChange.findMany({
    where: { ownerId, sequence: { gt: afterSequence } },
    orderBy: { sequence: "asc" },
    take: limit + 1,
  });
  const hasMore = rows.length > limit;
  const visible = hasMore ? rows.slice(0, limit) : rows;
  return {
    changes: visible.map((row) => ({
      sequence: row.sequence.toString(), entityType: row.entityType, entityId: row.entityId,
      operation: row.operation as SyncOperation, version: row.version,
      data: decodePayload(row.payload), deletedAt: row.deletedAt?.toISOString() ?? null,
      changedAt: row.createdAt.toISOString(),
    })),
    hasMore,
    nextSequence: visible.length ? visible.at(-1)!.sequence.toString() : null,
  };
}

export async function bootstrapSync(ownerId: string): Promise<{ entities: SyncChangeResult[]; latestSequence: string | null }> {
  const [entities, latest] = await Promise.all([
    db.syncEntity.findMany({ where: { ownerId }, orderBy: [{ entityType: "asc" }, { entityId: "asc" }] }),
    db.syncChange.findFirst({ where: { ownerId }, orderBy: { sequence: "desc" }, select: { sequence: true } }),
  ]);
  return {
    entities: entities.map((entity) => ({
      sequence: "0", entityType: entity.entityType, entityId: entity.entityId,
      operation: entity.deletedAt ? "delete" : "update", version: entity.version,
      data: decodePayload(entity.payload), deletedAt: entity.deletedAt?.toISOString() ?? null,
      changedAt: entity.updatedAt.toISOString(),
    })),
    latestSequence: latest?.sequence.toString() ?? null,
  };
}

/** Compacta cambios y receipts fuera de la ventana retenida y deja una
 * frontera durable para que los cursores antiguos obliguen a un resync. */
export async function compactSyncHistory(now = new Date()): Promise<{ changes: number; receipts: number; owners: number }> {
  const cutoff = new Date(now.getTime() - SYNC_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  return db.$transaction(async (tx) => {
    const oldChanges = await tx.syncChange.findMany({
      where: { createdAt: { lt: cutoff } },
      orderBy: [{ ownerId: "asc" }, { sequence: "desc" }],
      select: { ownerId: true, sequence: true },
    });
    const maxByOwner = new Map<string, bigint>();
    for (const change of oldChanges) {
      if (!maxByOwner.has(change.ownerId)) maxByOwner.set(change.ownerId, change.sequence);
    }
    const deletedChanges = await tx.syncChange.deleteMany({ where: { createdAt: { lt: cutoff } } });
    for (const [ownerId, sequence] of maxByOwner) {
      await tx.syncCursorBoundary.upsert({
        where: { ownerId },
        update: { oldestSequence: sequence, updatedAt: now },
        create: { id: `sync-boundary-${ownerId}`, ownerId, oldestSequence: sequence, updatedAt: now },
      });
    }
    const deletedReceipts = await tx.syncMutationReceipt.deleteMany({ where: { createdAt: { lt: cutoff } } });
    return { changes: deletedChanges.count, receipts: deletedReceipts.count, owners: maxByOwner.size };
  });
}

export type SyncTransactionClient = Prisma.TransactionClient;
