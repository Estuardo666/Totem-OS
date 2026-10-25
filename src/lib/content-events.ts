import "server-only";
import { pusherServer } from "@/lib/pusher";

/** A shared refresh signal must never contain task IDs, titles or bearer tokens. */
export async function publishContentRefresh(): Promise<void> {
  await pusherServer.trigger("private-content", "update-event", { refresh: true });
}
