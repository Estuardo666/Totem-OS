import { handleKernelEcho } from "@/lib/api-kernel-demo";
import { withApiProtection } from "@/lib/api-protection";
import { API_CAPABILITIES } from "@/lib/api-actor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const rateLimit = {
  bucket: "kernel.echo",
  limit: 60,
  windowMs: 60 * 1000,
};

export const GET = withApiProtection(handleKernelEcho, {
  requiredCapability: API_CAPABILITIES.kernelEchoRead,
  csrf: true,
  rateLimit,
});

export const POST = withApiProtection(handleKernelEcho, {
  requiredCapability: API_CAPABILITIES.kernelEchoWrite,
  csrf: true,
  rateLimit,
});
