// 驗收測試（端對端層）：AC-TM-1～AC-TM-5（控制時鐘）。
// 骨架：AC-TM-1～4 於 PR-4、AC-TM-5 於 PR-5（需要紀錄顯示）轉為實際測試（acceptance-test-plan.md 第 2 節 #9～#13）。
// NFR-6（真實時間）不在本檔，見 timing-real.spec.mjs。
import { test } from '@playwright/test';

test.skip('AC-TM-1 進入關卡後尚未翻牌，等待 3 秒：已用時間顯示 0.0', async () => {});
test.skip('AC-TM-2 實際已用 12.38 秒顯示 12.3、12.40 秒顯示 12.4（無條件捨去）', async () => {});
test.skip('AC-TM-3 沒有翻開的牌時翻開一張：步數仍為 0', async () => {});
test.skip('AC-TM-4 完成 3 次配對嘗試：畫面顯示步數 3', async () => {});
test.skip('AC-TM-5 以顯示值 42.3 秒配對最後一對，等待 3 秒：勝利畫面與紀錄都是 42.3', async () => {});
