/**
 * Servicio de métricas publicitarias de Meta (Marketing API v21.0)
 *
 * Mismo contrato que el resto de servicios Meta: funciones puras, token en el
 * header Authorization, timeout explícito por petición y errores tipados
 * compartidos para que los `instanceof` del dispatcher funcionen.
 */

import {
  InsufficientPermissionsError,
  TokenExpiredError,
} from "./metrics-service.ts";

const GRAPH = "https://graph.facebook.com/v21.0";
const TIMEOUT_MS = 10000;
const PAGE_SIZE = 200;
const DEFAULT_MAX_PAGES = 10;

/**
 * Error de límite de peticiones.
 *
 * Se distingue de los demás porque la respuesta correcta no es reintentar en
 * línea sino saltar la plataforma y volver en la siguiente corrida.
 */
export class RateLimitedError extends Error {
  constructor(
    message: string = "Meta limitó temporalmente las consultas de anuncios. Se reintentará en la próxima sincronización."
  ) {
    super(message);
    this.name = "RateLimitedError";
  }
}

/**
 * Tipos de conversión en orden de prioridad.
 *
 * `actions[]` de Meta es heterogéneo y suele traer varios tipos a la vez. Se
 * toma el primero presente de esta lista para que "resultados" signifique lo
 * mismo campaña a campaña. El array crudo se conserva en `actionsJson`, así
 * que esta elección se puede revisar sin volver a sincronizar.
 */
export const CONVERSION_ACTION_TYPES = [
  "purchase",
  "omni_purchase",
  "offsite_conversion.fb_pixel_purchase",
  "lead",
  "onsite_conversion.messaging_conversation_started_7d",
  "link_click",
] as const;

export interface AdAction {
  action_type: string;
  value: string;
}

export interface AdInsightRow {
  campaign_id?: string;
  campaign_name?: string;
  objective?: string;
  date_start: string;
  date_stop: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  inline_link_clicks?: string;
  frequency?: string;
  account_currency?: string;
  actions?: AdAction[];
  action_values?: AdAction[];
}

export interface AdMetricRow {
  clientId: string;
  platform: string;
  adAccountId: string;
  campaignId: string;
  campaignName: string;
  date: Date;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  frequency: number;
  conversions: number;
  conversionValue: number;
  currency: string;
  objective: string | null;
  actionsJson: string | null;
}

export interface FetchAdInsightsOptions {
  /** Fecha YYYY-MM-DD en la zona horaria de la cuenta publicitaria. */
  since: string;
  /** Fecha YYYY-MM-DD, inclusive. */
  until: string;
  level?: "campaign" | "adset" | "ad";
  /** Tope de páginas para acotar una cuenta enorme. */
  maxPages?: number;
}

/** Fila de resumen a nivel cuenta. Evita NULL en la clave única. */
export const ACCOUNT_LEVEL_CAMPAIGN_ID = "__ACCOUNT__";

/**
 * Normaliza un id de cuenta publicitaria al prefijo `act_` que exige Graph.
 * Acepta tanto "act_123" como "123" porque ambas formas circulan en la app.
 */
export function normalizeAdAccountId(adAccountId: string): string {
  const trimmed = adAccountId.trim();
  return trimmed.startsWith("act_") ? trimmed : `act_${trimmed}`;
}

function toNumber(value: string | number | undefined | null): number {
  if (value === undefined || value === null) return 0;
  const parsed = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Detecta agotamiento del presupuesto de peticiones leyendo las cabeceras de
 * uso que Meta devuelve. Se corta en 90 para dejar margen antes del bloqueo.
 */
function isRateLimited(headers: Headers): boolean {
  const raw =
    headers.get("x-business-use-case-usage") ?? headers.get("x-ad-account-usage");
  if (!raw) return false;

  try {
    const parsed = JSON.parse(raw);
    const entries = Array.isArray(parsed) ? parsed : Object.values(parsed).flat();
    for (const entry of entries as Array<Record<string, unknown>>) {
      const callCount = Number(entry?.call_count ?? 0);
      const totalTime = Number(entry?.total_time ?? 0);
      const totalCpu = Number(entry?.total_cputime ?? 0);
      if (callCount > 90 || totalTime > 90 || totalCpu > 90) return true;
    }
  } catch {
    // Cabecera con formato inesperado: no es motivo para abortar.
  }
  return false;
}

function throwGraphError(
  result: { error?: { code?: number; message?: string } },
  fallback: string
): never {
  const code = result.error?.code;
  if (code === 190 || code === 102) throw new TokenExpiredError();
  if (code === 4 || code === 17 || code === 613) throw new RateLimitedError();
  if (code === 10 || code === 200) throw new InsufficientPermissionsError();
  if (code === 272) {
    throw new InsufficientPermissionsError(
      "La cuenta publicitaria no está accesible con esta conexión de Meta. Verifica que tengas acceso en el Business Manager."
    );
  }
  throw new Error(`Meta Ads Insights: ${result.error?.message || fallback}`);
}

/**
 * Descarga los insights de una cuenta publicitaria, un registro por campaña y
 * día.
 *
 * Usa `time_range` y no `date_preset` porque el informe es por mes calendario
 * y `last_30d` no puede expresar "agosto". Las fechas se interpretan en la
 * zona horaria de la cuenta publicitaria, no en UTC.
 *
 * Cada página lleva su propio timeout: un `AbortSignal` global al bucle
 * cancelaría páginas legítimas en cuentas grandes.
 */
export async function fetchAdInsights(
  adAccountId: string,
  accessToken: string,
  opts: FetchAdInsightsOptions
): Promise<AdInsightRow[]> {
  const account = normalizeAdAccountId(adAccountId);
  const level = opts.level ?? "campaign";
  const maxPages = opts.maxPages ?? DEFAULT_MAX_PAGES;

  const rows: AdInsightRow[] = [];
  let after: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const url = new URL(`${GRAPH}/${account}/insights`);
    const params: Record<string, string> = {
      level,
      time_increment: "1",
      time_range: JSON.stringify({ since: opts.since, until: opts.until }),
      // Fijada explícitamente: los valores por defecto de Meta cambiaron y sin
      // esto los números nunca cuadran con lo que el cliente ve en su CRM.
      action_attribution_windows: JSON.stringify(["7d_click", "1d_view"]),
      fields: [
        "campaign_id",
        "campaign_name",
        "objective",
        "spend",
        "impressions",
        "reach",
        "clicks",
        "inline_link_clicks",
        "frequency",
        "account_currency",
        "actions",
        "action_values",
      ].join(","),
      limit: String(PAGE_SIZE),
    };
    if (after) params.after = after;
    url.search = new URLSearchParams(params).toString();

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });

    const result = await response.json();
    if (!response.ok || result.error) {
      throwGraphError(result, response.statusText);
    }

    if (isRateLimited(response.headers)) {
      throw new RateLimitedError();
    }

    const data: AdInsightRow[] = Array.isArray(result.data) ? result.data : [];
    rows.push(...data);

    const nextCursor = result.paging?.cursors?.after;
    // Una página incompleta significa que no hay más, aunque venga cursor.
    if (data.length < PAGE_SIZE || !result.paging?.next || !nextCursor) break;
    after = nextCursor;
  }

  return rows;
}

/**
 * Elige el tipo de conversión a reportar y devuelve su conteo y su valor.
 * Devuelve ceros si la campaña no registró ninguno de los tipos conocidos.
 */
export function extractConversions(row: AdInsightRow): {
  conversions: number;
  conversionValue: number;
} {
  const actions = row.actions ?? [];
  if (actions.length === 0) return { conversions: 0, conversionValue: 0 };

  for (const type of CONVERSION_ACTION_TYPES) {
    const matches = actions.filter((a) => a.action_type === type);
    if (matches.length === 0) continue;

    const conversions = matches.reduce((sum, a) => sum + toNumber(a.value), 0);
    const conversionValue = (row.action_values ?? [])
      .filter((a) => a.action_type === type)
      .reduce((sum, a) => sum + toNumber(a.value), 0);

    return { conversions, conversionValue };
  }

  return { conversions: 0, conversionValue: 0 };
}

/**
 * Convierte la respuesta de Graph en filas listas para ClientAdMetric.
 *
 * Meta devuelve todos los numéricos como strings; aquí se castean una sola vez.
 * Los ratios (CTR, CPC, CPM, ROAS) NO se calculan aquí a propósito: se derivan
 * al leer, desde numeradores y denominadores sumados, porque promediar ratios
 * diarios da un resultado incorrecto.
 */
export function transformAdInsightsForStorage(
  rows: AdInsightRow[],
  clientId: string,
  adAccountId: string
): AdMetricRow[] {
  const account = normalizeAdAccountId(adAccountId);

  return rows.map((row) => {
    const { conversions, conversionValue } = extractConversions(row);
    // inline_link_clicks mide intención real; `clicks` incluye interacciones
    // con la publicación (likes, expandir texto) e infla el CTR.
    const clicks =
      row.inline_link_clicks !== undefined
        ? toNumber(row.inline_link_clicks)
        : toNumber(row.clicks);

    const date = new Date(`${row.date_start}T00:00:00.000Z`);

    return {
      clientId,
      platform: "META_ADS",
      adAccountId: account,
      campaignId: row.campaign_id ?? ACCOUNT_LEVEL_CAMPAIGN_ID,
      campaignName: row.campaign_name ?? "Cuenta completa",
      date,
      spend: toNumber(row.spend),
      impressions: toNumber(row.impressions),
      reach: toNumber(row.reach),
      clicks,
      frequency: toNumber(row.frequency),
      conversions,
      conversionValue,
      currency: row.account_currency ?? "USD",
      objective: row.objective ?? null,
      actionsJson: row.actions ? JSON.stringify(row.actions) : null,
    };
  });
}
