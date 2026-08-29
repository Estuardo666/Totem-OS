import { handleSyncPush } from "@/lib/sync-handler";
import { withApiProtection } from "@/lib/api-protection";
import { API_CAPABILITIES } from "@/lib/api-actor";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = withApiProtection(handleSyncPush, { requiredCapability: API_CAPABILITIES.dashboardRead, csrf: true, rateLimit: { bucket: "sync.push", limit: 60, windowMs: 60 * 1000 } });
