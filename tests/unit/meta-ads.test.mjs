import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fetchAdInsights,
  transformAdInsightsForStorage,
  extractConversions,
  normalizeAdAccountId,
  RateLimitedError,
  ACCOUNT_LEVEL_CAMPAIGN_ID,
} from '../../src/lib/meta/ads-service.ts';
import { InsufficientPermissionsError, TokenExpiredError } from '../../src/lib/meta/metrics-service.ts';

const okPage = (rows, next = null) =>
  Response.json({
    data: rows,
    paging: next ? { next: 'https://next', cursors: { after: next } } : {},
  });

test('a bare numeric account id is normalized to the act_ prefix', () => {
  assert.equal(normalizeAdAccountId('123456'), 'act_123456');
  assert.equal(normalizeAdAccountId('act_123456'), 'act_123456');
  assert.equal(normalizeAdAccountId('  789 '), 'act_789');
});

test('the request pins level, daily increment, time range and attribution', async () => {
  const original = global.fetch;
  let seen = null;
  try {
    global.fetch = async (url, options) => {
      seen = { url, auth: options.headers.Authorization };
      return okPage([]);
    };

    await fetchAdInsights('123', 'test-token', { since: '2026-08-01', until: '2026-08-31' });

    assert.equal(seen.url.pathname, '/v21.0/act_123/insights');
    assert.equal(seen.url.searchParams.get('level'), 'campaign');
    assert.equal(seen.url.searchParams.get('time_increment'), '1');
    assert.deepEqual(JSON.parse(seen.url.searchParams.get('time_range')), {
      since: '2026-08-01',
      until: '2026-08-31',
    });
    assert.deepEqual(JSON.parse(seen.url.searchParams.get('action_attribution_windows')), [
      '7d_click',
      '1d_view',
    ]);
    assert.equal(seen.url.searchParams.get('date_preset'), null, 'no debe usar date_preset');
    assert.equal(seen.url.searchParams.has('access_token'), false);
    assert.equal(seen.auth, 'Bearer test-token');
  } finally {
    global.fetch = original;
  }
});

test('paging follows the after cursor and stops at maxPages', async () => {
  const original = global.fetch;
  let calls = 0;
  try {
    const fullPage = Array.from({ length: 200 }, (_, i) => ({
      campaign_id: `c${i}`,
      date_start: '2026-08-01',
      date_stop: '2026-08-01',
    }));

    global.fetch = async (url) => {
      calls++;
      if (calls > 1) {
        assert.equal(url.searchParams.get('after'), `cursor-${calls - 1}`);
      }
      return okPage(fullPage, `cursor-${calls}`);
    };

    const rows = await fetchAdInsights('123', 'test', {
      since: '2026-08-01',
      until: '2026-08-31',
      maxPages: 3,
    });

    assert.equal(calls, 3, 'se detiene en maxPages');
    assert.equal(rows.length, 600);
  } finally {
    global.fetch = original;
  }
});

test('a short page ends paging even when a cursor is present', async () => {
  const original = global.fetch;
  let calls = 0;
  try {
    global.fetch = async () => {
      calls++;
      return okPage([{ campaign_id: 'c1', date_start: '2026-08-01', date_stop: '2026-08-01' }], 'more');
    };

    const rows = await fetchAdInsights('123', 'test', { since: '2026-08-01', until: '2026-08-31' });
    assert.equal(calls, 1);
    assert.equal(rows.length, 1);
  } finally {
    global.fetch = original;
  }
});

test('purchase wins over link_click and its action_values are summed', () => {
  const { conversions, conversionValue } = extractConversions({
    date_start: '2026-08-01',
    date_stop: '2026-08-01',
    actions: [
      { action_type: 'link_click', value: '400' },
      { action_type: 'purchase', value: '3' },
      { action_type: 'purchase', value: '2' },
    ],
    action_values: [
      { action_type: 'link_click', value: '0' },
      { action_type: 'purchase', value: '150.50' },
      { action_type: 'purchase', value: '49.50' },
    ],
  });

  assert.equal(conversions, 5, 'suma solo el tipo elegido');
  assert.equal(conversionValue, 200);
});

test('link_click is used only when no stronger conversion exists', () => {
  const { conversions } = extractConversions({
    date_start: '2026-08-01',
    date_stop: '2026-08-01',
    actions: [{ action_type: 'link_click', value: '42' }],
  });
  assert.equal(conversions, 42);
});

test('unknown action types yield zero rather than a wrong number', () => {
  const { conversions, conversionValue } = extractConversions({
    date_start: '2026-08-01',
    date_stop: '2026-08-01',
    actions: [{ action_type: 'post_reaction', value: '999' }],
  });
  assert.equal(conversions, 0);
  assert.equal(conversionValue, 0);
});

test('transform casts string numerics and never stores derived ratios', () => {
  const [row] = transformAdInsightsForStorage(
    [
      {
        campaign_id: '23851',
        campaign_name: 'Agosto Ventas',
        objective: 'OUTCOME_SALES',
        date_start: '2026-08-05',
        date_stop: '2026-08-05',
        spend: '12.34',
        impressions: '5000',
        reach: '4000',
        clicks: '300',
        inline_link_clicks: '120',
        frequency: '1.25',
        account_currency: 'USD',
        actions: [{ action_type: 'purchase', value: '4' }],
        action_values: [{ action_type: 'purchase', value: '88' }],
      },
    ],
    'client-1',
    '123'
  );

  assert.equal(row.spend, 12.34);
  assert.equal(row.impressions, 5000);
  assert.equal(row.clicks, 120, 'usa inline_link_clicks, no clicks');
  assert.equal(row.frequency, 1.25);
  assert.equal(row.conversions, 4);
  assert.equal(row.conversionValue, 88);
  assert.equal(row.adAccountId, 'act_123');
  assert.equal(row.platform, 'META_ADS');
  assert.equal(row.date.toISOString(), '2026-08-05T00:00:00.000Z');
  assert.equal(typeof row.actionsJson, 'string');

  for (const derived of ['ctr', 'cpc', 'cpm', 'roas']) {
    assert.equal(derived in row, false, `${derived} no debe almacenarse`);
  }
});

test('clicks falls back to the broad clicks field when inline is absent', () => {
  const [row] = transformAdInsightsForStorage(
    [{ campaign_id: 'c', date_start: '2026-08-05', date_stop: '2026-08-05', clicks: '77' }],
    'client-1',
    'act_9'
  );
  assert.equal(row.clicks, 77);
});

test('rows without a campaign id use the account-level sentinel, never null', () => {
  const [row] = transformAdInsightsForStorage(
    [{ date_start: '2026-08-05', date_stop: '2026-08-05', spend: '1' }],
    'client-1',
    'act_9'
  );
  assert.equal(row.campaignId, ACCOUNT_LEVEL_CAMPAIGN_ID);
  assert.notEqual(row.campaignId, null);
});

test('error codes map to typed errors, including 272 for an unreachable account', async () => {
  const original = global.fetch;
  const opts = { since: '2026-08-01', until: '2026-08-31' };
  try {
    global.fetch = async () => Response.json({ error: { code: 190 } }, { status: 400 });
    await assert.rejects(fetchAdInsights('123', 't', opts), TokenExpiredError);

    global.fetch = async () => Response.json({ error: { code: 272 } }, { status: 400 });
    await assert.rejects(fetchAdInsights('123', 't', opts), InsufficientPermissionsError);

    global.fetch = async () => Response.json({ error: { code: 17 } }, { status: 400 });
    await assert.rejects(fetchAdInsights('123', 't', opts), RateLimitedError);
  } finally {
    global.fetch = original;
  }
});

test('an exhausted usage header stops the sync instead of retrying inline', async () => {
  const original = global.fetch;
  try {
    global.fetch = async () =>
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'x-business-use-case-usage': JSON.stringify({ '123': [{ call_count: 95, total_time: 10, total_cputime: 5 }] }),
        },
      });

    await assert.rejects(
      fetchAdInsights('123', 't', { since: '2026-08-01', until: '2026-08-31' }),
      RateLimitedError
    );
  } finally {
    global.fetch = original;
  }
});
