// FR-007 Speech トークン発行バックエンド（Node 標準の http だけで動く軽量サーバー）。
// キーは環境変数 SPEECH_KEY / SPEECH_REGION にだけ置く（NFR-SEC-001）。応答・ログにキーを出さない。
import http from 'node:http';

/** PARAM-005: Speech 認可トークンの有効期間（秒）。10 分。 */
export const TOKEN_TTL_SECONDS = 10 * 60;
/** PARAM-008: 同一接続元あたりの上限（回/分）。 */
export const RATE_LIMIT_PER_MINUTE = 30;
const WINDOW_MS = 60_000;

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

/**
 * @param {{ env?: Record<string,string|undefined>, fetchImpl?: typeof fetch, now?: () => number,
 *           log?: (msg: string) => void }} [opts]
 */
export function createHandler(opts = {}) {
  const env = opts.env ?? process.env;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const now = opts.now ?? Date.now;
  const log = opts.log ?? ((m) => console.log(m));
  const hits = new Map(); // 接続元 → 窓の開始時刻と回数

  function limited(ip) {
    const t = now();
    const h = hits.get(ip);
    if (!h || t - h.start >= WINDOW_MS) {
      hits.set(ip, { start: t, count: 1 });
      return false;
    }
    h.count += 1;
    return h.count > RATE_LIMIT_PER_MINUTE;
  }

  return async function handler(req, res) {
    const url = (req.url ?? '').split('?')[0];
    if (url !== '/api/speech/token') return send(res, 404, { error: 'NOT_FOUND' });
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return send(res, 405, { error: 'METHOD_NOT_ALLOWED' });
    }
    if (limited(req.socket?.remoteAddress ?? 'unknown')) {
      res.setHeader('Retry-After', '60');
      return send(res, 429, { error: 'RATE_LIMITED' });
    }
    const key = env.SPEECH_KEY;
    const region = env.SPEECH_REGION;
    if (!key || !region) {
      log('speech token: SPEECH_KEY/SPEECH_REGION not configured');
      return send(res, 503, { error: 'SPEECH_KEY_MISSING' });
    }
    try {
      const r = await fetchImpl(`https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
        method: 'POST',
        headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Length': '0' },
      });
      if (!r.ok) {
        log(`speech token: upstream status ${r.status}`);
        return send(res, 502, { error: 'SPEECH_UPSTREAM_ERROR' });
      }
      const token = await r.text();
      return send(res, 200, { token, region, expiresInSeconds: TOKEN_TTL_SECONDS });
    } catch {
      log('speech token: upstream request failed');
      return send(res, 502, { error: 'SPEECH_UPSTREAM_ERROR' });
    }
  };
}

export function startServer(port = Number(process.env.PORT ?? 8787), opts = {}) {
  const server = http.createServer(createHandler(opts));
  server.listen(port, () => console.log(`speech token server listening on :${port}`));
  return server;
}
