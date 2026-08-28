import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncCalendarEventsToShoots } from "@/lib/calendar-to-shoot-sync";

/**
 * Google Calendar Webhook Endpoint
 *
 * Google Calendar sends push notifications here when events change.
 * Headers sent by Google:
 * - X-Goog-Channel-ID: The channel ID we registered
 * - X-Goog-Resource-State: "sync" (handshake), "exists" (change), "not_exists" (deleted)
 * - X-Goog-Resource-ID: Opaque resource ID
 * - X-Goog-Channel-Token: Our verification token
 * - X-Goog-Resource-URI: The resource URI
 *
 * Docs: https://developers.google.com/calendar/api/guides/push
 */
export async function POST(request: NextRequest) {
  try {
    const channelId = request.headers.get("x-goog-channel-id");
    const resourceState = request.headers.get("x-goog-resource-state");
    const channelToken = request.headers.get("x-goog-channel-token");

    // 1. Validate required headers
    if (!channelId) {
      return new NextResponse(null, { status: 200 }); // Always return 200 to Google
    }

    // 2. Handle sync handshake (first notification after watch registration)
    if (resourceState === "sync") {
      console.log(`[Calendar Webhook] Sync handshake for channel ${channelId}`);
      return new NextResponse(null, { status: 200 });
    }

    // 3. Find the user associated with this channel
    const token = await (db as any).googleCalendarToken.findFirst({
      where: { channelId },
      select: { userId: true, channelExpiration: true },
    });

    if (!token) {
      console.warn(`[Calendar Webhook] Unknown channel: ${channelId}`);
      return new NextResponse(null, { status: 200 });
    }

    // 4. Verify channel hasn't expired
    if (token.channelExpiration && new Date(token.channelExpiration) < new Date()) {
      console.warn(`[Calendar Webhook] Expired channel: ${channelId}`);
      return new NextResponse(null, { status: 200 });
    }

    // 5. Verify token if we set one
    const expectedToken = process.env.GOOGLE_CALENDAR_WEBHOOK_SECRET;
    if (!expectedToken) {
      // Sin secreto configurado no hay forma de verificar el origen: se ignora
      // la notificacion en vez de procesarla a ciegas.
      console.error("[Calendar Webhook] GOOGLE_CALENDAR_WEBHOOK_SECRET no configurado; notificacion ignorada");
      return new NextResponse(null, { status: 200 });
    }
    if (channelToken !== expectedToken) {
      console.warn(`[Calendar Webhook] Token mismatch for channel ${channelId}`);
      return new NextResponse(null, { status: 200 });
    }

    // 6. Process the change
    if (resourceState === "exists") {
      console.log(`[Calendar Webhook] Change detected for user ${token.userId}, syncing...`);

      // Run sync in background — don't block the response to Google
      syncCalendarEventsToShoots(token.userId).catch((error) => {
        console.error(`[Calendar Webhook] Sync error for user ${token.userId}:`, error);
      });
    }

    // Always return 200 — Google retries on non-2xx
    return new NextResponse(null, { status: 200 });
  } catch (error) {
    console.error("[Calendar Webhook] Unexpected error:", error);
    return new NextResponse(null, { status: 200 });
  }
}

/**
 * GET handler for testing
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Google Calendar webhook endpoint is active",
    timestamp: new Date().toISOString(),
  });
}
