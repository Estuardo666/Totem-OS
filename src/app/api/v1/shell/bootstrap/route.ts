import { API_CAPABILITIES } from "@/lib/api-actor";
import { withApiProtection } from "@/lib/api-protection";
import { handleShellBootstrap } from "@/lib/shell-bootstrap-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiProtection(handleShellBootstrap, {
  requiredCapability: API_CAPABILITIES.dashboardRead,
  rateLimit: {
    bucket: "shell.bootstrap",
    limit: 120,
    windowMs: 60 * 1000,
  },
});
