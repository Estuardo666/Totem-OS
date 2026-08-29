import { z } from "zod";

/**
 * Registro versionado de los contratos REST que ya pueden consumir React y
 * Swift. Las rutas futuras se incorporan aquí antes de generar clientes.
 */

export const API_CONTRACT_VERSION = "0.2.0";

export const apiProblemIssueSchema = z.object({
  path: z.array(z.union([z.string(), z.number().int()])),
  code: z.string(),
  message: z.string(),
}).strict();

export const apiProblemSchema = z.object({
  type: z.string().url(),
  title: z.string(),
  status: z.number().int().min(400).max(599),
  detail: z.string(),
  instance: z.string(),
  code: z.enum([
    "UNAUTHENTICATED",
    "SESSION_EXPIRED",
    "FORBIDDEN",
    "CSRF_FAILED",
    "RATE_LIMITED",
    "RATE_LIMIT_STORE_UNAVAILABLE",
    "INVALID_JSON",
    "INVALID_CONTENT_LENGTH",
    "VALIDATION_ERROR",
    "PAYLOAD_TOO_LARGE",
    "INVALID_CURSOR",
    "INVALID_PAGINATION",
    "METHOD_NOT_ALLOWED",
    "CONFLICT",
    "CURSOR_EXPIRED",
    "MUTATION_REUSED",
    "INTERNAL_ERROR",
  ]),
  requestId: z.string(),
  retryAfter: z.number().int().nonnegative().optional(),
  errors: z.array(apiProblemIssueSchema).optional(),
}).strict();

export const kernelItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
}).strict();

export const kernelEchoQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
}).strict();

export const kernelEchoBodySchema = z.object({
  message: z.string().trim().min(1).max(280),
}).strict();

export const kernelEchoCursorSchema = z.object({
  version: z.literal(1),
  offset: z.number().int().min(0).max(60),
}).strict();

export const kernelEchoPaginationSchema = z.object({
  limit: z.number().int().min(1).max(100),
  hasMore: z.boolean(),
  nextCursor: z.string().nullable(),
}).strict();

export const kernelEchoMetaSchema = z.object({
  requestId: z.string(),
  pagination: kernelEchoPaginationSchema,
}).strict();

export const kernelEchoPostDataSchema = z.object({
  echo: z.string(),
}).strict();

export const kernelEchoPostMetaSchema = z.object({
  requestId: z.string(),
}).strict();

export const kernelEchoGetResponseSchema = z.object({
  data: z.array(kernelItemSchema),
  meta: kernelEchoMetaSchema,
}).strict();

export const kernelEchoPostResponseSchema = z.object({
  data: kernelEchoPostDataSchema,
  meta: kernelEchoPostMetaSchema,
}).strict();

export const shellBootstrapUserSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(64),
  email: z.string().email().nullable(),
  role: z.enum(["ADMIN", "EDITOR", "USER"]),
  roleLabel: z.string().min(1).max(64),
  avatarUrl: z.string().max(2048).nullable(),
  initials: z.string().min(1).max(2),
}).strict();

export const shellBootstrapPreferencesSchema = z.object({
  theme: z.enum(["light", "dark"]),
  accentColor: z.string().regex(/^#[0-9A-F]{6}$/u),
}).strict();

export const shellBootstrapBrandSchema = z.object({
  logoLight: z.string().max(2048).nullable(),
  logoDark: z.string().max(2048).nullable(),
}).strict();

export const shellBootstrapCountersSchema = z.object({
  pendingTasks: z.number().int().min(0).max(999),
  unreadNotifications: z.number().int().min(0).max(999),
}).strict();

export const shellBootstrapNotificationSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/u),
  message: z.string().max(280),
  createdAt: z.string().datetime(),
  authorName: z.string().max(64).nullable(),
  avatarUrl: z.string().max(2048).nullable(),
  read: z.boolean(),
}).strict();

export const shellBootstrapDataSchema = z.object({
  user: shellBootstrapUserSchema,
  capabilities: z.array(z.string().min(1)).max(64),
  preferences: shellBootstrapPreferencesSchema,
  brand: shellBootstrapBrandSchema,
  counters: shellBootstrapCountersSchema,
  notifications: z.array(shellBootstrapNotificationSchema).max(5),
}).strict();

export const shellBootstrapMetaSchema = z.object({
  requestId: z.string(),
}).strict();

export const shellBootstrapResponseSchema = z.object({
  data: shellBootstrapDataSchema,
  meta: shellBootstrapMetaSchema,
}).strict();

export const appRouteModeSchema = z.enum(["native", "web"]);

export const appRouteRuleSchema = z.object({
  path: z.string().regex(/^\/(?:[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*)?$/u),
  mode: appRouteModeSchema,
}).strict();

export const appConfigDataSchema = z.object({
  version: z.literal(1),
  defaultMode: appRouteModeSchema,
  routes: z.array(appRouteRuleSchema).max(64),
}).strict();

export const appConfigMetaSchema = z.object({
  requestId: z.string(),
}).strict();

export const appConfigResponseSchema = z.object({
  data: appConfigDataSchema,
  meta: appConfigMetaSchema,
}).strict();

const syncIdentifierSchema = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/u);
const syncEntityTypeSchema = z.string().regex(/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/u);
const syncPayloadSchema = z.record(z.unknown()).nullable();

export const syncMutationSchema = z.object({
  mutationId: syncIdentifierSchema,
  clientId: syncIdentifierSchema,
  entityType: syncEntityTypeSchema,
  entityId: syncIdentifierSchema,
  operation: z.enum(["create", "update", "delete"]),
  baseVersion: z.number().int().nonnegative().nullable(),
  data: syncPayloadSchema,
}).strict();

export const syncPushBodySchema = z.object({
  mutations: z.array(syncMutationSchema).min(1).max(50),
}).strict();

export const syncChangeSchema = z.object({
  sequence: z.string().regex(/^\d+$/u),
  entityType: syncEntityTypeSchema,
  entityId: syncIdentifierSchema,
  operation: z.enum(["create", "update", "delete"]),
  version: z.number().int().positive(),
  data: syncPayloadSchema,
  deletedAt: z.string().datetime().nullable(),
  changedAt: z.string().datetime(),
}).strict();

export const syncPullQuerySchema = z.object({
  cursor: z.string().regex(/^\d+$/u).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
}).strict();

export const syncPullDataSchema = z.object({
  changes: z.array(syncChangeSchema),
  hasMore: z.boolean(),
  nextCursor: z.string().regex(/^\d+$/u).nullable(),
  retentionDays: z.literal(90),
}).strict();

export const syncMutationResultSchema = z.object({
  mutationId: syncIdentifierSchema,
  duplicate: z.boolean(),
  entityType: syncEntityTypeSchema,
  entityId: syncIdentifierSchema,
  operation: z.enum(["create", "update", "delete"]),
  version: z.number().int().positive(),
  deleted: z.boolean(),
  data: syncPayloadSchema,
  changedAt: z.string().datetime(),
}).strict();

export const syncPushDataSchema = z.object({
  results: z.array(syncMutationResultSchema),
}).strict();

export const syncBootstrapDataSchema = z.object({
  entities: z.array(syncChangeSchema),
  latestCursor: z.string().regex(/^\d+$/u).nullable(),
  retentionDays: z.literal(90),
}).strict();

export const syncResponseMetaSchema = z.object({ requestId: z.string() }).strict();
export const syncPullResponseSchema = z.object({ data: syncPullDataSchema, meta: syncResponseMetaSchema }).strict();
export const syncPushResponseSchema = z.object({ data: syncPushDataSchema, meta: syncResponseMetaSchema }).strict();
export const syncBootstrapResponseSchema = z.object({ data: syncBootstrapDataSchema, meta: syncResponseMetaSchema }).strict();

export type ApiProblem = z.infer<typeof apiProblemSchema>;
export type KernelItem = z.infer<typeof kernelItemSchema>;
export type KernelEchoQuery = z.infer<typeof kernelEchoQuerySchema>;
export type KernelEchoBody = z.infer<typeof kernelEchoBodySchema>;
export type KernelEchoGetResponse = z.infer<typeof kernelEchoGetResponseSchema>;
export type KernelEchoPostResponse = z.infer<typeof kernelEchoPostResponseSchema>;
export type ShellBootstrapData = z.infer<typeof shellBootstrapDataSchema>;
export type ShellBootstrapResponse = z.infer<typeof shellBootstrapResponseSchema>;
export type AppRouteMode = z.infer<typeof appRouteModeSchema>;
export type AppRouteRule = z.infer<typeof appRouteRuleSchema>;
export type AppConfigData = z.infer<typeof appConfigDataSchema>;
export type AppConfigResponse = z.infer<typeof appConfigResponseSchema>;
export type SyncMutation = z.infer<typeof syncMutationSchema>;
export type SyncPushBody = z.infer<typeof syncPushBodySchema>;
export type SyncChange = z.infer<typeof syncChangeSchema>;
export type SyncPullQuery = z.infer<typeof syncPullQuerySchema>;
export type SyncPullResponse = z.infer<typeof syncPullResponseSchema>;
export type SyncPushResponse = z.infer<typeof syncPushResponseSchema>;
export type SyncBootstrapResponse = z.infer<typeof syncBootstrapResponseSchema>;

export type ApiContractResponse = {
  status: number;
  description: string;
  schemaName: "ApiProblem"
    | "KernelEchoGetResponse"
    | "KernelEchoPostResponse"
    | "ShellBootstrapResponse"
    | "AppConfigResponse"
    | "SyncPullResponse"
    | "SyncPushResponse"
    | "SyncBootstrapResponse";
};

export const apiContractRegistry = [
  {
    method: "get",
    path: "/api/v1/_kernel/echo",
    operationId: "kernelEchoList",
    summary: "List deterministic kernel items",
    description: "Stateless contract endpoint used to verify pagination and client decoding.",
    tag: "Kernel",
    requiredCapability: "kernel.echo.read",
    querySchema: kernelEchoQuerySchema,
    querySchemaName: "KernelEchoQuery",
    responses: [
      { status: 200, description: "Paginated kernel items.", schemaName: "KernelEchoGetResponse" },
      { status: 400, description: "Invalid pagination or cursor.", schemaName: "ApiProblem" },
      { status: 401, description: "Authentication required or session expired.", schemaName: "ApiProblem" },
      { status: 403, description: "Capability is missing.", schemaName: "ApiProblem" },
      { status: 405, description: "HTTP method is not allowed.", schemaName: "ApiProblem" },
      { status: 429, description: "Rate limit exceeded.", schemaName: "ApiProblem" },
      { status: 503, description: "Rate-limit store unavailable.", schemaName: "ApiProblem" },
    ] satisfies ApiContractResponse[],
  },
  {
    method: "post",
    path: "/api/v1/_kernel/echo",
    operationId: "kernelEcho",
    summary: "Echo a validated message",
    description: "Stateless contract endpoint used to verify JSON, validation and CSRF handling.",
    tag: "Kernel",
    requiredCapability: "kernel.echo.write",
    bodySchema: kernelEchoBodySchema,
    bodySchemaName: "KernelEchoBody",
    responses: [
      { status: 200, description: "Validated echo response.", schemaName: "KernelEchoPostResponse" },
      { status: 400, description: "Invalid JSON or body fields.", schemaName: "ApiProblem" },
      { status: 401, description: "Authentication required or session expired.", schemaName: "ApiProblem" },
      { status: 403, description: "Capability or CSRF token is missing.", schemaName: "ApiProblem" },
      { status: 405, description: "HTTP method is not allowed.", schemaName: "ApiProblem" },
      { status: 413, description: "Payload exceeds the endpoint limit.", schemaName: "ApiProblem" },
      { status: 429, description: "Rate limit exceeded.", schemaName: "ApiProblem" },
      { status: 503, description: "Rate-limit store unavailable.", schemaName: "ApiProblem" },
    ] satisfies ApiContractResponse[],
  },
  {
    method: "get",
    path: "/api/v1/shell/bootstrap",
    operationId: "shellBootstrap",
    summary: "Load native shell state",
    description: "Returns the authenticated session, capabilities, preferences, branding and counters owned by the Swift shell.",
    tag: "Shell",
    requiredCapability: "dashboard.read",
    responses: [
      { status: 200, description: "Native shell bootstrap state.", schemaName: "ShellBootstrapResponse" },
      { status: 401, description: "Authentication required or session expired.", schemaName: "ApiProblem" },
      { status: 403, description: "Dashboard capability is missing.", schemaName: "ApiProblem" },
      { status: 429, description: "Rate limit exceeded.", schemaName: "ApiProblem" },
      { status: 503, description: "Rate-limit store unavailable.", schemaName: "ApiProblem" },
    ] satisfies ApiContractResponse[],
  },
  {
    method: "get",
    path: "/api/v1/app-config",
    operationId: "appConfig",
    summary: "Resolve hybrid app routes",
    description: "Returns the native or legacy-web mode for each route after applying the authenticated user's rollback overrides.",
    tag: "App",
    requiredCapability: "dashboard.read",
    responses: [
      { status: 200, description: "Resolved hybrid routing configuration.", schemaName: "AppConfigResponse" },
      { status: 401, description: "Authentication required or session expired.", schemaName: "ApiProblem" },
      { status: 403, description: "Dashboard capability is missing.", schemaName: "ApiProblem" },
      { status: 429, description: "Rate limit exceeded.", schemaName: "ApiProblem" },
      { status: 503, description: "Rate-limit store unavailable.", schemaName: "ApiProblem" },
    ] satisfies ApiContractResponse[],
  },
  {
    method: "get",
    path: "/api/v1/sync/pull",
    operationId: "syncPull",
    summary: "Pull the sync change feed",
    description: "Returns retained changes after an opaque sequence cursor.",
    tag: "Sync",
    requiredCapability: "dashboard.read",
    querySchema: syncPullQuerySchema,
    querySchemaName: "SyncPullQuery",
    responses: [
      { status: 200, description: "Changes after the cursor.", schemaName: "SyncPullResponse" },
      { status: 400, description: "Invalid cursor or pagination.", schemaName: "ApiProblem" },
      { status: 401, description: "Authentication required or session expired.", schemaName: "ApiProblem" },
      { status: 403, description: "Dashboard capability is missing.", schemaName: "ApiProblem" },
      { status: 410, description: "Cursor is older than retained history.", schemaName: "ApiProblem" },
      { status: 429, description: "Rate limit exceeded.", schemaName: "ApiProblem" },
    ] satisfies ApiContractResponse[],
  },
  {
    method: "post",
    path: "/api/v1/sync/push",
    operationId: "syncPush",
    summary: "Push idempotent sync mutations",
    description: "Applies up to 50 mutations and returns one result for each mutation.",
    tag: "Sync",
    requiredCapability: "dashboard.read",
    bodySchema: syncPushBodySchema,
    bodySchemaName: "SyncPushBody",
    responses: [
      { status: 200, description: "Mutation results.", schemaName: "SyncPushResponse" },
      { status: 400, description: "Invalid mutation payload.", schemaName: "ApiProblem" },
      { status: 401, description: "Authentication required or session expired.", schemaName: "ApiProblem" },
      { status: 403, description: "Dashboard capability is missing or CSRF token is missing.", schemaName: "ApiProblem" },
      { status: 409, description: "A mutation conflicts with the server version.", schemaName: "ApiProblem" },
      { status: 413, description: "Mutation batch exceeds one MiB.", schemaName: "ApiProblem" },
      { status: 429, description: "Rate limit exceeded.", schemaName: "ApiProblem" },
    ] satisfies ApiContractResponse[],
  },
  {
    method: "get",
    path: "/api/v1/sync/bootstrap",
    operationId: "syncBootstrap",
    summary: "Bootstrap the sync store",
    description: "Returns the latest materialized entities and a cursor for subsequent pulls.",
    tag: "Sync",
    requiredCapability: "dashboard.read",
    responses: [
      { status: 200, description: "Materialized sync entities.", schemaName: "SyncBootstrapResponse" },
      { status: 401, description: "Authentication required or session expired.", schemaName: "ApiProblem" },
      { status: 403, description: "Dashboard capability is missing.", schemaName: "ApiProblem" },
      { status: 429, description: "Rate limit exceeded.", schemaName: "ApiProblem" },
    ] satisfies ApiContractResponse[],
  },
] as const;

export const generatedSchemaEntries = [
  ["ApiProblem", apiProblemSchema],
  ["APIProblemIssue", apiProblemIssueSchema],
  ["KernelItem", kernelItemSchema],
  ["KernelEchoQuery", kernelEchoQuerySchema],
  ["KernelEchoBody", kernelEchoBodySchema],
  ["KernelEchoCursor", kernelEchoCursorSchema],
  ["KernelEchoPagination", kernelEchoPaginationSchema],
  ["KernelEchoMeta", kernelEchoMetaSchema],
  ["KernelEchoPostData", kernelEchoPostDataSchema],
  ["KernelEchoPostMeta", kernelEchoPostMetaSchema],
  ["KernelEchoGetResponse", kernelEchoGetResponseSchema],
  ["KernelEchoPostResponse", kernelEchoPostResponseSchema],
  ["ShellBootstrapUser", shellBootstrapUserSchema],
  ["ShellBootstrapPreferences", shellBootstrapPreferencesSchema],
  ["ShellBootstrapBrand", shellBootstrapBrandSchema],
  ["ShellBootstrapCounters", shellBootstrapCountersSchema],
  ["ShellBootstrapNotification", shellBootstrapNotificationSchema],
  ["ShellBootstrapData", shellBootstrapDataSchema],
  ["ShellBootstrapMeta", shellBootstrapMetaSchema],
  ["ShellBootstrapResponse", shellBootstrapResponseSchema],
  ["AppRouteMode", appRouteModeSchema],
  ["AppRouteRule", appRouteRuleSchema],
  ["AppConfigData", appConfigDataSchema],
  ["AppConfigMeta", appConfigMetaSchema],
  ["AppConfigResponse", appConfigResponseSchema],
  ["SyncMutation", syncMutationSchema],
  ["SyncPushBody", syncPushBodySchema],
  ["SyncChange", syncChangeSchema],
  ["SyncPullQuery", syncPullQuerySchema],
  ["SyncPullData", syncPullDataSchema],
  ["SyncMutationResult", syncMutationResultSchema],
  ["SyncPushData", syncPushDataSchema],
  ["SyncBootstrapData", syncBootstrapDataSchema],
  ["SyncResponseMeta", syncResponseMetaSchema],
  ["SyncPullResponse", syncPullResponseSchema],
  ["SyncPushResponse", syncPushResponseSchema],
  ["SyncBootstrapResponse", syncBootstrapResponseSchema],
] as const;
