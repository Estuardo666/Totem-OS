import { API_CAPABILITIES } from "@/lib/api-actor";
import { withApiProtection } from "@/lib/api-protection";
import { handleDashboard } from "@/lib/dashboard-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiProtection(handleDashboard, {
  requiredCapability: API_CAPABILITIES.dashboardRead,
  rateLimit: {
    bucket: "dashboard.read",
    limit: 60,
    windowMs: 60 * 1000,
  },
});
