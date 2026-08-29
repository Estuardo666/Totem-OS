import { z } from "zod";

/**
 * Registro versionado de los contratos REST que ya pueden consumir React y
 * Swift. Las rutas futuras se incorporan aquí antes de generar clientes.
 */

export const API_CONTRACT_VERSION = "0.1.0";

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

export type ApiProblem = z.infer<typeof apiProblemSchema>;
export type KernelItem = z.infer<typeof kernelItemSchema>;
export type KernelEchoQuery = z.infer<typeof kernelEchoQuerySchema>;
export type KernelEchoBody = z.infer<typeof kernelEchoBodySchema>;
export type KernelEchoGetResponse = z.infer<typeof kernelEchoGetResponseSchema>;
export type KernelEchoPostResponse = z.infer<typeof kernelEchoPostResponseSchema>;

export type ApiContractResponse = {
  status: number;
  description: string;
  schemaName: "ApiProblem"
    | "KernelEchoGetResponse"
    | "KernelEchoPostResponse";
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
] as const;
