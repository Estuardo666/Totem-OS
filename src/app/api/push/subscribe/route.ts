import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { checkRateLimit, getClientIP } from "@/lib/rate-limiter";

/**
 * Los valores del body llegan como JSON arbitrario. Si se pasan sin validar a
 * `where`, Prisma acepta objetos de filtro ({ not: "" }, { contains: "" }...) y
 * un atacante puede ampliar el alcance de la consulta. Validar a string es lo
 * que impide esa inyección de operadores.
 */
const endpointSchema = z.string().trim().min(1).max(2048).url();

const subscribeSchema = z.object({
  endpoint: endpointSchema,
  keys: z.object({
    p256dh: z.string().trim().min(1).max(512),
    auth: z.string().trim().min(1).max(512),
  }),
});

const unsubscribeSchema = z.object({ endpoint: endpointSchema });

/**
 * POST /api/push/subscribe
 * Upserts a Web Push subscription.
 * Keys (endpoint, p256dh, auth) are base64url strings from the browser — stored as-is.
 */
export async function POST(request: Request) {
  try {
    // Rate limiting: 10 requests per minute per IP
    const clientIP = getClientIP(request);
    const rateLimitResult = checkRateLimit(clientIP, "push-subscribe", 10, 60 * 1000);

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: "Demasiados intentos. Inténtalo más tarde.", retryAfter: rateLimitResult.retryAfter },
        { status: 429, headers: { "Retry-After": (rateLimitResult.retryAfter ?? 60).toString() } }
      );
    }

    const parsed = subscribeSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: "endpoint, keys.p256dh y keys.auth son requeridos y deben ser texto" },
        { status: 400 }
      );
    }

    const { endpoint, keys } = parsed.data;

    // Get current session (optional — guests can subscribe too)
    const session = await auth();
    const userId = session?.user?.id ?? null;
    const role = session?.user?.roleLegacy ?? null;

    // Upsert: same endpoint → update keys/lastSeenAt
    const result = await db.pushSubscription.upsert({
      where: { endpoint },
      update: {
        p256dh: keys.p256dh,
        auth: keys.auth,
        userId,
        role,
        lastSeenAt: new Date(),
      },
      create: {
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userId,
        role,
      },
    });

    return NextResponse.json({
      success: true,
      data: { id: result.id },
    });
  } catch (error) {
    console.error("[Push Subscribe] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al suscribir" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/push/subscribe
 * Removes a subscription by endpoint.
 */
export async function DELETE(request: Request) {
  try {
    const clientIP = getClientIP(request);
    const rateLimitResult = checkRateLimit(clientIP, "push-unsubscribe", 10, 60 * 1000);

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: "Demasiados intentos. Inténtalo más tarde.", retryAfter: rateLimitResult.retryAfter },
        { status: 429, headers: { "Retry-After": (rateLimitResult.retryAfter ?? 60).toString() } }
      );
    }

    const parsed = unsubscribeSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: "endpoint es requerido y debe ser texto" }, { status: 400 });
    }

    const { endpoint } = parsed.data;

    await db.pushSubscription.deleteMany({ where: { endpoint } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Push Unsubscribe] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al desuscribir" },
      { status: 500 }
    );
  }
}
