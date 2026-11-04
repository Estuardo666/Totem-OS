/**
 * Formateadores de montos en USD compartidos por la interfaz.
 *
 * La app usa hoy cuatro presentaciones distintas según la pantalla. Se
 * conservan tal cual para no cambiar lo que ve el usuario; cada una tiene un
 * nombre propio para que unificarlas sea una decisión explícita y de una línea.
 *
 *   formatCurrency         1234.5 → "1234,50 US$"  (es-ES, 2 decimales)
 *   formatCurrencyWhole    1234.5 → "1235 US$"     (es-ES, sin decimales)
 *   formatCurrencyEnUS     1234.5 → "$1,234.50"    (en-US, 2 decimales)
 *   formatCurrencyEc       1234.5 → "$1.234,5"     (es-EC, 0 a 2 decimales)
 */

const formatters = new Map<string, Intl.NumberFormat>();

function usdFormatter(locale: string, minimumFractionDigits: number, maximumFractionDigits: number) {
  const key = `${locale}:${minimumFractionDigits}:${maximumFractionDigits}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits,
      maximumFractionDigits,
    });
    formatters.set(key, formatter);
  }
  return formatter;
}

export function formatCurrency(amount: number): string {
  return usdFormatter("es-ES", 2, 2).format(amount);
}

export function formatCurrencyWhole(amount: number): string {
  return usdFormatter("es-ES", 0, 0).format(amount);
}

export function formatCurrencyEnUS(amount: number): string {
  return usdFormatter("en-US", 2, 2).format(amount);
}

export function formatCurrencyEc(amount: number): string {
  return usdFormatter("es-EC", 0, 2).format(amount);
}
