import assert from "node:assert/strict";
import test from "node:test";
import {
  formatCurrency,
  formatCurrencyEc,
  formatCurrencyEnUS,
  formatCurrencyWhole,
} from "../../src/lib/currency-format.ts";

// Cada formateador debe producir exactamente lo que producían las copias
// locales que reemplaza; cambiar la presentación es una decisión aparte.
const legacy = (locale, min, max) => (amount) =>
  new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  }).format(amount);

const samples = [0, -0, 1, 0.005, 0.5, 9.999, 1234.5, -1234.567, 1_000_000, -0.01, 999_999.995];

for (const [name, format, reference] of [
  ["formatCurrency", formatCurrency, legacy("es-ES", 2, 2)],
  ["formatCurrencyWhole", formatCurrencyWhole, legacy("es-ES", 0, 0)],
  ["formatCurrencyEnUS", formatCurrencyEnUS, legacy("en-US", 2, 2)],
  ["formatCurrencyEc", formatCurrencyEc, legacy("es-EC", 0, 2)],
]) {
  test(`${name} matches the legacy formatter output`, () => {
    for (const amount of samples) assert.equal(format(amount), reference(amount), `${name}(${amount})`);
  });
}

test("formatters keep their distinct presentations", () => {
  assert.equal(formatCurrencyEnUS(1234.5), "$1,234.50");
  assert.notEqual(formatCurrency(1234.5), formatCurrencyEnUS(1234.5));
});
