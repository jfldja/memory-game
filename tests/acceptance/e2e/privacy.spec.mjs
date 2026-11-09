// 驗收測試（端對端層）：NFR-7 隱私（分範圍）。
// 依據：需求文件 v1.1 NFR-7；acceptance-test-plan.md 第 2 節 #55。
// 「NFR-7 首頁」於 PR-1 轉為實際測試；選單、三關遊玩、結果畫面於 PR-4 轉為實際測試（未完成的範圍保持略過）。
// PR-4 以選單取代首頁後，「NFR-7 首頁」仍須通過（spec.md 第 14 節）。
import { test, expect } from '@playwright/test';

/** 不經網路的 URL 配置：不算「對網域發出請求」。其餘一律必須與受測站同源。 */
const NON_NETWORK_PROTOCOLS = new Set(['data:', 'blob:', 'about:']);

/**
 * 在 context 層記錄全部請求（含頁面、子資源、worker 與失敗的請求）。
 * 必須在 page.goto 之前呼叫。
 */
function recordRequests(context) {
  const urls = [];
  context.on('request', (req) => urls.push(req.url()));
  return urls;
}

/** 回傳不屬於受測站、且會經過網路的請求。 */
function foreignRequests(urls, baseURL) {
  const site = new URL(baseURL).origin;
  return urls.filter((u) => {
    const url = new URL(u);
    if (NON_NETWORK_PROTOCOLS.has(url.protocol)) return false;
    return url.origin !== site;
  });
}

test('NFR-7 首頁：載入首頁的全部請求都只送往本站，且沒有設定任何 cookie', async ({ page, context, baseURL }) => {
  const urls = recordRequests(context);

  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // 確認頁面腳本確實執行過（否則「沒有外部請求」可能只是因為頁面沒有載入）
  await expect(page.locator('[data-testid="version"]')).not.toBeEmpty();

  expect(urls.length, '至少應記錄到首頁本身的請求').toBeGreaterThan(0);
  expect(urls.some((u) => new URL(u).pathname === '/'), '應記錄到首頁文件的請求').toBe(true);
  expect(foreignRequests(urls, baseURL), `送往其他網域的請求：\n${urls.join('\n')}`).toEqual([]);

  expect(await context.cookies()).toEqual([]);
  expect(await page.evaluate(() => document.cookie)).toBe('');
});

test.skip('NFR-7 選單：選單畫面的全部請求都只送往本站，且沒有 cookie', async () => {});
test.skip('NFR-7 三關遊玩：三關遊玩過程的全部請求都只送往本站，且沒有 cookie', async () => {});
test.skip('NFR-7 結果畫面：勝利與失敗畫面的全部請求都只送往本站，且沒有 cookie', async () => {});
