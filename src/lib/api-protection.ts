import {
  ApiProblem,
  withApiKernel,
  type ApiHandler,
  type ApiRequestContext,
} from "./api-kernel.ts";
import {
  apiActorFromSession,
  hasApiCapability,
  type ApiActor,
  type ApiCapability,
  type ApiSessionLike,
} from "./api-actor.ts";
import {
  attachCsrfCookie,
  validateCsrf,
} from "./api-csrf.ts";
import {
  checkDistributedRateLimit,
  RateLimitStoreError,
  type DistributedRateLimitOptions,
  type DistributedRateLimitResult,
} from "./api-rate-limiter.ts";
import { getClientIP } from "./rate-limiter.ts";

export type ApiActorResolver = (request: Request) => Promise<ApiActor | null>;
export type ApiRateLimitChecker = (
  options: DistributedRateLimitOptions
) => Promise<DistributedRateLimitResult>;

export interface ApiProtectionOptions {
  requiredCapability?: ApiCapability;
  resolveActor?: ApiActorResolver;
  csrf?: boolean;
  rateLimit?: {
    bucket: string;
    limit: number;
    windowMs: number;
    identifier?: (context: ApiRequestContext) => string;
    check?: ApiRateLimitChecker;
  };
}

function hasSessionCookie(request: Request): boolean {
  const cookie = request.headers.get("cookie") ?? "";
  return /(?:^|;\s*)(?:authjs|next-auth)\.session-token=/.test(cookie)
    || /(?:^|;\s*)__Secure-(?:authjs|next-auth)\.session-token=/.test(cookie);
}

function authenticationProblem(request: Request): ApiProblem {
  const expired = hasSessionCookie(request);
  return new ApiProblem({
    status: 401,
    code: expired ? "SESSION_EXPIRED" : "UNAUTHENTICATED",
    title: expired ? "Session expired" : "Authentication required",
    detail: expired
      ? "The Auth.js session is expired or invalid. Sign in again."
      : "A valid Auth.js session is required.",
    headers: { "www-authenticate": "Bearer, Cookie" },
  });
}

function forbiddenProblem(capability: ApiCapability): ApiProblem {
  return new ApiProblem({
    status: 403,
    code: "FORBIDDEN",
    title: "Forbidden",
    detail: `The actor does not have capability ${capability}.`,
  });
}

function rateLimitProblem(
  result: DistributedRateLimitResult,
  limit: number
): ApiProblem {
  const retryAfter = result.retryAfter ?? 1;
  return new ApiProblem({
    status: 429,
    code: "RATE_LIMITED",
    title: "Too Many Requests",
    detail: "Rate limit exceeded. Retry after the indicated delay.",
    retryAfter,
    headers: {
      "retry-after": String(retryAfter),
      "x-ratelimit-limit": String(limit),
      "x-ratelimit-remaining": "0",
      "x-ratelimit-reset": String(Math.ceil(result.resetTime / 1000)),
    },
  });
}

function defaultIdentifier(context: ApiRequestContext): string {
  return context.actor?.userId ?? getClientIP(context.request);
}

async function defaultActorResolver(request: Request): Promise<ApiActor | null> {
  // Importación diferida: las pruebas y los handlers técnicos pueden inyectar
  // un resolver sin inicializar Prisma/Auth.js en el proceso de test.
  const { auth } = await import("@/auth");
  const session = await auth();
  return apiActorFromSession(session as ApiSessionLike | null);
}

/**
 * Composición única para endpoints v1: autenticación, capacidad, CSRF y rate
 * limit. El orden es deliberado: limitar por identidad/IP antes de ejecutar el
 * caso de uso, y rechazar cualquier capacidad no declarada.
 */
export function withApiProtection(
  handler: ApiHandler,
  options: ApiProtectionOptions = {}
) {
  const resolveActor = options.resolveActor ?? defaultActorResolver;
  const rateLimitCheck = options.rateLimit?.check ?? checkDistributedRateLimit;

  return withApiKernel(async (context) => {
    const actor = await resolveActor(context.request);
    if (actor) context.actor = actor;

    if (options.rateLimit) {
      const identifier = options.rateLimit.identifier?.(context) ?? defaultIdentifier(context);
      let result: DistributedRateLimitResult;
      try {
        result = await rateLimitCheck({
          identifier,
          bucket: options.rateLimit.bucket,
          limit: options.rateLimit.limit,
          windowMs: options.rateLimit.windowMs,
        });
      } catch (error) {
        if (error instanceof RateLimitStoreError) {
          throw new ApiProblem({
            status: 503,
            code: "RATE_LIMIT_STORE_UNAVAILABLE",
            title: "Rate limit unavailable",
            detail: "The request cannot be processed while rate limiting is unavailable.",
            headers: { "retry-after": "30" },
          });
        }
        throw error;
      }
      if (!result.allowed) throw rateLimitProblem(result, options.rateLimit.limit);
    }

    if (!actor) throw authenticationProblem(context.request);
    if (options.requiredCapability && !hasApiCapability(actor, options.requiredCapability)) {
      throw forbiddenProblem(options.requiredCapability);
    }
    if (options.csrf) validateCsrf(context);

    return handler(context);
  }, {
    afterResponse: options.csrf ? attachCsrfCookie : undefined,
  });
}
