import { QueryClient } from "@tanstack/react-query";
import { TotemApiClient, TotemApiError } from "../generated/api-client.ts";

/**
 * The browser API lives in this Next.js app, so cross-origin public API hosts
 * cannot carry the app's session cookie. Keep same-origin values when they are
 * valid, and fall back to relative requests when deployment configuration
 * points at another host.
 */
export function resolveTotemApiBaseUrl(
  configuredBaseUrl: string | undefined = process.env.NEXT_PUBLIC_API_BASE_URL,
  runtimeOrigin?: string,
): string {
  if (!runtimeOrigin) return configuredBaseUrl ?? "";
  if (!configuredBaseUrl) return "";

  try {
    const configuredUrl = new URL(configuredBaseUrl, runtimeOrigin);
    return configuredUrl.origin === runtimeOrigin ? configuredBaseUrl : "";
  } catch {
    return "";
  }
}

export const queryKeys = {
  shell: {
    all: ["shell"] as const,
    bootstrap: () => ["shell", "bootstrap"] as const,
  },
  appConfig: {
    all: ["app-config"] as const,
    detail: () => ["app-config", "detail"] as const,
  },
  sync: {
    all: ["sync"] as const,
    bootstrap: () => ["sync", "bootstrap"] as const,
    pull: (cursor: string | undefined) => ["sync", "pull", cursor ?? "head"] as const,
  },
  dashboard: {
    all: ["dashboard"] as const,
    detail: () => ["dashboard", "detail"] as const,
  },
} as const;

export const totemApiClient = new TotemApiClient({
  baseUrl: resolveTotemApiBaseUrl(
    process.env.NEXT_PUBLIC_API_BASE_URL,
    typeof window === "undefined" ? undefined : window.location.origin,
  ),
});

function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof TotemApiError) {
    if ([400, 401, 403, 404, 409, 422].includes(error.status)) return false;
    if (error.status === 429) return failureCount < 1;
  }
  return failureCount < 2;
}

function retryDelay(attemptIndex: number, error: unknown): number {
  if (error instanceof TotemApiError && error.problem?.retryAfter) {
    return Math.min(error.problem.retryAfter * 1000, 30_000);
  }
  return Math.min(1_000 * 2 ** attemptIndex, 30_000);
}

export function createTotemQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: shouldRetry,
        retryDelay,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
