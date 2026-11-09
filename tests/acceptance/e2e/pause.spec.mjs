// 驗收測試（端對端層）：AC-PS-1～AC-PS-4、AC-PS-7、AC-PS-9、AC-PS-10；設計補充驗收 AC-PS-5、AC-PS-8（Should，DQ-10 啟用）。
// 骨架：AC-PS-1～4、9、10 於 PR-4；AC-PS-7 於 PR-5（需要紀錄顯示）；AC-PS-5、AC-PS-8 於 PR-6 轉為實際測試
// （acceptance-test-plan.md 第 2 節 #32～#38、第 3 節；spec.md 第 15 節）。
import { test } from '@playwright/test';

test.skip('AC-PS-1 暫停後等待 3 秒：已用時間顯示值不變', async () => {});
test.skip('AC-PS-2 暫停中點擊背面的牌：繼續後該牌仍背面、步數不變', async () => {});
test.skip('AC-PS-3 繼續後等待 2 秒：已用時間介於 X+1.8 與 X+2.2', async () => {});
test.skip('AC-PS-4 暫停中看不到任何牌面（含已配對與已翻開），繼續後恢復', async () => {});
test.skip('AC-PS-5 頁面隱藏時自動暫停，回到前景 3 秒後仍暫停且時間不變；選單畫面的反例', async () => {});
test.skip('AC-PS-7 遊戲中回到選單：第 1 關仍無紀錄', async () => {});
test.skip('AC-PS-8 重新開始：計時中、翻錯鎖定中、暫停中、尚未開始計時皆開始同一關的新遊玩，不受舊鎖定與標示影響', async () => {});
test.skip('AC-PS-9 翻錯鎖定 0.5 秒時暫停 3 秒，繼續後 0.4 秒：兩張仍正面', async () => {});
test.skip('AC-PS-10 暫停中：提示按鈕在視窗內可見、未被遮蔽、呈停用樣式', async () => {});
