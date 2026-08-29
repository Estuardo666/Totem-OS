import { TotemApiError } from "../generated/api-client.ts";

export type ApiErrorViewModel = {
  title: string;
  message: string;
  code: string;
  status: number;
  requestId: string | null;
  retryable: boolean;
};

export function toApiErrorViewModel(error: unknown): ApiErrorViewModel {
  if (error instanceof TotemApiError) {
    const problem = error.problem;
    const status = error.status;
    const code = problem?.code ?? `HTTP_${status}`;
    return {
      title: problem?.title ?? "No se pudo completar la solicitud",
      message: problem?.detail ?? "Revisa tu conexión e inténtalo de nuevo.",
      code,
      status,
      requestId: problem?.requestId ?? null,
      retryable: status === 0 || status >= 500 || status === 429,
    };
  }

  const message = error instanceof Error ? error.message : "Error desconocido de API";
  return {
    title: "No se pudo completar la solicitud",
    message,
    code: "UNKNOWN",
    status: 0,
    requestId: null,
    retryable: true,
  };
}

export function isAuthenticationError(error: unknown): boolean {
  return error instanceof TotemApiError && (error.status === 401 || error.problem?.code === "SESSION_EXPIRED");
}

export function isConflictError(error: unknown): boolean {
  return error instanceof TotemApiError && (error.status === 409 || error.problem?.code === "CONFLICT");
}
