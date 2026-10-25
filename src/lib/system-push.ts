// Shared Node service for Next.js and the worker; this module is not a Server Action.
import { sendPush, type PushPayload, type SendTargetOptions } from "@/lib/web-push";

interface SendNotificationOptions {
  title: string;
  message: string;
  url?: string;
  userIds?: string[];
  segments?: string[]; // kept for compat, maps to "all" or role
  data?: Record<string, string>;
  imageUrl?: string;
}

export async function sendPushNotification(
  options: SendNotificationOptions
): Promise<{ success: boolean; data?: { sent: number; failed: number; cleaned: number }; error?: string }> {
  try {
    const payload: PushPayload = {
      title: options.title,
      body: options.message,
      url: options.url,
      image: options.imageUrl,
      data: options.data,
    };

    let target: SendTargetOptions;

    if (options.userIds && options.userIds.length > 0) {
      target = { userIds: options.userIds };
    } else if (options.segments && options.segments.length > 0) {
      if (options.segments.includes("Subscribed Users")) {
        target = { all: true };
      } else {
        // Treat segment names as roles (e.g., "ADMIN", "EDITOR")
        // For simplicity, send to all if multiple segments
        target = { all: true };
      }
    } else {
      // Default: send to all
      target = { all: true };
    }

    const result = await sendPush(payload, target);

    return {
      success: result.success,
      data: { sent: result.sent, failed: result.failed, cleaned: result.cleaned },
    };
  } catch (error) {
    console.error("[PushActions] sendPushNotification error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al enviar push",
    };
  }
}
