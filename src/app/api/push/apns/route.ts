import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  isAllowedApnsBundleId,
  registerApnsDeviceSchema,
  revokeApnsDeviceSchema,
} from "@/schemas/apns-device";
import {
  registerApnsInstallation,
  revokeApnsInstallation,
} from "@/lib/apns-device-service";

async function authenticatedUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function GET() {
  const userId = await authenticatedUserId();
  if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const installations = await db.apnsDeviceInstallation.findMany({
    where: { userId },
    select: {
      id: true,
      installationId: true,
      environment: true,
      bundleId: true,
      appVersion: true,
      appBuild: true,
      deviceModel: true,
      osVersion: true,
      locale: true,
      status: true,
      lastSeenAt: true,
      invalidatedAt: true,
    },
    orderBy: { lastSeenAt: "desc" },
  });

  return NextResponse.json({ success: true, data: installations });
}

export async function POST(request: Request) {
  const userId = await authenticatedUserId();
  if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const parsed = registerApnsDeviceSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Registro APNs invalido", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  if (!isAllowedApnsBundleId(parsed.data.bundleId, process.env.APNS_BUNDLE_ID)) {
    return NextResponse.json({ error: "Bundle de iOS no autorizado" }, { status: 403 });
  }

  const installation = await registerApnsInstallation(userId, parsed.data);
  return NextResponse.json({
    success: true,
    data: {
      id: installation.id,
      installationId: installation.installationId,
      environment: installation.environment,
      status: installation.status,
    },
  });
}

export async function DELETE(request: Request) {
  const userId = await authenticatedUserId();
  if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const parsed = revokeApnsDeviceSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Revocacion APNs invalida", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  await revokeApnsInstallation(userId, parsed.data.installationId, parsed.data.environment);
  return NextResponse.json({ success: true });
}
