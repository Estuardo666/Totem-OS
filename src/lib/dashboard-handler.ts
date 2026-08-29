import { apiSuccess, type ApiRequestContext } from "./api-kernel.ts";
import { loadDashboard } from "./dashboard-service.ts";

export async function handleDashboard(context: ApiRequestContext) {
  if (!context.actor) throw new Error("Dashboard actor is missing after API protection");
  return apiSuccess(context, await loadDashboard(context.actor));
}
