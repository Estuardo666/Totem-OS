import type { ContentTaskStatus } from "@/types";

type UpdateTaskStatusResult = {
  success: boolean;
  error?: string;
};

export async function updateTaskStatusRequest(
  taskId: string,
  newStatus: ContentTaskStatus
): Promise<UpdateTaskStatusResult> {
  const response = await fetch("/api/content/tasks/status", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ taskId, newStatus }),
  });

  const result = (await response.json().catch(() => null)) as UpdateTaskStatusResult | null;

  if (!result) {
    return {
      success: false,
      error: "No se pudo interpretar la respuesta del servidor",
    };
  }

  return result;
}