import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fetchPageMetrics,
  fetchPagePosts,
  transformMetricsForStorage,
  FB_ALL_METRICS,
  FB_DAILY_METRICS,
  FB_SNAPSHOT_METRICS,
  InsufficientPermissionsError,
  TokenExpiredError,
} from '../../src/lib/meta/metrics-service.ts';

test('Facebook sync uses supported metrics and keeps credentials out of URLs', async () => {
  const original = global.fetch;
  try {
    global.fetch = async (url, options) => {
      assert.equal(url.searchParams.get('metric'), FB_ALL_METRICS.join(','));
      assert.equal(url.searchParams.has('access_token'), false);
      assert.equal(options.headers.Authorization, 'Bearer test-token');
      return Response.json({
        data: [{ name: 'page_media_view', period: 'day', values: [{ value: 35, end_time: '2026-09-09T07:00:00Z' }] }],
      });
    };
    assert.equal((await fetchPageMetrics('123', 'test-token')).data[0].values[0].value, 35);
  } finally {
    global.fetch = original;
  }
});

test('deprecated page metric families are never requested', () => {
  // Verificado contra la API real: page_impressions*, page_fans* y
  // page_fan_adds_unique responden "(#100) The value must be a valid insights
  // metric" en v21.0.
  for (const metric of FB_ALL_METRICS) {
    assert.equal(metric.startsWith('page_impressions'), false, metric);
    assert.equal(metric === 'page_fans', false);
    assert.equal(metric === 'page_fan_adds_unique', false);
  }
});

test('page_follows is treated as a snapshot, not as a daily increment', () => {
  // Sus valores diarios son el acumulado de seguidores (225, 225, 226…):
  // sumarlos daría un número inventado.
  assert.equal(FB_SNAPSHOT_METRICS.includes('page_follows'), true);
  assert.equal(FB_DAILY_METRICS.includes('page_follows'), false);
});

test('invalid metrics are retried one by one instead of losing the whole sync', async () => {
  const original = global.fetch;
  const requested = [];
  try {
    global.fetch = async (url) => {
      const metric = url.searchParams.get('metric');
      requested.push(metric);
      if (metric.includes(',')) {
        return Response.json({ error: { code: 100, message: '(#100) The value must be a valid insights metric' } }, { status: 400 });
      }
      if (metric === 'page_total_actions') {
        return Response.json({ error: { code: 100, message: '(#100) The value must be a valid insights metric' } }, { status: 400 });
      }
      return Response.json({
        data: [{ name: metric, period: 'day', values: [{ value: 1, end_time: '2026-09-09T07:00:00Z' }] }],
      });
    };

    const result = await fetchPageMetrics('123', 'test-token');

    assert.equal(requested[0].includes(','), true, 'primero intenta el lote completo');
    assert.equal(requested.length, FB_ALL_METRICS.length + 1, 'luego pregunta una por una');
    assert.equal(result.data.some((m) => m.name === 'page_total_actions'), false, 'la inválida se descarta');
    assert.equal(result.data.length, FB_ALL_METRICS.length - 1, 'las demás sobreviven');
  } finally {
    global.fetch = original;
  }
});

test('invalid metrics are not reported as missing permissions', async () => {
  const original = global.fetch;
  try {
    global.fetch = async () => Response.json({ error: { code: 100, message: 'invalid metric' } }, { status: 400 });
    await assert.rejects(
      fetchPageMetrics('123', 'test'),
      (e) => !(e instanceof InsufficientPermissionsError) && e.message.includes('invalid metric')
    );

    global.fetch = async () => Response.json({ error: { code: 190 } }, { status: 400 });
    await assert.rejects(fetchPageMetrics('123', 'test'), TokenExpiredError);
  } finally {
    global.fetch = original;
  }
});

test('breakdown values are expanded into one row per type plus the total', () => {
  // page_actions_post_reactions_total llega como { like: 3, love: 1 }.
  // Sin expandirlo, parseFloat sobre un objeto guardaría NaN en silencio.
  const rows = transformMetricsForStorage(
    {
      data: [
        {
          name: 'page_actions_post_reactions_total',
          period: 'day',
          values: [{ value: { like: 3, love: 1 }, end_time: '2026-09-09T07:00:00Z' }],
        },
      ],
    },
    'client-1',
    'FACEBOOK'
  );

  const byName = Object.fromEntries(rows.map((r) => [r.metricName, r.value]));
  assert.equal(byName['page_actions_post_reactions_total:like'], 3);
  assert.equal(byName['page_actions_post_reactions_total:love'], 1);
  assert.equal(byName['page_actions_post_reactions_total'], 4, 'el total es la suma de los tipos');
  for (const row of rows) assert.equal(Number.isFinite(row.value), true);
});

test('an empty breakdown stores zero, never NaN', () => {
  const rows = transformMetricsForStorage(
    {
      data: [
        { name: 'page_actions_post_reactions_total', period: 'day', values: [{ value: {}, end_time: '2026-09-09T07:00:00Z' }] },
      ],
    },
    'client-1',
    'FACEBOOK'
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].value, 0);
});

test('page posts read engagement from insights, not from the gated fields', async () => {
  // Los campos shares/comments.summary/reactions.summary exigen
  // pages_read_user_content, que esta app no pide: contra la API real
  // responden "(#10)".
  const original = global.fetch;
  let listFields = null;
  try {
    global.fetch = async (url) => {
      if (url.pathname.endsWith('/insights')) {
        return Response.json({
          data: [
            { name: 'post_media_view', period: 'lifetime', values: [{ value: 150, end_time: '2026-09-09T07:00:00Z' }] },
            { name: 'post_activity_by_action_type', period: 'lifetime', values: [{ value: { share: 2, comment: 5 }, end_time: '2026-09-09T07:00:00Z' }] },
            { name: 'post_reactions_by_type_total', period: 'lifetime', values: [{ value: { like: 7, wow: 1 }, end_time: '2026-09-09T07:00:00Z' }] },
          ],
        });
      }
      listFields = url.searchParams.get('fields');
      return Response.json({
        data: [{ id: 'post-1', message: 'hola', created_time: '2026-09-01T12:00:00Z', permalink_url: 'https://fb.com/1' }],
      });
    };

    const posts = await fetchPagePosts('123', 'test-token', 1);

    assert.equal(listFields.includes('shares'), false, 'no se piden campos bloqueados');
    assert.equal(listFields.includes('reactions'), false);
    assert.equal(posts[0].views, 150);
    assert.equal(posts[0].shares, 2);
    assert.equal(posts[0].comments, 5);
    assert.equal(posts[0].likes, 8, 'suma todas las reacciones');
  } finally {
    global.fetch = original;
  }
});

test('a post whose insights fail is kept with zeros', async () => {
  const original = global.fetch;
  try {
    global.fetch = async (url) => {
      if (url.pathname.endsWith('/insights')) {
        return Response.json({ error: { code: 100, message: 'no insights' } }, { status: 400 });
      }
      return Response.json({ data: [{ id: 'post-1', created_time: '2026-09-01T12:00:00Z' }] });
    };

    const posts = await fetchPagePosts('123', 'test-token', 1);
    assert.equal(posts.length, 1);
    assert.equal(posts[0].views, 0);
  } finally {
    global.fetch = original;
  }
});
