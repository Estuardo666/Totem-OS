/**
 * Formato de montos en USD para toda la interfaz: convención de Ecuador
 * (es-EC), con punto de miles, coma decimal y el símbolo delante.
 *
 *   formatCurrency       1234.5 → "$1.234,50"
 *   formatCurrencyWhole  1234.5 → "$1.235"      (KPIs que redondean a entero)
 *
 * Los documentos fiscales del SRI (XML, RIDE) no usan este módulo: tienen su
 * propio formato normativo.
 */

const LOCALE = "es-EC";

const formatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const wholeFormatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatCurrency(amount: number): string {
  return formatter.format(amount);
}

export function formatCurrencyWhole(amount: number): string {
  return wholeFormatter.format(amount);
}
