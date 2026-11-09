// 驗收測試（端對端層）：AC-HT-1～AC-HT-5、AC-HT-7～AC-HT-10（需求沒有 AC-HT-6）。
// 骨架：PR-4 轉為實際測試（acceptance-test-plan.md 第 2 節 #23～#31）。
// 轉實測時：停用以 aria-disabled 判斷，點擊「無效果」以座標點擊驗證（計畫第 4 節第 2 點）。
import { test } from '@playwright/test';

test.skip('AC-HT-1 用完 3 次提示後回到選單再進入同一關：剩餘提示 3', async () => {});
test.skip('AC-HT-2 已配對 2 對時使用提示：恰好 2 張同牌面、未配對的牌被標示，1.9 秒仍標示、2.1 秒已結束', async () => {});
test.skip('AC-HT-3 剩餘 3 次時使用提示一次：剩餘 2 次', async () => {});
test.skip('AC-HT-4 剩餘 1 次時使用提示：剩餘 0、按鈕停用，點擊後沒有牌被標示', async () => {});
test.skip('AC-HT-5 剩餘 2 次時：畫面顯示剩餘提示 2', async () => {});
test.skip('AC-HT-7 已翻開一張或翻錯鎖定中：提示按鈕停用，點擊後次數不變、沒有牌被標示', async () => {});
test.skip('AC-HT-8 標示中再點擊提示：剩餘仍為 2、標示不變；標示結束後按鈕可以使用', async () => {});
test.skip('AC-HT-9 翻錯並結束鎖定後使用提示：12 張仍背面、步數不變', async () => {});
test.skip('AC-HT-10 剛進入關卡尚未翻牌：提示按鈕可見且停用，點擊無效果', async () => {});
