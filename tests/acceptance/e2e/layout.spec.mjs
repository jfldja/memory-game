// 驗收測試（端對端層）：NFR-3、NFR-5（分範圍）、NFR-4（Should，DQ-10 啟用）。
// 骨架：NFR-3、NFR-4、NFR-5 遊戲畫面／選單／結果畫面於 PR-4；NFR-5 清除紀錄對話框於 PR-5 轉為實際測試
// （acceptance-test-plan.md 第 2 節 #52、#53、第 3 節）。
// NFR-5 每個範圍各一個測試，名稱為「編號＋範圍」，未完成的範圍保持略過（spec.md 12.2 第 7 點）。
import { test } from '@playwright/test';

test.skip('NFR-3 五種視窗尺寸下遊戲中 12 張牌全部在視窗內，頁面無垂直與水平捲動', async () => {});
test.skip('NFR-4 844×390 視窗下遊戲中 12 張牌全部在視窗內，頁面無捲動', async () => {});
test.skip('NFR-5 遊戲畫面：360×640 下每張牌與每個可見按鈕至少 44×44（含暫停中）', async () => {});
test.skip('NFR-5 選單：360×640 下每個可見按鈕至少 44×44', async () => {});
test.skip('NFR-5 結果畫面：360×640 下勝利與失敗畫面每個可見按鈕至少 44×44', async () => {});
test.skip('NFR-5 清除紀錄對話框：360×640 下每個可見按鈕至少 44×44', async () => {});
