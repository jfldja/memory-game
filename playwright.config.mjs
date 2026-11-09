// 端對端測試設定（spec.md 12.3）。
// 測試前必須先執行 node scripts/build.mjs（CI 以 BUILD_SHA 指定 PR head commit 建置）。
import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;
// NFR-6 真實時間量測：只在 *-realtime project 執行，CI 以 --workers=1 在一般測試之後單獨執行
const REALTIME = /timing-real\.spec\.mjs$/;

const ENGINES = [
  ['chromium', devices['Desktop Chrome']],
  ['firefox', devices['Desktop Firefox']],
  ['webkit', devices['Desktop Safari']],
];

export default defineConfig({
  testDir: 'tests/acceptance/e2e',
  retries: 0, // 重試會掩蓋計時問題
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
  },
  webServer: {
    command: `node scripts/serve.mjs dist ${PORT}`,
    url: `${BASE_URL}/`,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    ...ENGINES.map(([name, device]) => ({ name, use: { ...device }, testIgnore: REALTIME })),
    ...ENGINES.map(([name, device]) => ({ name: `${name}-realtime`, use: { ...device }, testMatch: REALTIME })),
  ],
});
