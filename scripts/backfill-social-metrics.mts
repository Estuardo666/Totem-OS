/**
 * Backfill único de métricas sociales.
 *
 * La corrida diaria del cron solo rellena los últimos días. Este script trae
 * la ventana completa que Meta permite (90 días) y, sobre todo, reconstruye
 * las métricas de Instagram que Graph solo entrega como total de un período:
 * esas exigen una petición por día, así que aquí se pagan de una vez en lugar
 * de encarecer el cron.
 *
 *   npx tsx scripts/backfill-social-metrics.mts            # todos los clientes
 *   npx tsx scripts/backfill-social-metrics.mts <clientId> # uno solo
 *   npx tsx scripts/backfill-social-metrics.mts --days=28 --totals=14
 *
 * Es idempotente: todo se guarda con upsert sobre la misma clave, así que
 * volver a correrlo actualiza en vez de duplicar. Va en serie a propósito —
 * varias llamadas concurrentes sobre el mismo token multiplican el golpe al
 * rate limit de Meta.
 */

import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const { db } = await import("@/lib/db");
const { runClientSync } = await import("@/lib/meta/sync-orchestrator");

function readFlag(name: string, fallback: number): number {
  const raw = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (!raw) return fallback;
  const value = Number(raw.split("=")[1]);
  return Number.isInteger(value) && value >= 1 && value <= 90 ? value : fallback;
}

const targetClientId = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
const days = readFlag("days", 90);
const totalsDays = readFlag("totals", 28);
const mediaLimit = readFlag("media", 50);

const clients = await db.client.findMany({
  where: targetClientId
    ? { id: targetClientId }
    : {
        status: { not: "INACTIVE" },
        OR: [
          { facebookPageId: { not: null } },
          { instagramBusinessId: { not: null } },
          { tiktokOpenId: { not: null } },
          { adAccounts: { some: { isActive: true } } },
        ],
      },
  select: { id: true, name: true },
  orderBy: { name: "asc" },
});

console.log(
  `Backfill de ${clients.length} cliente(s) · ${days} días · ${totalsDays} días de totales de Instagram`
);

let totalRows = 0;

for (const [index, client] of clients.entries()) {
  const startedAt = Date.now();
  try {
    const result = await runClientSync(client.id, { days, totalsDays, mediaLimit });
    const rows = result.data?.total ?? 0;
    totalRows += rows;
    const detail =
      result.data?.results.map((r) => `${r.platform}=${r.status}`).join(" ") ?? result.error;
    console.log(
      `[${index + 1}/${clients.length}] ${client.name}: ${rows} filas en ${Math.round((Date.now() - startedAt) / 1000)}s | ${detail}`
    );
  } catch (error) {
    // Un cliente que falle no puede impedir el backfill de los demás.
    console.error(`[${index + 1}/${clients.length}] ${client.name}: ${(error as Error).message}`);
  }
}

console.log(`Listo. ${totalRows} filas escritas.`);
await db.$disconnect();
process.exit(0);
