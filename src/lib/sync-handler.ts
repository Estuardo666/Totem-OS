import {
  ApiProblem,
  apiSuccess,
  parseCursorPage,
  readJsonBody,
  type ApiRequestContext,
} from "./api-kernel.ts";
import { syncPullQuerySchema, syncPushBodySchema } from "../contracts/api-contracts.ts";
import {
  applySyncMutation,
  bootstrapSync,
  pullSyncChanges,
  SYNC_MAX_BATCH_BYTES,
  SyncConflictError,
  SyncCursorExpiredError,
  SyncMutationReuseError,
} from "./sync-service.ts";

function syncProblem(error: unknown): never {
  if (error instanceof SyncConflictError) {
    throw new ApiProblem({
      status: 409, code: "CONFLICT", title: "Sync conflict", detail: error.message,
      errors: [{ path: ["baseVersion"], code: "VERSION_CONFLICT", message: `Current server version: ${error.currentVersion ?? "missing"}.` }],
    });
  }
  if (error instanceof SyncMutationReuseError) {
    throw new ApiProblem({ status: 409, code: "MUTATION_REUSED", title: "Mutation already used", detail: error.message });
  }
  if (error instanceof SyncCursorExpiredError) {
    throw new ApiProblem({ status: 410, code: "CURSOR_EXPIRED", title: "Sync cursor expired", detail: error.message,
      headers: error.oldestSequence ? { "x-sync-oldest-sequence": error.oldestSequence } : undefined });
  }
  throw error;
}

export async function handleSyncPull(context: ApiRequestContext): Promise<Response> {
  if (!context.actor) throw new Error("Sync handler requires an authenticated actor.");
  const url = new URL(context.request.url);
  const parsed = syncPullQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    throw new ApiProblem({ status: 400, code: "INVALID_PAGINATION", title: "Invalid sync cursor", detail: "cursor and limit must be valid integers." });
  }
  const limit = parsed.data.limit ?? parseCursorPage(url).limit;
  const after = parsed.data.cursor ? BigInt(parsed.data.cursor) : 0n;
  try {
    const result = await pullSyncChanges(context.actor.userId, after, limit);
    return apiSuccess(context, { changes: result.changes, hasMore: result.hasMore, nextCursor: result.nextSequence, retentionDays: 90 });
  } catch (error) {
    return syncProblem(error);
  }
}

export async function handleSyncPush(context: ApiRequestContext): Promise<Response> {
  if (!context.actor) throw new Error("Sync handler requires an authenticated actor.");
  const body = await readJsonBody(context, syncPushBodySchema, SYNC_MAX_BATCH_BYTES);
  const results = [];
  try {
    for (const mutation of body.mutations) results.push(await applySyncMutation(context.actor.userId, mutation));
  } catch (error) {
    return syncProblem(error);
  }
  return apiSuccess(context, { results });
}

export async function handleSyncBootstrap(context: ApiRequestContext): Promise<Response> {
  if (!context.actor) throw new Error("Sync handler requires an authenticated actor.");
  const result = await bootstrapSync(context.actor.userId);
  return apiSuccess(context, { entities: result.entities, latestCursor: result.latestSequence, retentionDays: 90 });
}
