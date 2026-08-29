import { handleSyncBootstrap } from "@/lib/sync-handler";
import { withApiProtection } from "@/lib/api-protection";
import { API_CAPABILITIES } from "@/lib/api-actor";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = withApiProtection(handleSyncBootstrap, { requiredCapability: API_CAPABILITIES.dashboardRead, rateLimit: { bucket: "sync.bootstrap", limit: 30, windowMs: 60 * 1000 } });
