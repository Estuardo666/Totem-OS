import { apiSuccess, type ApiRequestContext } from "./api-kernel.ts";
import { loadShellBootstrap } from "./shell-bootstrap-service.ts";

export async function handleShellBootstrap(context: ApiRequestContext): Promise<Response> {
  if (!context.actor) {
    throw new Error("withApiProtection must attach an actor before shell bootstrap");
  }
  return apiSuccess(context, await loadShellBootstrap(context.actor));
}
