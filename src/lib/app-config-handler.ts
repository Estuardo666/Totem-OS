import { apiSuccess, type ApiRequestContext } from "@/lib/api-kernel";
import { loadAppConfig } from "@/lib/app-config-service";

export async function handleAppConfig(context: ApiRequestContext): Promise<Response> {
  if (!context.actor) throw new Error("App config handler requires an authenticated actor.");
  return apiSuccess(context, await loadAppConfig(context.actor));
}
