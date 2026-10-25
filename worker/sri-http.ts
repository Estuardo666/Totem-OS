import { createServer } from "node:http";
import { processSriOnce } from "./index";
import { isWorkerRequestAuthorized } from "../src/lib/worker-auth";
import { assertSriWorkerDatabase } from "../src/lib/sri/execution-policy";

assertSriWorkerDatabase(process.env.SRI_AMBIENTE ?? "1", process.env.DATABASE_URL);
if (!process.env.FACTURACION_WORKER_SECRET || process.env.FACTURACION_WORKER_SECRET.length < 32) throw new Error("SRI_HTTP_SECRET_MISSING");
let busy = false;
const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  const send = (status: number, body: unknown) => { response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" }); response.end(JSON.stringify(body)); };
  if (request.method === "GET" && url.pathname === "/health") return send(200, { status: "ok", environment: process.env.SRI_AMBIENTE ?? "1", mode: "bounded-http", busy });
  if (request.method !== "POST" || url.pathname !== "/process") return send(404, { error: "not_found" });
  if (!isWorkerRequestAuthorized(request.headers.authorization ?? null, process.env.FACTURACION_WORKER_SECRET)) return send(401, { error: "unauthorized" });
  if (busy) return send(409, { error: "busy" });
  busy = true;
  try { return send(200, await processSriOnce()); }
  catch { return send(503, { error: "processing_unavailable" }); }
  finally { busy = false; }
});
server.requestTimeout = 90_000;
server.listen(Number(process.env.PORT ?? 3082), "0.0.0.0");
