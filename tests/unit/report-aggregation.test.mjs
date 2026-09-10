import assert from 'node:assert/strict';
import test from 'node:test';
import {
  delta,
  ratio,
  computeAdEfficiency,
  sumAdTotals,
  groupByCurrency,
  shareOfSpend,
} from '../../src/lib/reports/social-report-math.ts';

test('growth from zero has no percentage, never Infinity', () => {
  // El bug clásico de los informes: "+∞%" o "+100%" en el primer mes.
  const d = delta(500, 0);
  assert.equal(d.pct, null);
  assert.equal(Number.isFinite(d.pct), false);
  assert.equal(d.direction, 'up');
  assert.equal(d.current, 500);
});

test('zero to zero is flat, not a growth story', () => {
  const d = delta(0, 0);
  assert.equal(d.pct, null);
  assert.equal(d.direction, 'flat');
});

test('a normal delta reports the percentage and keeps its baseline', () => {
  const d = delta(150, 100);
  assert.equal(d.pct, 50);
  assert.equal(d.previous, 100, 'el porcentaje nunca viaja sin su base');
  assert.equal(d.direction, 'up');
});

test('a drop is reported as down', () => {
  const d = delta(50, 100);
  assert.equal(d.pct, -50);
  assert.equal(d.direction, 'down');
});

test('rounding noise reads as flat instead of a fake trend', () => {
  assert.equal(delta(1000, 1002).direction, 'flat');
  assert.equal(delta(1000, 1050).direction, 'down');
});

test('non-finite inputs degrade to zero instead of poisoning the report', () => {
  assert.equal(delta(NaN, 100).current, 0);
  assert.equal(delta(100, Infinity).previous, 0);
});

test('ratio guards division by zero', () => {
  assert.equal(ratio(10, 0), null);
  assert.equal(ratio(0, 0), null);
  assert.equal(ratio(10, 4), 2.5);
  assert.equal(ratio(NaN, 4), null);
});

test('ratios are computed from summed totals, never averaged per day', () => {
  // Dos días: uno con 10 impresiones y 5 clics (CTR 50%), otro con 10.000
  // impresiones y 100 clics (CTR 1%). El promedio de los CTR diarios daría
  // 25,5% — absurdo. El correcto es 105/10010 = 1,05%.
  const daily = [
    { spend: 1, impressions: 10, reach: 10, clicks: 5, conversions: 0, conversionValue: 0 },
    { spend: 99, impressions: 10000, reach: 9000, clicks: 100, conversions: 0, conversionValue: 0 },
  ];

  const totals = computeAdEfficiency(sumAdTotals(daily));

  const averagedPerDay = (50 + 1) / 2;
  assert.notEqual(Math.round(totals.ctr * 10) / 10, averagedPerDay);
  assert.equal(Math.round(totals.ctr * 100) / 100, 1.05);
});

test('efficiency ratios are null rather than Infinity when the denominator is zero', () => {
  const totals = computeAdEfficiency({
    spend: 100,
    impressions: 0,
    reach: 0,
    clicks: 0,
    conversions: 0,
    conversionValue: 0,
  });

  assert.equal(totals.ctr, null);
  assert.equal(totals.cpc, null);
  assert.equal(totals.cpm, null);
  assert.equal(totals.cpa, null);
  // ROAS sí es 0: hubo inversión y no hubo retorno. Eso es un dato real,
  // distinto de "no se puede calcular".
  assert.equal(totals.roas, 0);
});

test('ROAS divides value by spend, and zero spend yields null', () => {
  const spent = computeAdEfficiency({
    spend: 50,
    impressions: 1000,
    reach: 800,
    clicks: 20,
    conversions: 4,
    conversionValue: 200,
  });
  assert.equal(spent.roas, 4);
  assert.equal(spent.cpa, 12.5);

  const unspent = computeAdEfficiency({
    spend: 0,
    impressions: 0,
    reach: 0,
    clicks: 0,
    conversions: 0,
    conversionValue: 100,
  });
  assert.equal(unspent.roas, null);
});

test('CPM is per thousand impressions', () => {
  const totals = computeAdEfficiency({
    spend: 20,
    impressions: 10000,
    reach: 0,
    clicks: 0,
    conversions: 0,
    conversionValue: 0,
  });
  assert.equal(totals.cpm, 2);
});

test('summing tolerates missing fields', () => {
  const totals = sumAdTotals([{ spend: 5 }, { impressions: 10 }, {}]);
  assert.equal(totals.spend, 5);
  assert.equal(totals.impressions, 10);
  assert.equal(totals.clicks, 0);
});

test('different currencies are kept apart and never summed', () => {
  const groups = groupByCurrency([
    { currency: 'USD', spend: 100 },
    { currency: 'EUR', spend: 50 },
    { currency: 'USD', spend: 25 },
  ]);

  assert.equal(groups.size, 2);
  assert.equal(sumAdTotals(groups.get('USD')).spend, 125);
  assert.equal(sumAdTotals(groups.get('EUR')).spend, 50);
});

test('a missing currency falls back to USD rather than creating an empty bucket', () => {
  const groups = groupByCurrency([{ currency: '', spend: 10 }]);
  assert.equal(groups.has('USD'), true);
  assert.equal(groups.has(''), false);
});

test('share of spend is zero, not NaN, when nothing was spent', () => {
  assert.equal(shareOfSpend(0, 0), 0);
  assert.equal(shareOfSpend(25, 100), 25);
});
