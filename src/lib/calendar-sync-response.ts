export interface CalendarSyncPayload {
  created?: number;
  updated?: number;
  cancelled?: number;
  connected?: boolean;
  error?: unknown;
}

export interface CalendarSyncResponse {
  data: CalendarSyncPayload | null;
  errorMessage: string | null;
}

export async function parseCalendarSyncResponse(
  response: Pick<Response, "text" | "headers" | "status">
): Promise<CalendarSyncResponse> {
  const body = await response.text();

  try {
    const data: unknown = JSON.parse(body);
    if (data && typeof data === "object" && !Array.isArray(data)) {
      return { data: data as CalendarSyncPayload, errorMessage: null };
    }
  } catch {
    // Hosting and upstream errors are sometimes plain text.
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const plainText = contentType.includes("text/plain")
    ? body.replace(/\s+/g, " ").trim().slice(0, 200)
    : "";

  return {
    data: null,
    errorMessage: plainText
      ? `Respuesta del servidor: ${plainText}`
      : `El servidor devolvió una respuesta inválida (HTTP ${response.status}).`,
  };
}
