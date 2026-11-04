import assert from "node:assert/strict";
import test from "node:test";
import { formatCurrency, formatCurrencyWhole } from "../../src/lib/currency-format.ts";

// La interfaz muestra los montos con la convención de Ecuador (es-EC).
test("formatCurrency uses the Ecuadorian convention with two decimals", () => {
  assert.equal(formatCurrency(1234.5), "$1.234,50");
  assert.equal(formatCurrency(0), "$0,00");
  assert.equal(formatCurrency(12.3), "$12,30");
  assert.equal(formatCurrency(1_000_000), "$1.000.000,00");
  assert.equal(formatCurrency(-1234.5), "$-1.234,50");
  assert.equal(formatCurrency(0.005), "$0,01");
});

test("formatCurrencyWhole rounds to whole dollars for KPI tiles", () => {
  assert.equal(formatCurrencyWhole(1234.5), "$1.235");
  assert.equal(formatCurrencyWhole(1500), "$1.500");
  assert.equal(formatCurrencyWhole(0), "$0");
});

test("formatters agree with the platform es-EC currency format", () => {
  const reference = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  for (const amount of [0, 1, 9.999, 1234.567, -0.01, 999_999.995]) {
    assert.equal(formatCurrency(amount), reference.format(amount), String(amount));
  }
});
