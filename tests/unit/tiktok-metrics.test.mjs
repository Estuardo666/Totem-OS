import assert from 'node:assert/strict';
import test from 'node:test';

process.env.TIKTOK_CLIENT_KEY = 'test-key';
process.env.TIKTOK_CLIENT_SECRET = 'test-secret';
process.env.NEXT_PUBLIC_APP_URL = 'https://totem.test';

const { getTikTokAuthorizationUrl, exchangeTikTokCodeForToken, refreshTikTokToken, TikTokAuthError, TIKTOK_SCOPES } =
  await import('../../src/lib/tiktok/auth-service.ts');
const { fetchTikTokProfileStats, fetchTikTokVideos, transformTikTokForStorage } =
  await import('../../src/lib/tiktok/metrics-service.ts');

test('the authorization URL carries only read scopes', () => {
  const url = new URL(getTikTokAuthorizationUrl('state-123'));

  assert.equal(url.origin + url.pathname, 'https://www.tiktok.com/v2/auth/authorize/');
  assert.equal(url.searchParams.get('client_key'), 'test-key');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('state'), 'state-123');
  assert.equal(
    url.searchParams.get('redirect_uri'),
    'https://totem.test/api/auth/callback/tiktok'
  );

  // El secreto nunca viaja en una URL que ve el navegador.
  assert.equal(url.searchParams.has('client_secret'), false);

  const scopes = url.searchParams.get('scope').split(',');
  assert.deepEqual(scopes, [...TIKTOK_SCOPES]);
  // Ningún permiso de escritura: Totem no publica en TikTok.
  assert.equal(scopes.some((s) => /publish|upload|manage/.test(s)), false);
});

test('the code exchange posts form-encoded credentials', async () => {
  const original = global.fetch;
  let seen = null;
  try {
    global.fetch = async (url, options) => {
      seen = { url: String(url), method: options.method, body: options.body, headers: options.headers };
      return Response.json({
        access_token: 'at',
        refresh_token: 'rt',
        expires_in: 86400,
        refresh_expires_in: 31536000,
        open_id: 'oid',
        scope: 'user.info.basic',
        token_type: 'Bearer',
      });
    };

    const token = await exchangeTikTokCodeForToken('the-code');

    assert.equal(seen.url, 'https://open.tiktokapis.com/v2/oauth/token/');
    assert.equal(seen.method, 'POST');
    assert.equal(seen.headers['Content-Type'], 'application/x-www-form-urlencoded');

    const body = new URLSearchParams(seen.body);
    assert.equal(body.get('grant_type'), 'authorization_code');
    assert.equal(body.get('code'), 'the-code');
    assert.equal(body.get('client_secret'), 'test-secret');

    assert.equal(token.access_token, 'at');
    assert.equal(token.refresh_token, 'rt');
  } finally {
    global.fetch = original;
  }
});

test('refreshing uses the refresh_token grant', async () => {
  const original = global.fetch;
  let body = null;
  try {
    global.fetch = async (url, options) => {
      body = new URLSearchParams(options.body);
      return Response.json({
        access_token: 'new-at',
        refresh_token: 'new-rt',
        expires_in: 86400,
        refresh_expires_in: 31536000,
        open_id: 'oid',
        scope: '',
        token_type: 'Bearer',
      });
    };

    const token = await refreshTikTokToken('old-rt');

    assert.equal(body.get('grant_type'), 'refresh_token');
    assert.equal(body.get('refresh_token'), 'old-rt');
    // TikTok rota el refresh_token: guardar el viejo dejaría la cuenta muerta.
    assert.equal(token.refresh_token, 'new-rt');
  } finally {
    global.fetch = original;
  }
});

test('an error inside a 200 response is still an error', async () => {
  // TikTok responde 200 y señala el fallo en el cuerpo; mirar solo el status
  // dejaría pasar errores como si fueran datos.
  const original = global.fetch;
  try {
    global.fetch = async () =>
      Response.json({ error: 'invalid_grant', error_description: 'refresh token expired' });
    await assert.rejects(refreshTikTokToken('dead'), TikTokAuthError);

    global.fetch = async () =>
      Response.json({ error: 'invalid_request', error_description: 'bad client' });
    await assert.rejects(refreshTikTokToken('x'), /bad client/);
  } finally {
    global.fetch = original;
  }
});

test('an expired access token surfaces as an auth error, not a generic one', async () => {
  const original = global.fetch;
  try {
    global.fetch = async () =>
      Response.json({ error: { code: 'access_token_invalid', message: 'expired' } });
    await assert.rejects(fetchTikTokProfileStats('at'), TikTokAuthError);
  } finally {
    global.fetch = original;
  }
});

test('profile stats are read with a bearer token and coerced to numbers', async () => {
  const original = global.fetch;
  let auth = null;
  let hasTokenInUrl = null;
  try {
    global.fetch = async (url, options) => {
      auth = options.headers.Authorization;
      hasTokenInUrl = new URL(url).searchParams.has('access_token');
      return Response.json({
        data: {
          user: {
            open_id: 'oid',
            display_name: 'Transcity',
            follower_count: 11,
            likes_count: 0,
            video_count: 3,
          },
        },
        error: { code: 'ok' },
      });
    };

    const stats = await fetchTikTokProfileStats('the-token');

    assert.equal(auth, 'Bearer the-token');
    assert.equal(hasTokenInUrl, false, 'el token nunca va en la URL');
    assert.equal(stats.followerCount, 11);
    assert.equal(stats.videoCount, 3);
    // Un campo ausente vale 0, no NaN ni undefined.
    assert.equal(stats.followingCount, 0);
  } finally {
    global.fetch = original;
  }
});

test('videos convert create_time from unix seconds', async () => {
  const original = global.fetch;
  try {
    global.fetch = async () =>
      Response.json({
        data: {
          videos: [
            { id: 'v1', title: 'Uno', create_time: 1789000000, view_count: 500, like_count: 20 },
          ],
        },
        error: { code: 'ok' },
      });

    const [video] = await fetchTikTokVideos('at');

    assert.equal(video.id, 'v1');
    assert.equal(video.viewCount, 500);
    assert.equal(video.createdAt.getTime(), 1789000000 * 1000);
    assert.equal(video.commentCount, 0);
  } finally {
    global.fetch = original;
  }
});

test('snapshots are dated at UTC midnight so a double run deduplicates', () => {
  const stats = {
    openId: 'oid',
    displayName: 'x',
    avatarUrl: null,
    followerCount: 11,
    followingCount: 1,
    likesCount: 0,
    videoCount: 3,
  };

  const morning = transformTikTokForStorage(stats, [], 'c1', new Date('2026-09-10T08:30:00Z'));
  const evening = transformTikTokForStorage(stats, [], 'c1', new Date('2026-09-10T23:59:00Z'));

  assert.equal(morning[0].date.toISOString(), '2026-09-10T00:00:00.000Z');
  assert.equal(evening[0].date.getTime(), morning[0].date.getTime());
  assert.equal(morning.every((r) => r.platform === 'TIKTOK'), true);
});

test('a profile with no videos still stores its snapshot', () => {
  const rows = transformTikTokForStorage(
    { openId: 'o', displayName: 'x', avatarUrl: null, followerCount: 11, followingCount: 0, likesCount: 0, videoCount: 0 },
    [],
    'c1'
  );

  const names = rows.map((r) => r.metricName);
  assert.deepEqual(names, ['follower_count', 'likes_count', 'video_count']);
});

test('video metrics are summed across the returned videos', () => {
  const rows = transformTikTokForStorage(
    { openId: 'o', displayName: 'x', avatarUrl: null, followerCount: 11, followingCount: 0, likesCount: 5, videoCount: 2 },
    [
      { id: 'a', title: '', coverImageUrl: null, shareUrl: null, createdAt: new Date(), viewCount: 100, likeCount: 10, commentCount: 2, shareCount: 1 },
      { id: 'b', title: '', coverImageUrl: null, shareUrl: null, createdAt: new Date(), viewCount: 50, likeCount: 5, commentCount: 0, shareCount: 3 },
    ],
    'c1'
  );

  const byName = Object.fromEntries(rows.map((r) => [r.metricName, r.value]));
  assert.equal(byName.video_views, 150);
  assert.equal(byName.video_likes, 15);
  assert.equal(byName.video_shares, 4);
  // El total del perfil no se mezcla con la suma de la ventana de videos.
  assert.equal(byName.likes_count, 5);
});
