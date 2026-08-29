import { QueryClient } from "@tanstack/react-query";
import { TotemApiClient, TotemApiError } from "../generated/api-client.ts";

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
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "",
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
