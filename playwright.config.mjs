// 端對端測試設定（spec.md 12.3）。
// 測試前必須先執行 node scripts/build.mjs（CI 以 job 層級的 BUILD_SHA 指定 PR head commit 建置）。
// 自訂 reporter 的結果檔（spec.md 12.2.1）：預設 acceptance-results/playwright.jsonl，
// 以環境變數 ACCEPTANCE_RESULTS_FILE 指定（CI 的一般與 realtime 兩次執行各用一個檔名）。
// 結果檔不放在 test-results/：Playwright 每次執行開始時會清空 outputDir。
import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;
// NFR-6 真實時間量測：只在 *-realtime project 執行，CI 以 --workers=1 在一般測試之後單獨執行
const REALTIME = /timing-real\.spec\.mjs$/;
// 一般 project 只執行 *.spec.mjs（與 spec.md 12.2 第 4 點一致；其他副檔名的測試檔由 acceptance-ids 判定失敗）
const SPEC_FILES = /\.spec\.mjs$/;
const RESULTS_FILE = process.env.ACCEPTANCE_RESULTS_FILE || 'acceptance-results/playwright.jsonl';

const ENGINES = [
  ['chromium', devices['Desktop Chrome']],
  ['firefox', devices['Desktop Firefox']],
  ['webkit', devices['Desktop Safari']],
];

export default defineConfig({
  testDir: 'tests/acceptance/e2e',
  retries: 0, // 重試會掩蓋計時問題
  forbidOnly: Boolean(process.env.CI),
  reporter: [['list'], ['./scripts/acceptance-reporter-pw.mjs', { outputFile: RESULTS_FILE }]],
  use: {
    baseURL: BASE_URL,
  },
  webServer: {
    command: `node scripts/serve.mjs dist ${PORT}`,
    url: `${BASE_URL}/`,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    ...ENGINES.map(([name, device]) => ({ name, use: { ...device }, testMatch: SPEC_FILES, testIgnore: REALTIME })),
    ...ENGINES.map(([name, device]) => ({ name: `${name}-realtime`, use: { ...device }, testMatch: REALTIME })),
  ],
});
