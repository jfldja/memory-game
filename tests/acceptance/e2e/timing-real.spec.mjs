// 驗收測試（端對端層）：NFR-6 計時準確（真實時間，不安裝時鐘）。
// 只由 *-realtime project 以單一 worker、在一般測試之後執行（playwright.config.mjs、spec.md 12.3）。
// 骨架：PR-4 轉為實際測試（acceptance-test-plan.md 第 2 節 #54、第 4 節第 5 點）。
// 轉實測時：判定為區間兩端都在 ±0.2 秒內（|d−lo|≤0.2 且 |d−hi|≤0.2），不得以「與區間的距離」判定；
// 區間寬度只作診斷輸出；test.setTimeout(120_000)；三個長度依序執行。
import { test } from '@playwright/test';

test.skip('NFR-6 10 秒：已用時間顯示值與實際經過時間的誤差在 ±0.2 秒內', async () => {});
test.skip('NFR-6 60 秒：已用時間顯示值與實際經過時間的誤差在 ±0.2 秒內', async () => {});
test.skip('NFR-6 89 秒：已用時間顯示值與實際經過時間的誤差在 ±0.2 秒內', async () => {});
