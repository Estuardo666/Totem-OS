/**
 * Paleta del informe social.
 *
 * Tres series como máximo, y no por gusto: con las tres primeras ranuras el
 * validador de paleta pasa todas las comprobaciones en claro y en oscuro,
 * incluida la separación para daltonismo. La cuarta ranura pone amarillo y
 * naranja en pantalla a la vez y esa pareja no supera el umbral.
 *
 * Verificado con el validador de la skill dataviz:
 *   claro:  peor par ΔE 9.2 (deuteranopía) / 27.6 (visión normal)
 *   oscuro: peor par ΔE 9.4 (deuteranopía) / 26.5 (visión normal)
 *
 * En modo claro el verde queda bajo 3:1 de contraste contra la superficie, así
 * que la regla de relieve aplica: cada serie lleva siempre etiqueta visible en
 * la leyenda, nunca se identifica solo por color.
 */

export const REPORT_SERIES = {
  facebook: { light: "#2a78d6", dark: "#3987e5", label: "Facebook" },
  instagram: { light: "#eb6834", dark: "#d95926", label: "Instagram" },
  tiktok: { light: "#1baf7a", dark: "#199e70", label: "TikTok" },
} as const;

export type ReportSeriesKey = keyof typeof REPORT_SERIES;

/** Formatea números grandes en español de Ecuador. */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-EC", { maximumFractionDigits: 0 }).format(value);
}

/** Formatea dinero con la moneda real de la cuenta, nunca asumiendo USD. */
export function formatCurrency(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("es-EC", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    // Una moneda desconocida no debe romper el informe entero.
    return `${currency} ${value.toFixed(2)}`;
  }
}

/**
 * Formatea un porcentaje de cambio.
 * `null` significa que no hay base de comparación: se dice "nuevo", no "∞%".
 */
export function formatDeltaPct(pct: number | null): string {
  if (pct === null) return "nuevo";
  const rounded = Math.round(pct);
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

/** Formatea un ratio que puede no ser calculable. */
export function formatRatio(
  value: number | null,
  suffix: string = "",
  decimals: number = 2
): string {
  if (value === null) return "—";
  return `${value.toFixed(decimals)}${suffix}`;
}
