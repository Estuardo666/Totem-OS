/** Invoice is already committed before this request. A transport failure leaves it queued. */
export async function triggerSriWorker() {
  const endpoint = process.env.SRI_PROCESS_URL;
  const secret = process.env.SRI_PROCESS_SECRET ?? process.env.FACTURACION_WORKER_SECRET;
  if (!endpoint || !secret) return { triggered: false };
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/process") return { triggered: false };
    const response = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${secret}` }, redirect: "error", signal: AbortSignal.timeout(45_000) });
    return { triggered: response.ok };
  } catch { return { triggered: false }; }
}
