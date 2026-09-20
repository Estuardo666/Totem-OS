/**
 * Sondea qué métricas de Meta siguen siendo válidas HOY.
 *
 * Meta deprecó buena parte de las métricas de página y renombró varias de
 * Instagram. La documentación va por detrás; la fuente autoritativa es el
 * propio `error.message` del código 100, que enumera las métricas válidas.
 * Este script pide una métrica por petición para que el rechazo de una no
 * contamine el veredicto de las demás.
 *
 *   node --experimental-strip-types scripts/probe-meta-metrics.mjs <clientId>
 *
 * Se ejecuta a mano antes de tocar las constantes de los servicios. Nunca en
 * un cron: gasta una llamada por métrica candidata.
 */

import nextEnv from '@next/env';
import { PrismaClient } from '@prisma/client';

nextEnv.loadEnvConfig(process.cwd());

const { decryptToken } = await import('../src/lib/crypto/token-cipher.ts');

const GRAPH = 'https://graph.facebook.com/v21.0';
const TIMEOUT_MS = 15000;

const db = new PrismaClient();

/** Candidatas de página de Facebook, familia diaria. */
const FB_CANDIDATES = [
  'page_media_view',
  'page_post_engagements',
  'page_follows',
  'page_impressions',
  'page_impressions_unique',
  'page_impressions_paid',
  'page_impressions_organic_unique_v2',
  'page_views_total',
  'page_video_views',
  'page_video_views_unique',
  'page_fan_adds_unique',
  'page_fan_removes_unique',
  'page_daily_follows_unique',
  'page_daily_unfollows_unique',
  'page_actions_post_reactions_total',
  'page_total_actions',
  'page_fans',
];

/** Candidatas de Instagram. Cada una se prueba en sus dos familias. */
const IG_CANDIDATES = [
  'reach',
  'views',
  'impressions',
  'follower_count',
  'profile_views',
  'website_clicks',
  'accounts_engaged',
  'total_interactions',
  'likes',
  'comments',
  'saves',
  'shares',
  'replies',
  'profile_links_taps',
  'content_views',
];

/** Demografía: métrica + breakdown obligatorio. */
const IG_DEMOGRAPHIC_BREAKDOWNS = ['country', 'city', 'age', 'gender'];

async function graphGet(path, accessToken, params) {
  const url = new URL(`${GRAPH}/${path}`);
  url.search = new URLSearchParams(params).toString();

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: 'no-store',
  });

  const body = await response.json();
  if (!response.ok || body.error) {
    const error = new Error(body.error?.message ?? response.statusText);
    error.code = body.error?.code;
    throw error;
  }
  return body;
}

/** Cuenta los puntos devueltos: una métrica válida pero vacía también informa. */
function describePayload(body) {
  const entries = Array.isArray(body.data) ? body.data : [];
  if (entries.length === 0) return 'válida, sin datos en el período';
  const points = entries.reduce((sum, entry) => {
    if (Array.isArray(entry.values)) return sum + entry.values.length;
    if (entry.total_value) return sum + 1;
    return sum;
  }, 0);
  return `válida, ${points} punto(s)`;
}

async function probe(label, path, accessToken, params) {
  try {
    const body = await graphGet(path, accessToken, params);
    return { label, ok: true, detail: describePayload(body) };
  } catch (error) {
    return { label, ok: false, detail: `(#${error.code ?? '?'}) ${error.message}` };
  }
}

function printTable(title, results) {
  console.log(`\n=== ${title} ===`);
  const width = Math.max(...results.map((r) => r.label.length), 10);
  for (const result of results) {
    console.log(`${result.ok ? 'OK  ' : 'NO  '} ${result.label.padEnd(width)}  ${result.detail}`);
  }
  const valid = results.filter((r) => r.ok).map((r) => r.label);
  console.log(`\nVálidas (${valid.length}): ${valid.join(', ') || '—'}`);
}

async function main() {
  const clientId = process.argv[2];
  if (!clientId) {
    console.error('Uso: node --experimental-strip-types scripts/probe-meta-metrics.mjs <clientId>');
    process.exit(1);
  }

  const client = await db.client.findUnique({
    where: { id: clientId },
    select: {
      name: true,
      facebookPageId: true,
      instagramBusinessId: true,
      pageAccessToken: true,
    },
  });

  if (!client) {
    console.error(`No existe el cliente ${clientId}.`);
    process.exit(1);
  }
  if (!client.pageAccessToken) {
    console.error(`El cliente "${client.name}" no tiene token de página. Vincula la página primero.`);
    process.exit(1);
  }

  const token = decryptToken(client.pageAccessToken);
  const until = Math.floor(Date.now() / 1000);
  const since = until - 28 * 86400;
  const window = { since: String(since), until: String(until) };

  console.log(`Cliente: ${client.name}`);
  console.log(`Página: ${client.facebookPageId ?? '—'} · Instagram: ${client.instagramBusinessId ?? '—'}`);

  if (client.facebookPageId) {
    const results = [];
    for (const metric of FB_CANDIDATES) {
      results.push(
        await probe(metric, `${client.facebookPageId}/insights`, token, {
          metric,
          period: 'day',
          ...window,
        })
      );
    }
    printTable('Facebook · period=day', results);
  }

  if (client.instagramBusinessId) {
    const daily = [];
    const totals = [];
    for (const metric of IG_CANDIDATES) {
      daily.push(
        await probe(metric, `${client.instagramBusinessId}/insights`, token, {
          metric,
          period: 'day',
          ...window,
        })
      );
      totals.push(
        await probe(metric, `${client.instagramBusinessId}/insights`, token, {
          metric,
          metric_type: 'total_value',
          period: 'day',
          ...window,
        })
      );
    }
    printTable('Instagram · period=day', daily);
    printTable('Instagram · metric_type=total_value', totals);

    const demographics = [];
    for (const metric of ['follower_demographics', 'engaged_audience_demographics']) {
      for (const breakdown of IG_DEMOGRAPHIC_BREAKDOWNS) {
        demographics.push(
          await probe(`${metric}/${breakdown}`, `${client.instagramBusinessId}/insights`, token, {
            metric,
            period: 'lifetime',
            metric_type: 'total_value',
            breakdown,
          })
        );
      }
    }
    printTable('Instagram · demografía', demographics);
  }
}

main()
  .catch((error) => {
    console.error('Sondeo fallido:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
