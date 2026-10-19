import { defineConfig } from '@playwright/test';

// System Test は tests/system の spec を、build 済みの成果物を preview（port 4317）で配信して実行する。
// 既定は port 4317・BASE_URL=http://localhost:4317。他のプロセスが 4317 を使っているときは PREVIEW_PORT で変える。
// 台帳のケース（command が `npx playwright test ...`）はそれぞれこの webServer で同じ port を使い、build も行うため、
// `ledger.py run` では scripts/ebak.config.json の system_test.serial_patterns（"npx playwright"）で 1 件ずつ直列に実行する
// （port の衝突を防ぎ、NFR-PERF-001 AC-059 などの時間の計測を並列の build でゆがめないため）。
const port = Number(process.env.PREVIEW_PORT ?? 4317);
process.env.BASE_URL ??= `http://localhost:${port}`;

export default defineConfig({
  testDir: 'tests/system',
  testMatch: '**/*.spec.ts',
  use: { baseURL: process.env.BASE_URL },
  webServer: process.env.NO_WEB_SERVER
    ? undefined
    : {
        command: `npm run build && npx vite preview --port ${port} --strictPort`,
        url: process.env.BASE_URL,
        // 別のアプリが同じ port で動いていると誤って使うので、既存のサーバーは再利用しない
        reuseExistingServer: false,
        timeout: 180_000,
      },
});
