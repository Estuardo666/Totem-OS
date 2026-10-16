import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import QRCode from "qrcode";

export type WhatsAppHealthState = { connected: boolean; connectedId?: string | null; qr: string | null; startedAt: Date; lastHeartbeatAt: Date | null; disabled: boolean; lockHeld: boolean; pairingOnly?: boolean };

export function startHealthServer(state: WhatsAppHealthState, port = Number(process.env.PORT ?? process.env.WA_PORT ?? 3081)) {
  const server = createServer(async (request, response) => {
    const path = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`).pathname;
    if (request.method !== "GET" || !["/health", "/health/live", "/health/qr"].includes(path)) return sendJson(response, 404, { error: "not_found" });
    if (path === "/health/qr") {
      if (!safeToken(request, process.env.WA_HEALTH_TOKEN)) return sendJson(response, 401, { error: "unauthorized" });
      if (state.disabled || !state.qr || state.connected) return sendJson(response, 404, { error: "qr_unavailable" });
      try {
        const png = await QRCode.toBuffer(state.qr, { type: "png", width: 480, margin: 2 });
        response.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" });
        response.end(png);
      } catch { sendJson(response, 500, { error: "qr_unavailable" }); }
      return;
    }
    const heartbeatFresh = state.lastHeartbeatAt !== null && Date.now() - state.lastHeartbeatAt.getTime() < 90_000;
    if (path === "/health/live") {
      const live = state.lockHeld && heartbeatFresh;
      sendJson(response, live ? 200 : 503, {
        status: live ? "live" : state.lockHeld ? "heartbeat_stale" : "lock_unavailable",
        connected: state.connected,
        pairingOnly: state.pairingOnly ?? false,
        connectedId: state.connectedId ?? null,
        disabled: state.disabled,
        lastHeartbeatAt: state.lastHeartbeatAt?.toISOString() ?? null,
      });
      return;
    }
    const healthy = state.lockHeld && heartbeatFresh && (state.disabled || state.connected);
    sendJson(response, healthy ? 200 : 503, {
      status: healthy ? state.disabled ? "disabled" : "ok" : state.lockHeld ? "disconnected" : "lock_unavailable",
      connected: state.connected,
      pairingOnly: state.pairingOnly ?? false,
      connectedId: state.connectedId ?? null,
      disabled: state.disabled,
      qrAvailable: Boolean(state.qr) && !state.connected,
      uptimeSeconds: Math.floor((Date.now() - state.startedAt.getTime()) / 1000),
      lastHeartbeatAt: state.lastHeartbeatAt?.toISOString() ?? null,
    });
  });
  server.listen(port, "0.0.0.0");
  return server;
}

function safeToken(request: IncomingMessage, expected?: string): boolean {
  if (!expected) return false;
  const provided = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`).searchParams.get("token") ?? "";
  const bearer = (request.headers.authorization ?? "").match(/^Bearer\s+(.+)$/i)?.[1] ?? "";
  const right = Buffer.from(expected);
  return [provided, bearer].some((candidate) => {
    const left = Buffer.from(candidate);
    return left.length === right.length && timingSafeEqual(left, right);
  });
}

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  response.end(JSON.stringify(body));
}
