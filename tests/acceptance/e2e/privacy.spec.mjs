// 驗收測試（端對端層）：NFR-7 隱私（分範圍）。
// 骨架：「NFR-7 首頁」於 PR-1；選單、三關遊玩、結果畫面於 PR-4 轉為實際測試（acceptance-test-plan.md 第 2 節 #55）。
// 每個範圍各一個測試，名稱為「編號＋範圍」，未完成的範圍保持略過（spec.md 12.2 第 7 點）。
import { test } from '@playwright/test';

test.skip('NFR-7 首頁：載入首頁的全部請求都只送往本站，且沒有設定任何 cookie', async () => {});
test.skip('NFR-7 選單：選單畫面的全部請求都只送往本站，且沒有 cookie', async () => {});
test.skip('NFR-7 三關遊玩：三關遊玩過程的全部請求都只送往本站，且沒有 cookie', async () => {});
test.skip('NFR-7 結果畫面：勝利與失敗畫面的全部請求都只送往本站，且沒有 cookie', async () => {});
