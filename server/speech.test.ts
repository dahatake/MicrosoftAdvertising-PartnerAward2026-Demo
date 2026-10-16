// @vitest-environment node
// FR-007 / NFR-SEC-001 の単体・結合テスト（Azure Speech はモック）
import { describe, it, expect, vi } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
// @ts-expect-error JS module
import { createHandler, TOKEN_TTL_SECONDS, RATE_LIMIT_PER_MINUTE } from './speech.js';

const KEY = 'k3y-SECRET-0123456789abcdef0123456789';

async function run(opts: Record<string, unknown>, calls = 1, method = 'POST') {
  const server = http.createServer(createHandler(opts));
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as AddressInfo).port;
  const out: { status: number; text: string }[] = [];
  for (let i = 0; i < calls; i++) {
    const r = await fetch(`http://127.0.0.1:${port}/api/speech/token`, { method });
    out.push({ status: r.status, text: await r.text() });
  }
  await new Promise((r) => server.close(r));
  return out;
}
const okFetch = () => vi.fn(async () => new Response('mock-token', { status: 200 }));
const ENV = { SPEECH_KEY: KEY, SPEECH_REGION: 'japaneast' };

describe('FR-007', () => {
  // FR-007 AC-019
  it('AC-019 応答はトークン・リージョン・有効期間だけで、キーを含まない', async () => {
    const f = okFetch();
    const [r] = await run({ env: ENV, fetchImpl: f, log: () => {} });
    expect(r.status).toBe(200);
    const body = JSON.parse(r.text);
    expect(Object.keys(body).sort()).toEqual(['expiresInSeconds', 'region', 'token']);
    expect(body.token).toBe('mock-token');
    expect(r.text).not.toContain(KEY);
    const init = (f.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>)['Ocp-Apim-Subscription-Key']).toBe(KEY);
  });

  // FR-007 AC-020
  it('AC-020 キー未設定は 503 と SPEECH_KEY_MISSING', async () => {
    const [r] = await run({ env: {}, fetchImpl: okFetch(), log: () => {} });
    expect(r.status).toBe(503);
    expect(JSON.parse(r.text).error).toBe('SPEECH_KEY_MISSING');
  });

  // FR-007 AC-021
  it('AC-021 同一接続元が上限を超えると 429', async () => {
    const rs = await run({ env: ENV, fetchImpl: okFetch(), log: () => {} }, RATE_LIMIT_PER_MINUTE + 1);
    expect(rs.slice(0, RATE_LIMIT_PER_MINUTE).every((x) => x.status === 200)).toBe(true);
    expect(rs[RATE_LIMIT_PER_MINUTE].status).toBe(429);
  });

  // FR-007 AC-021（窓の経過で復帰）
  it('AC-021 1 分経過すると再び呼べる', async () => {
    let t = 0;
    const rs = await run({ env: ENV, fetchImpl: okFetch(), now: () => (t += 3000), log: () => {} }, RATE_LIMIT_PER_MINUTE + 5);
    expect(rs.every((x) => x.status === 200)).toBe(true);
  });

  // FR-007 AC-022
  it('AC-022 有効期間は PARAM-005（10 分=600 秒）', async () => {
    expect(TOKEN_TTL_SECONDS).toBe(600);
    const [r] = await run({ env: ENV, fetchImpl: okFetch(), log: () => {} });
    expect(JSON.parse(r.text).expiresInSeconds).toBe(600);
  });

  it('POST 以外は 405、上流失敗は 502', async () => {
    const [g] = await run({ env: ENV, log: () => {} }, 1, 'GET');
    expect(g.status).toBe(405);
    const bad = vi.fn(async () => new Response('x', { status: 401 }));
    const [r] = await run({ env: ENV, fetchImpl: bad, log: () => {} });
    expect(r.status).toBe(502);
  });
});

describe('NFR-SEC-001', () => {
  // NFR-SEC-001 AC-062
  it('AC-062 .env・AzureSpeech.txt が管理対象外で、追跡ファイルにキーらしい文字列がない', () => {
    const gi = readFileSync('.gitignore', 'utf8');
    expect(gi).toMatch(/^\.env$/m);
    expect(gi).toMatch(/^AzureSpeech\.txt$/m);
    const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean);
    expect(files.some((f) => /(^|\/)\.env$|AzureSpeech\.txt$/.test(f))).toBe(false);
    const sk = /SPEECH_KEY\s*=\s*[0-9a-zA-Z]{24,}/;
    const hex32 = /\b[0-9a-f]{32}\b/;
    for (const f of files) {
      if (!/\.(ts|tsx|js|json|md|html|example|txt|yml)$/.test(f) || f.includes('package-lock') || f.startsWith('EABK-') || f.startsWith('docs/baseline')) continue;
      if (!existsSync(f)) continue;
      const s = readFileSync(f, 'utf8');
      expect(sk.test(s), f).toBe(false);
      if (f.startsWith('src/') || f.startsWith('server/')) expect(hex32.test(s), f).toBe(false);
    }
  });

  // NFR-SEC-001 AC-063
  it('AC-063 応答・ログにキーが出ず、クライアントのソースとビルド成果物がキーを参照しない', async () => {
    const logs: string[] = [];
    const rs = await run({ env: ENV, fetchImpl: vi.fn(async () => new Response('nope', { status: 500 })), log: (m: string) => logs.push(m) }, 2);
    const rs2 = await run({ env: {}, log: (m: string) => logs.push(m) });
    for (const r of [...rs, ...rs2]) expect(r.text).not.toContain(KEY);
    expect(logs.join('\n')).not.toContain(KEY);
    const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
    for (const dir of ['src', 'dist']) {
      if (!existsSync(dir)) continue;
      for (const f of walk(dir)) {
        if (!/\.(ts|tsx|js|css|html)$/.test(f) || /\.test\.tsx?$/.test(f)) continue;
        expect(readFileSync(f, 'utf8'), f).not.toContain('SPEECH_KEY');
      }
    }
  });
});
