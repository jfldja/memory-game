// 驗收測試（端對端層）：AC-EQ-9（EQ-9）。PR-1 轉為實際測試。
// 依據：需求文件 v1.1 AC-EQ-9；acceptance-test-plan.md v0.5.1 第 2 節 #51；spec.md 第 11 節、4.11（版本號 [data-testid="version"]）。
//
// 需求的 Given 是「主分支最新 commit 為 X 的部署」：公開網址的部分由 deploy.yml 的
// 「AC-EQ-9（部署）與 EQ-12 證據」步驟驗證；本檔驗證「以 commit X 建置的頁面顯示可對應到 X 的版本號」。
//
// 第一個測試自行以「正式的建置指令」建置到暫存目錄，BUILD_SHA 取版本庫目前的 HEAD，
// 不依賴 CI 是否把 BUILD_SHA 傳給測試步驟，也不改動其他測試共用的 dist/。
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../../../scripts/serve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
/** spec.md 第 11 節：本輪 package.json 的 version 固定為 1.0.0。 */
const APP_SEMVER = '1.0.0';

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

/** 由版本號中的短碼找回 commit（「可由版本號辨識對應的 commit」）。找不到時丟出例外。 */
function resolveShort(short) {
  return git(['rev-parse', '--verify', '--quiet', `${short}^{commit}`]);
}

test('AC-EQ-9 以 commit X 建置後開啟頁面：版本號為 1.0.0+<X 前 7 碼>，且由版本號可找回 commit X', async ({ page }) => {
  const sha = git(['rev-parse', 'HEAD']);
  expect(sha).toMatch(/^[0-9a-f]{40}$/);

  // 暫存版本庫：只放建置需要的檔案，以正式的建置指令（node scripts/build.mjs）建置
  const tmp = mkdtempSync(path.join(tmpdir(), 'ac-eq-9-'));
  let server;
  try {
    for (const p of ['package.json', 'src', 'scripts']) cpSync(path.join(ROOT, p), path.join(tmp, p), { recursive: true });
    execFileSync(process.execPath, [path.join(tmp, 'scripts/build.mjs')], {
      env: { ...process.env, BUILD_SHA: sha },
      stdio: 'pipe',
    });
    server = await startServer({ root: path.join(tmp, 'dist'), port: 0 });
    const { port } = server.address();

    await page.goto(`http://127.0.0.1:${port}/`);
    const version = page.locator('[data-testid="version"]');
    await expect(version).toBeVisible();
    await expect(version).toHaveText(`${APP_SEMVER}+${sha.slice(0, 7)}`);

    // 由畫面上的版本號反查：短碼在版本庫中唯一對應到 commit X
    const shown = (await version.textContent()).trim();
    const short = shown.split('+')[1];
    expect(resolveShort(short)).toBe(sha);
  } finally {
    if (server) await new Promise((r) => server.close(r));
    rmSync(tmp, { recursive: true, force: true });
  }
});

// PR-1b（acceptance-test-plan.md #51、spec.md 第 11 節、PR-1 審查 N-6）：在 CI 中（環境變數 CI 存在時）
// 必須取得 BUILD_SHA（e2e job 層級設定，建置與本測試讀同一個值），缺少即失敗，不得退回只檢查格式。
// 本機（沒有 CI）未指定 BUILD_SHA 時只檢查格式；指定時同樣比對。
test('AC-EQ-9 受測建置（dist/）的頁面顯示含 7 碼 commit 短碼的版本號；在 CI 中必須取得 BUILD_SHA 且等於其前 7 碼', async ({ page }) => {
  const buildSha = (process.env.BUILD_SHA ?? '').trim().toLowerCase();
  if (process.env.CI) {
    expect(buildSha, 'CI 中必須以 BUILD_SHA 指定受測建置的 commit（e2e job 層級 env）').toMatch(/^[0-9a-f]{40}$/);
  }

  await page.goto('/');
  const version = page.locator('[data-testid="version"]');
  await expect(version).toBeVisible();
  // 不接受開發用的「+dev」：受測建置必須能對應到 commit
  await expect(version).toHaveText(new RegExp(`^${APP_SEMVER.replace(/\./g, '\\.')}\\+[0-9a-f]{7}$`));
  if (buildSha) {
    await expect(version).toHaveText(`${APP_SEMVER}+${buildSha.slice(0, 7)}`);
  }
});
