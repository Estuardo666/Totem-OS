import { handleKernelEcho } from "@/lib/api-kernel-demo";
import { withApiKernel } from "@/lib/api-kernel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiKernel(handleKernelEcho);
export const POST = withApiKernel(handleKernelEcho);
