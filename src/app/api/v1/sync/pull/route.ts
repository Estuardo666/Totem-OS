import { handleSyncPull } from "@/lib/sync-handler";
import { withApiProtection } from "@/lib/api-protection";
import { API_CAPABILITIES } from "@/lib/api-actor";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = withApiProtection(handleSyncPull, { requiredCapability: API_CAPABILITIES.dashboardRead, rateLimit: { bucket: "sync.pull", limit: 120, windowMs: 60 * 1000 } });
