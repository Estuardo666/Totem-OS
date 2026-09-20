import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fetchInstagramDailyTotals,
  fetchInstagramDemographics,
  fetchInstagramFollowerCount,
  fetchInstagramMetrics,
  fetchInstagramTopMedia,
  transformDemographicsForStorage,
  IG_DAILY_METRICS,
  IG_TOTAL_VALUE_METRICS,
} from '../../src/lib/meta/instagram-service.ts';
import { InsufficientPermissionsError, TokenExpiredError } from '../../src/lib/meta/metrics-service.ts';

test('daily metrics travel in a single request, without metric_type', async () => {
  const original = global.fetch;
  const calls = [];
  try {
    global.fetch = async (url, options) => {
      calls.push({
        metric: url.searchParams.get('metric'),
        metricType: url.searchParams.get('metric_type'),
        hasTokenInUrl: url.searchParams.has('access_token'),
        auth: options.headers.Authorization,
      });
      return Response.json({
        data: [{ name: 'reach', period: 'day', values: [{ value: 12, end_time: '2026-09-09T07:00:00Z' }] }],
      });
    };

    const result = await fetchInstagramMetrics('ig-1', 'test-token', 28);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].metric, IG_DAILY_METRICS.join(','));
    assert.equal(calls[0].metricType, null, 'las diarias no llevan metric_type');
    assert.equal(calls[0].hasTokenInUrl, false, 'el token nunca va en la URL');
    assert.equal(calls[0].auth, 'Bearer test-token');
    assert.equal(result.data[0].values[0].value, 12);
  } finally {
    global.fetch = original;
  }
});

test('impressions is never requested (removed in Graph v22)', () => {
  assert.equal(IG_DAILY_METRICS.includes('impressions'), false);
  assert.equal(IG_TOTAL_VALUE_METRICS.includes('impressions'), false);
});

test('profile_views is a total-value metric, not a daily one', () => {
  // Verificado contra la cuenta real: Graph responde
  // "(#100) ... should be specified with parameter metric_type=total_value".
  assert.equal(IG_DAILY_METRICS.includes('profile_views'), false);
  assert.equal(IG_TOTAL_VALUE_METRICS.includes('profile_views'), true);
});

test('an empty insights response is not an error', async () => {
  const original = global.fetch;
  try {
    global.fetch = async () => Response.json({ data: [] });
    const result = await fetchInstagramMetrics('ig-1', 'test-token');
    assert.deepEqual(result.data, []);
  } finally {
    global.fetch = original;
  }
});

test('graph error codes map to the shared typed errors', async () => {
  const original = global.fetch;
  try {
    global.fetch = async () => Response.json({ error: { code: 190 } }, { status: 400 });
    await assert.rejects(fetchInstagramMetrics('ig-1', 'test'), TokenExpiredError);

    global.fetch = async () => Response.json({ error: { code: 10 } }, { status: 400 });
    await assert.rejects(fetchInstagramMetrics('ig-1', 'test'), InsufficientPermissionsError);

    // Código 100 = métrica inválida: es un bug nuestro, no falta de permisos.
    global.fetch = async () => Response.json({ error: { code: 100, message: 'invalid metric' } }, { status: 400 });
    await assert.rejects(
      fetchInstagramMetrics('ig-1', 'test'),
      (e) => !(e instanceof InsufficientPermissionsError) && e.message.includes('invalid metric')
    );
  } finally {
    global.fetch = original;
  }
});

test('total-value metrics are requested one day at a time', async () => {
  // Pedir la ventana completa devuelve un único número. Guardarlo día tras día
  // y luego sumarlo por período multiplicaría el valor real, así que cada día
  // se pide con su propia ventana de 24h.
  const original = global.fetch;
  const windows = [];
  try {
    global.fetch = async (url) => {
      windows.push({
        since: Number(url.searchParams.get('since')),
        until: Number(url.searchParams.get('until')),
        metricType: url.searchParams.get('metric_type'),
      });
      return Response.json({
        data: [{ name: 'total_interactions', period: 'day', total_value: { value: 7 } }],
      });
    };

    const rows = await fetchInstagramDailyTotals('ig-1', 'test-token', 'client-1', 3);

    assert.equal(windows.length, 3, 'una petición por día');
    for (const window of windows) {
      assert.equal(window.until - window.since, 86400, 'ventana de exactamente un día');
      assert.equal(window.metricType, 'total_value');
    }

    assert.equal(rows.length, 3);
    assert.equal(rows[0].metricName, 'total_interactions');
    assert.equal(rows[0].value, 7);
    assert.equal(rows[0].platform, 'INSTAGRAM');
    assert.equal(rows[0].date.getUTCHours(), 0, 'las filas se fechan a medianoche UTC');
    // Fechas distintas: sin esto todas colisionarían en la misma clave única.
    assert.equal(new Set(rows.map((r) => r.date.getTime())).size, 3);
  } finally {
    global.fetch = original;
  }
});

test('a day rejected by graph does not discard the other days', async () => {
  const original = global.fetch;
  let call = 0;
  try {
    global.fetch = async () => {
      call++;
      if (call === 2) return Response.json({ error: { code: 100, message: 'out of range' } }, { status: 400 });
      return Response.json({ data: [{ name: 'likes', period: 'day', total_value: { value: 4 } }] });
    };

    const rows = await fetchInstagramDailyTotals('ig-1', 'test-token', 'client-1', 3);
    assert.equal(rows.length, 2);
  } finally {
    global.fetch = original;
  }
});

test('a total-value metric without a numeric value is dropped, not stored as NaN', async () => {
  const original = global.fetch;
  try {
    global.fetch = async () => Response.json({ data: [{ name: 'accounts_engaged', total_value: {} }] });
    const rows = await fetchInstagramDailyTotals('ig-1', 'test-token', 'client-1', 1);
    assert.equal(rows.length, 0);
  } finally {
    global.fetch = original;
  }
});

test('follower count reads the absolute profile field, not the daily insight', async () => {
  const original = global.fetch;
  let requestedFields = null;
  let requestedPath = null;
  try {
    global.fetch = async (url) => {
      requestedPath = url.pathname;
      requestedFields = url.searchParams.get('fields');
      return Response.json({ followers_count: 4321 });
    };

    assert.equal(await fetchInstagramFollowerCount('ig-1', 'test-token'), 4321);
    assert.equal(requestedFields, 'followers_count');
    assert.equal(requestedPath.endsWith('/insights'), false, 'no debe usar el endpoint de insights');
  } finally {
    global.fetch = original;
  }
});

test('a missing follower count degrades to zero instead of NaN', async () => {
  const original = global.fetch;
  try {
    global.fetch = async () => Response.json({});
    assert.equal(await fetchInstagramFollowerCount('ig-1', 'test-token'), 0);
  } finally {
    global.fetch = original;
  }
});

test('the day window is validated before any network call', async () => {
  const original = global.fetch;
  try {
    global.fetch = async () => {
      throw new Error('no debería llamarse');
    };
    await assert.rejects(fetchInstagramMetrics('ig-1', 'test', 0), /entre 1 y 90/);
    await assert.rejects(fetchInstagramMetrics('ig-1', 'test', 91), /entre 1 y 90/);
    await assert.rejects(fetchInstagramDailyTotals('ig-1', 'test', 'c1', 0), /entre 1 y 90/);
  } finally {
    global.fetch = original;
  }
});

test('demographics are flattened and a rejected breakdown is skipped', async () => {
  const original = global.fetch;
  try {
    global.fetch = async (url) => {
      const breakdown = url.searchParams.get('breakdown');
      if (breakdown === 'city') {
        // Meta responde así cuando la cuenta no llega al mínimo de seguidores.
        return Response.json({ error: { code: 100, message: 'Not enough users' } }, { status: 400 });
      }
      return Response.json({
        data: [
          {
            name: 'follower_demographics',
            total_value: {
              breakdowns: [
                {
                  dimension_keys: [breakdown],
                  results: [
                    { dimension_values: ['EC'], value: 120 },
                    { dimension_values: ['US'], value: 30 },
                  ],
                },
              ],
            },
          },
        ],
      });
    };

    const rows = await fetchInstagramDemographics('ig-1', 'test-token');
    assert.equal(rows.some((r) => r.dimension === 'city'), false, 'el desglose rechazado se omite');
    assert.ok(rows.some((r) => r.dimension === 'country' && r.key === 'EC' && r.value === 120));

    const stored = transformDemographicsForStorage(rows, 'client-1');
    const ecuador = stored.find((r) => r.metricName === 'audience_country:EC');
    assert.ok(ecuador, 'la dimensión viaja dentro de metricName');
    assert.equal(ecuador.platform, 'INSTAGRAM');
    assert.equal(ecuador.date.getUTCHours(), 0);
  } finally {
    global.fetch = original;
  }
});

test('media without insights keeps its public counters instead of vanishing', async () => {
  const original = global.fetch;
  try {
    global.fetch = async (url) => {
      if (url.pathname.endsWith('/insights')) {
        return Response.json({ error: { code: 100, message: 'unsupported for this media' } }, { status: 400 });
      }
      return Response.json({
        data: [
          {
            id: 'media-1',
            caption: 'hola',
            media_type: 'IMAGE',
            media_product_type: 'FEED',
            permalink: 'https://instagram.com/p/1',
            timestamp: '2026-09-01T10:00:00Z',
            like_count: 9,
            comments_count: 2,
          },
        ],
      });
    };

    const media = await fetchInstagramTopMedia('ig-1', 'test-token', 1);
    assert.equal(media.length, 1);
    assert.equal(media[0].likes, 9, 'cae al contador público cuando no hay insights');
    assert.equal(media[0].comments, 2);
    assert.equal(media[0].reach, 0);
  } finally {
    global.fetch = original;
  }
});
