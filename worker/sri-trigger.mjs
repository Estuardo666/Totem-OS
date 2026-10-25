const url = process.env.SRI_PROCESS_URL;
const secret = process.env.FACTURACION_WORKER_SECRET;
if (!url || !secret || new URL(url).protocol !== 'https:') throw new Error('SRI_TRIGGER_CONFIG_MISSING');
const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${secret}` }, redirect: 'error', signal: AbortSignal.timeout(90_000) });
console.log(JSON.stringify({ status: response.status, ok: response.ok }));
if (!response.ok && response.status !== 409) process.exitCode = 1;
