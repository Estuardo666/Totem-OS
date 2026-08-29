import { handleAppConfig } from "@/lib/app-config-handler";
import { withApiProtection } from "@/lib/api-protection";
import { API_CAPABILITIES } from "@/lib/api-actor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiProtection(handleAppConfig, {
  requiredCapability: API_CAPABILITIES.dashboardRead,
  rateLimit: { bucket: "app.config", limit: 30, windowMs: 60 * 1000 },
});
