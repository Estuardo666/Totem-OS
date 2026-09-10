import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fetchInstagramMetrics,
  fetchInstagramFollowerCount,
  IG_DAILY_METRICS,
  IG_TOTAL_VALUE_METRICS,
} from '../../src/lib/meta/instagram-service.ts';
import { InsufficientPermissionsError, TokenExpiredError } from '../../src/lib/meta/metrics-service.ts';

test('daily and total-value metrics travel in separate requests', async () => {
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

    assert.equal(calls.length, 2, 'debe hacer dos peticiones separadas');
    assert.equal(calls[0].metric, IG_DAILY_METRICS.join(','));
    assert.equal(calls[0].metricType, null, 'las diarias no llevan metric_type');
    assert.equal(calls[1].metric, IG_TOTAL_VALUE_METRICS.join(','));
    assert.equal(calls[1].metricType, 'total_value');

    for (const call of calls) {
      assert.equal(call.hasTokenInUrl, false, 'el token nunca va en la URL');
      assert.equal(call.auth, 'Bearer test-token');
    }

    assert.equal(result.data.length, 2, 'combina el resultado de ambas llamadas');
  } finally {
    global.fetch = original;
  }
});

test('impressions is never requested (removed in Graph v22)', () => {
  assert.equal(IG_DAILY_METRICS.includes('impressions'), false);
  assert.equal(IG_TOTAL_VALUE_METRICS.includes('impressions'), false);
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
  } finally {
    global.fetch = original;
  }
});

test('total_value metrics are normalized into the daily shape', async () => {
  // Graph devuelve estas como { total_value: { value } } en vez de values[].
  // Sin normalizar, transformMetricsForStorage las descartaría en silencio.
  const original = global.fetch;
  let call = 0;
  try {
    global.fetch = async () => {
      call++;
      if (call === 1) return Response.json({ data: [] });
      return Response.json({
        data: [{ name: 'total_interactions', period: 'day', total_value: { value: 42 } }],
      });
    };

    const result = await fetchInstagramMetrics('ig-1', 'test-token', 28);
    const metric = result.data.find((d) => d.name === 'total_interactions');

    assert.ok(Array.isArray(metric.values), 'debe exponer values[]');
    assert.equal(metric.values[0].value, 42);
    assert.ok(metric.values[0].end_time, 'debe llevar fecha para poder guardarse');
  } finally {
    global.fetch = original;
  }
});

test('a total-value metric without a numeric value is dropped, not stored as NaN', async () => {
  const original = global.fetch;
  let call = 0;
  try {
    global.fetch = async () => {
      call++;
      if (call === 1) return Response.json({ data: [] });
      return Response.json({ data: [{ name: 'accounts_engaged', period: 'day', total_value: {} }] });
    };
    const result = await fetchInstagramMetrics('ig-1', 'test-token', 28);
    assert.equal(result.data.length, 0);
  } finally {
    global.fetch = original;
  }
});

test('profile_views is a total-value metric, not a daily one', () => {
  // Verificado contra la cuenta real: Graph responde
  // "(#100) ... should be specified with parameter metric_type=total_value".
  assert.equal(IG_DAILY_METRICS.includes('profile_views'), false);
  assert.equal(IG_TOTAL_VALUE_METRICS.includes('profile_views'), true);
});
