/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 開発時は /api を Speech トークン発行サーバー（npm run server、既定 8787）へ中継する
  server: { proxy: { '/api': `http://localhost:${process.env.PORT ?? 8787}` } },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'server/**/*.test.ts'],
  },
});
