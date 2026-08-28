import { ZodError, type ZodType } from "zod";
import type { ApiActor } from "./api-actor.ts";

export const API_REQUEST_ID_HEADER = "x-request-id";
export const API_DEFAULT_PAGE_SIZE = 25;
export const API_MAX_PAGE_SIZE = 100;
export const API_MAX_PAYLOAD_BYTES = 1024 * 1024;

export type ApiProblemCode =
  | "UNAUTHENTICATED"
  | "SESSION_EXPIRED"
  | "FORBIDDEN"
  | "CSRF_FAILED"
  | "RATE_LIMITED"
  | "RATE_LIMIT_STORE_UNAVAILABLE"
  | "INVALID_JSON"
  | "INVALID_CONTENT_LENGTH"
  | "VALIDATION_ERROR"
  | "PAYLOAD_TOO_LARGE"
  | "INVALID_CURSOR"
  | "INVALID_PAGINATION"
  | "METHOD_NOT_ALLOWED"
  | "INTERNAL_ERROR";

export interface ApiRequestContext {
  request: Request;
  requestId: string;
  startedAt: number;
  actor?: ApiActor;
}

export interface ApiMeta {
  requestId: string;
  [key: string]: unknown;
}

export interface ApiProblemBody {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  code: ApiProblemCode;
  requestId: string;
  retryAfter?: number;
  errors?: Array<{
    path: Array<string | number>;
    code: string;
    message: string;
  }>;
}

export interface ApiProblemOptions {
  status: number;
  code: ApiProblemCode;
  title: string;
  detail: string;
  errors?: ApiProblemBody["errors"];
  headers?: Record<string, string>;
  retryAfter?: number;
}

/** Error tipado que el kernel puede convertir en Problem Details. */
export class ApiProblem extends Error {
  readonly status: number;
  readonly code: ApiProblemCode;
  readonly title: string;
  readonly errors?: ApiProblemBody["errors"];
  readonly headers?: Record<string, string>;
  readonly retryAfter?: number;

  constructor(options: ApiProblemOptions) {
    super(options.detail);
    this.name = "ApiProblem";
    this.status = options.status;
    this.code = options.code;
    this.title = options.title;
    this.errors = options.errors;
    this.headers = options.headers;
    this.retryAfter = options.retryAfter;
  }
}

function createRequestId(): string {
  return globalThis.crypto.randomUUID();
}

function getRequestId(request: Request): string {
  const candidate = request.headers.get(API_REQUEST_ID_HEADER)?.trim();
  // Se acepta un ID trazable, pero no valores con salto de línea ni tamaños
  // capaces de inflar logs o headers de respuesta.
  if (candidate && candidate.length <= 128 && /^[A-Za-z0-9._:-]+$/.test(candidate)) {
    return candidate;
  }
  return createRequestId();
}

export function createApiRequestContext(request: Request): ApiRequestContext {
  return {
    request,
    requestId: getRequestId(request),
    startedAt: Date.now(),
  };
}

function baseHeaders(context: ApiRequestContext, contentType: string): Headers {
  const headers = new Headers({
    "content-type": contentType,
    [API_REQUEST_ID_HEADER]: context.requestId,
    "cache-control": "no-store",
  });
  return headers;
}

export function apiSuccess<T>(
  context: ApiRequestContext,
  data: T,
  meta: Record<string, unknown> = {},
  status = 200
): Response {
  const body = {
    data,
    meta: {
      ...meta,
      requestId: context.requestId,
    } satisfies ApiMeta,
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: baseHeaders(context, "application/json; charset=utf-8"),
  });
}

function problemType(code: ApiProblemCode): string {
  return `https://totem-os.com/problems/${code.toLowerCase().replaceAll("_", "-")}`;
}

export function apiProblemResponse(
  context: ApiRequestContext,
  problem: unknown
): Response {
  const normalized = problem instanceof ApiProblem
    ? problem
    : new ApiProblem({
        status: 500,
        code: "INTERNAL_ERROR",
        title: "Internal Server Error",
        detail: "An unexpected error occurred.",
      });

  const body: ApiProblemBody = {
    type: problemType(normalized.code),
    title: normalized.title,
    status: normalized.status,
    detail: normalized.message,
    instance: new URL(context.request.url).pathname,
    code: normalized.code,
    requestId: context.requestId,
    ...(normalized.retryAfter === undefined ? {} : { retryAfter: normalized.retryAfter }),
    ...(normalized.errors ? { errors: normalized.errors } : {}),
  };

  const headers = baseHeaders(context, "application/problem+json");
  for (const [name, value] of Object.entries(normalized.headers ?? {})) {
    headers.set(name, value);
  }

  return new Response(JSON.stringify(body), {
    status: normalized.status,
    headers,
  });
}

export type ApiHandler = (context: ApiRequestContext) => Response | Promise<Response>;
export type ApiResponseTransformer = (
  response: Response,
  context: ApiRequestContext
) => Response | Promise<Response>;

export interface ApiKernelOptions {
  afterResponse?: ApiResponseTransformer;
}

/** Añade contexto, request ID y conversión uniforme de errores a cualquier ruta. */
export function withApiKernel(handler: ApiHandler, options: ApiKernelOptions = {}) {
  return async (request: Request): Promise<Response> => {
    const context = createApiRequestContext(request);
    try {
      const response = await handler(context);
      return options.afterResponse ? await options.afterResponse(response, context) : response;
    } catch (error) {
      return apiProblemResponse(context, error);
    }
  };
}

function validationErrors(error: ZodError): ApiProblemBody["errors"] {
  return error.issues.map((issue) => ({
    path: issue.path,
    code: issue.code,
    message: issue.message,
  }));
}

export function validationProblem(error: ZodError): ApiProblem {
  return new ApiProblem({
    status: 400,
    code: "VALIDATION_ERROR",
    title: "Request validation failed",
    detail: "One or more request fields are invalid.",
    errors: validationErrors(error),
  });
}

/** Lee y valida JSON respetando el límite antes y después de consumir el body. */
export async function readJsonBody<T>(
  context: ApiRequestContext,
  schema: ZodType<T>,
  maxBytes = API_MAX_PAYLOAD_BYTES
): Promise<T> {
  const contentLengthHeader = context.request.headers.get("content-length");
  if (contentLengthHeader !== null) {
    const contentLength = Number(contentLengthHeader);
    if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
      throw new ApiProblem({
        status: 400,
        code: "INVALID_CONTENT_LENGTH",
        title: "Invalid Content-Length",
        detail: "The Content-Length header must be a non-negative integer.",
      });
    }
    if (contentLength > maxBytes) {
      throw new ApiProblem({
        status: 413,
        code: "PAYLOAD_TOO_LARGE",
        title: "Payload Too Large",
        detail: `The request body exceeds the ${maxBytes} byte limit.`,
      });
    }
  }

  const bytes = new Uint8Array(await context.request.arrayBuffer());
  if (bytes.byteLength > maxBytes) {
    throw new ApiProblem({
      status: 413,
      code: "PAYLOAD_TOO_LARGE",
      title: "Payload Too Large",
      detail: `The request body exceeds the ${maxBytes} byte limit.`,
    });
  }

  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new ApiProblem({
      status: 400,
      code: "INVALID_JSON",
      title: "Invalid JSON",
      detail: "The request body must contain valid JSON.",
    });
  }

  const result = schema.safeParse(value);
  if (!result.success) {
    throw validationProblem(result.error);
  }
  return result.data;
}

export interface CursorPage {
  cursor: string | null;
  limit: number;
}

export function parseCursorPage(url: URL): CursorPage {
  const rawLimit = url.searchParams.get("limit");
  if (rawLimit !== null && !/^\d+$/u.test(rawLimit)) {
    throw new ApiProblem({
      status: 400,
      code: "INVALID_PAGINATION",
      title: "Invalid pagination",
      detail: `limit must be an integer between 1 and ${API_MAX_PAGE_SIZE}.`,
    });
  }
  const limit = rawLimit === null ? API_DEFAULT_PAGE_SIZE : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > API_MAX_PAGE_SIZE) {
    throw new ApiProblem({
      status: 400,
      code: "INVALID_PAGINATION",
      title: "Invalid pagination",
      detail: `limit must be an integer between 1 and ${API_MAX_PAGE_SIZE}.`,
    });
  }

  const cursor = url.searchParams.get("cursor");
  if (cursor !== null && (cursor.length === 0 || cursor.length > 512)) {
    throw new ApiProblem({
      status: 400,
      code: "INVALID_CURSOR",
      title: "Invalid cursor",
      detail: "cursor must be a non-empty opaque value no longer than 512 characters.",
    });
  }

  return { cursor, limit };
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("invalid base64url");
  const padded = value.replaceAll("-", "+").replaceAll("_", "/")
    + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

/** Crea cursores opacos; el payload queda encapsulado y nunca se expone en la URL. */
export function encodeCursor<T>(value: T): string {
  const serialized = JSON.stringify(value);
  return bytesToBase64Url(new TextEncoder().encode(serialized));
}

export function decodeCursor<T>(cursor: string, schema: ZodType<T>): T {
  try {
    const value = JSON.parse(new TextDecoder().decode(base64UrlToBytes(cursor)));
    const result = schema.safeParse(value);
    if (!result.success) throw new Error("invalid cursor payload");
    return result.data;
  } catch {
    throw new ApiProblem({
      status: 400,
      code: "INVALID_CURSOR",
      title: "Invalid cursor",
      detail: "The cursor is malformed or expired.",
    });
  }
}

export function methodNotAllowed(allowed: string[]): ApiProblem {
  return new ApiProblem({
    status: 405,
    code: "METHOD_NOT_ALLOWED",
    title: "Method Not Allowed",
    detail: `Allowed methods: ${allowed.join(", ")}.`,
  });
}
