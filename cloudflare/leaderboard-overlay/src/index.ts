const LEADERBOARD_KEY = 'leaderboard/latest.json';
const MAX_PUBLISH_BYTES = 128 * 1024;

type LeaderboardColumn = {
  key: string;
  label: string;
};

type LeaderboardRow = {
  rank: number;
  name: string;
  location: string;
  eliminated: boolean;
  scores: Record<string, number>;
};

type LeaderboardSnapshot = {
  version: 1;
  title: string;
  publishedAt: string;
  latestGame: string;
  columns: LeaderboardColumn[];
  rows: LeaderboardRow[];
};

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function isShortString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length <= maxLength;
}

function isValidSnapshot(value: unknown): value is LeaderboardSnapshot {
  if (!value || typeof value !== 'object') return false;

  const snapshot = value as Partial<LeaderboardSnapshot>;
  if (
    snapshot.version !== 1 ||
    !isShortString(snapshot.title, 100) ||
    !isShortString(snapshot.latestGame, 20) ||
    !Array.isArray(snapshot.columns) ||
    snapshot.columns.length > 3 ||
    !Array.isArray(snapshot.rows) ||
    snapshot.rows.length > 100
  ) {
    return false;
  }

  const columnsAreValid = snapshot.columns.every(
    (column) =>
      column &&
      typeof column === 'object' &&
      isShortString(column.key, 20) &&
      isShortString(column.label, 30)
  );

  const rowsAreValid = snapshot.rows.every(
    (row) =>
      row &&
      typeof row === 'object' &&
      Number.isInteger(row.rank) &&
      row.rank > 0 &&
      isShortString(row.name, 100) &&
      isShortString(row.location, 100) &&
      typeof row.eliminated === 'boolean' &&
      row.scores &&
      typeof row.scores === 'object' &&
      Object.values(row.scores).every(
        (score) => typeof score === 'number' && Number.isFinite(score)
      )
  );

  return columnsAreValid && rowsAreValid;
}

function isAuthorized(request: Request, secret: string): boolean {
  const authorization = request.headers.get('Authorization') || '';
  const prefix = 'Bearer ';
  if (!authorization.startsWith(prefix)) return false;

  const suppliedSecret = new TextEncoder().encode(
    authorization.slice(prefix.length)
  );
  const expectedSecret = new TextEncoder().encode(secret);

  if (suppliedSecret.byteLength !== expectedSecret.byteLength) return false;
  const subtleCrypto = crypto.subtle as SubtleCrypto & {
    timingSafeEqual(
      left: ArrayBuffer | ArrayBufferView,
      right: ArrayBuffer | ArrayBufferView
    ): boolean;
  };
  return subtleCrypto.timingSafeEqual(suppliedSecret, expectedSecret);
}

async function getLeaderboard(env: Env): Promise<Response> {
  const object = await env.LEADERBOARD_BUCKET.get(LEADERBOARD_KEY);

  if (!object) {
    return jsonResponse({
      version: 1,
      title: 'Current Standings',
      publishedAt: '',
      latestGame: 'game1',
      columns: [],
      rows: [],
    });
  }

  return new Response(object.body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ETag: object.httpEtag,
    },
  });
}

async function publishLeaderboard(request: Request, env: Env): Promise<Response> {
  if (!isAuthorized(request, env.PUBLISH_SECRET)) {
    return jsonResponse({ message: 'Unauthorized' }, 401);
  }

  const contentLength = Number(request.headers.get('Content-Length'));
  if (!Number.isFinite(contentLength) || contentLength > MAX_PUBLISH_BYTES) {
    return jsonResponse({ message: 'Invalid payload size' }, 413);
  }

  let value: unknown;
  try {
    value = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid JSON' }, 400);
  }

  if (!isValidSnapshot(value)) {
    return jsonResponse({ message: 'Invalid leaderboard snapshot' }, 400);
  }

  const snapshot: LeaderboardSnapshot = {
    ...value,
    publishedAt: new Date().toISOString(),
  };

  await env.LEADERBOARD_BUCKET.put(
    LEADERBOARD_KEY,
    JSON.stringify(snapshot),
    {
      httpMetadata: {
        contentType: 'application/json; charset=utf-8',
        cacheControl: 'no-store',
      },
    }
  );

  console.log(
    JSON.stringify({
      event: 'leaderboard_published',
      rowCount: snapshot.rows.length,
      publishedAt: snapshot.publishedAt,
    })
  );

  return jsonResponse({ success: true, publishedAt: snapshot.publishedAt });
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname !== '/api/leaderboard') {
      return env.ASSETS.fetch(request);
    }

    if (request.method === 'GET') return getLeaderboard(env);
    if (request.method === 'POST') return publishLeaderboard(request, env);

    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: 'GET, POST' },
    });
  },
} satisfies ExportedHandler<Env>;
