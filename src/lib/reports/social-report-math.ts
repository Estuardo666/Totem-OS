/**
 * Aritmética del informe social: funciones puras, sin base de datos.
 *
 * Vive aparte del agregador para poder probarse con el harness de tests, y
 * porque aquí se concentran los errores clásicos de un informe: dividir entre
 * cero, promediar ratios, y sumar monedas distintas.
 */

export type DeltaDirection = "up" | "down" | "flat";

export interface DeltaPct {
  current: number;
  previous: number;
  /** null cuando no hay base de comparación: se muestra "nuevo", no ∞%. */
  pct: number | null;
  direction: DeltaDirection;
}

/**
 * Compara un valor con el del período anterior.
 *
 * Con `previous === 0` el porcentaje es `null`, no Infinity: un crecimiento
 * desde cero no tiene porcentaje que signifique algo, y renderizar "+∞%" o
 * "+100%" en un informe de cliente es directamente engañoso.
 */
export function delta(current: number, previous: number): DeltaPct {
  const safeCurrent = Number.isFinite(current) ? current : 0;
  const safePrevious = Number.isFinite(previous) ? previous : 0;

  if (safePrevious === 0) {
    return {
      current: safeCurrent,
      previous: 0,
      pct: null,
      direction: safeCurrent > 0 ? "up" : "flat",
    };
  }

  const pct = ((safeCurrent - safePrevious) / Math.abs(safePrevious)) * 100;

  return {
    current: safeCurrent,
    previous: safePrevious,
    pct,
    // Menos de medio punto porcentual se lee como "sin cambios": el ruido de
    // redondeo no debe pintarse como una tendencia.
    direction: Math.abs(pct) < 0.5 ? "flat" : pct > 0 ? "up" : "down",
  };
}

/** División protegida: devuelve null en vez de Infinity o NaN. */
export function ratio(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
  if (denominator === 0) return null;
  return numerator / denominator;
}

export interface AdTotals {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  conversions: number;
  conversionValue: number;
}

export interface AdEfficiency extends AdTotals {
  /** Clics / impresiones, en porcentaje. */
  ctr: number | null;
  /** Costo por clic. */
  cpc: number | null;
  /** Costo por mil impresiones. */
  cpm: number | null;
  /** Costo por resultado. */
  cpa: number | null;
  /** Valor de conversión / inversión. */
  roas: number | null;
}

/**
 * Deriva los ratios publicitarios desde los totales.
 *
 * Los ratios SIEMPRE se calculan sobre numeradores y denominadores ya sumados.
 * Promediar los CTR diarios da un número distinto y equivocado: un día con 10
 * impresiones pesaría igual que uno con 10.000.
 */
export function computeAdEfficiency(totals: AdTotals): AdEfficiency {
  const ctrRatio = ratio(totals.clicks, totals.impressions);

  return {
    ...totals,
    ctr: ctrRatio === null ? null : ctrRatio * 100,
    cpc: ratio(totals.spend, totals.clicks),
    cpm: (() => {
      const perImpression = ratio(totals.spend, totals.impressions);
      return perImpression === null ? null : perImpression * 1000;
    })(),
    cpa: ratio(totals.spend, totals.conversions),
    roas: ratio(totals.conversionValue, totals.spend),
  };
}

/** Suma una lista de filas publicitarias en un único total. */
export function sumAdTotals(
  rows: Array<Partial<AdTotals>>
): AdTotals {
  return rows.reduce<AdTotals>(
    (acc, row) => ({
      spend: acc.spend + (row.spend ?? 0),
      impressions: acc.impressions + (row.impressions ?? 0),
      reach: acc.reach + (row.reach ?? 0),
      clicks: acc.clicks + (row.clicks ?? 0),
      conversions: acc.conversions + (row.conversions ?? 0),
      conversionValue: acc.conversionValue + (row.conversionValue ?? 0),
    }),
    { spend: 0, impressions: 0, reach: 0, clicks: 0, conversions: 0, conversionValue: 0 }
  );
}

/**
 * Agrupa filas publicitarias por moneda.
 *
 * Nunca se suman monedas distintas: con varias cuentas publicitarias es
 * posible que convivan USD y otra divisa, y un total mezclado es un número
 * inventado. El informe muestra subtotales separados.
 */
export function groupByCurrency<T extends { currency: string }>(
  rows: T[]
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = row.currency || "USD";
    const bucket = groups.get(key);
    if (bucket) bucket.push(row);
    else groups.set(key, [row]);
  }
  return groups;
}

/**
 * Participación de cada campaña sobre la inversión total, en porcentaje.
 * Con inversión total cero todas quedan en 0, no en NaN.
 */
export function shareOfSpend(spend: number, totalSpend: number): number {
  const share = ratio(spend, totalSpend);
  return share === null ? 0 : share * 100;
}
