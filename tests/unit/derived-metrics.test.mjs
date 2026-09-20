import assert from 'node:assert/strict';
import test from 'node:test';
import {
  adSaturation,
  communityGrowthRate,
  costPerInteraction,
  engagementRateByFollowers,
  engagementRateByReach,
  followerRetentionRate,
  healthLabel,
  healthScore,
  netFollowers,
  organicShare,
  percentage,
  profileConversionRate,
  projectToMonthEnd,
  proratedFee,
  publishingConsistency,
  reachPerPost,
  saveRate,
  totalCostPerResult,
  viralityIndex,
} from '../../src/lib/metrics/derived-metrics.ts';

test('a zero denominator yields null, never Infinity or NaN', () => {
  assert.equal(percentage(10, 0), null);
  assert.equal(engagementRateByReach(50, 0), null);
  assert.equal(engagementRateByFollowers(50, 0), null);
  assert.equal(communityGrowthRate(100, 0), null);
  assert.equal(viralityIndex(3, 0), null);
  assert.equal(saveRate(3, 0), null);
  assert.equal(profileConversionRate(3, 0), null);
  assert.equal(reachPerPost(300, 0), null);
  assert.equal(adSaturation(100, 0), null);
  assert.equal(publishingConsistency(3, 0), null);
});

test('engagement rates are computed over summed totals', () => {
  // 120 interacciones sobre 4.000 de alcance = 3%. Promediar los ER diarios
  // daría otro número y sería el error clásico de este tipo de informe.
  assert.equal(engagementRateByReach(120, 4000), 3);
  assert.equal(engagementRateByFollowers(60, 1200), 5);
});

test('community growth handles both directions', () => {
  assert.equal(Math.round(communityGrowthRate(110, 100)), 10);
  assert.equal(Math.round(communityGrowthRate(90, 100)), -10);
  assert.equal(netFollowers(12, 5), 7);
  assert.equal(netFollowers(2, 9), -7);
});

test('follower retention can be negative when losses exceed gains', () => {
  assert.equal(followerRetentionRate(10, 2), 80);
  assert.equal(followerRetentionRate(2, 10), -400);
  assert.equal(followerRetentionRate(0, 5), null, 'sin altas no hay base de retención');
});

test('the monthly fee is prorated to the period, not charged whole', () => {
  // 300 al mes durante 7 días son 70, no 300: comparar el fee mensual contra
  // 7 días de interacciones cuadruplicaría el costo real.
  assert.equal(proratedFee(300, 7), 70);
  assert.equal(proratedFee(300, 30), 300);
  assert.equal(proratedFee(0, 30), 0);
  assert.equal(proratedFee(300, 0), 0);

  assert.equal(costPerInteraction(300, 70, 7), 1);
  assert.equal(costPerInteraction(300, 0, 7), null, 'sin interacciones no hay costo por interacción');
});

test('total cost per result adds the fee to ad spend', () => {
  // 100 de inversión + 300/mes prorrateados a 30 días = 400, entre 8 resultados.
  assert.equal(totalCostPerResult(100, 300, 8, 30), 50);
  assert.equal(totalCostPerResult(100, 300, 0, 30), null);
});

test('organic share splits total volume between sources', () => {
  assert.equal(organicShare(750, 250), 75);
  assert.equal(organicShare(0, 0), null, 'sin alcance de ninguna fuente no hay reparto');
  assert.equal(organicShare(500, 0), 100);
});

test('ad saturation is impressions over reach', () => {
  assert.equal(adSaturation(3000, 1000), 3);
});

test('publishing consistency measures days, not volume', () => {
  assert.equal(publishingConsistency(7, 28), 25);
  assert.equal(publishingConsistency(28, 28), 100);
});

test('month-end projection extrapolates the daily pace', () => {
  // 15.000 visualizaciones en 15 días proyectan 30.000 a 30 días.
  assert.equal(projectToMonthEnd(15000, 15, 30), 30000);
  assert.equal(projectToMonthEnd(15000, 0, 30), null, 'sin días transcurridos no hay ritmo');
  assert.equal(projectToMonthEnd(30000, 30, 30), null, 'el mes cerrado ya no se proyecta');
  assert.equal(projectToMonthEnd(30000, 31, 30), null);
});

test('health score ignores missing components instead of scoring them zero', () => {
  const onlyEngagement = healthScore({
    engagementRate: 5,
    growthRate: null,
    consistency: null,
    reachTrend: null,
  });
  assert.equal(onlyEngagement, 100, 'un único componente al máximo da 100');

  const withZeros = healthScore({
    engagementRate: 5,
    growthRate: 0,
    consistency: 0,
    reachTrend: 0,
  });
  assert.ok(withZeros < 100, 'los componentes en cero sí penalizan cuando existen');

  assert.equal(
    healthScore({ engagementRate: null, growthRate: null, consistency: null, reachTrend: null }),
    null,
    'sin ningún componente no se inventa un cero'
  );
});

test('health score stays inside 0-100 for extreme inputs', () => {
  const huge = healthScore({ engagementRate: 900, growthRate: 900, consistency: 900, reachTrend: 900 });
  const awful = healthScore({ engagementRate: -50, growthRate: -90, consistency: 0, reachTrend: -95 });
  assert.equal(huge, 100);
  assert.equal(awful, 0);
});

test('the score always carries a readable label', () => {
  assert.equal(healthLabel(null), 'Sin datos suficientes');
  assert.equal(healthLabel(80), 'Saludable');
  assert.equal(healthLabel(60), 'Estable');
  assert.equal(healthLabel(30), 'Necesita atención');
  assert.equal(healthLabel(10), 'Crítico');
});
