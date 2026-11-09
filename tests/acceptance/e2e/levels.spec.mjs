// 驗收測試（端對端層）：AC-LV-1、AC-LV-6～AC-LV-9。
// 骨架：PR-4 轉為實際測試（acceptance-test-plan.md 第 2 節 #14、#19～#22）。
// AC-LV-2～AC-LV-5 為無瀏覽器層，見 tests/acceptance/unit/。
import { test } from '@playwright/test';

test.skip('AC-LV-1 選單恰好有「簡單」「普通」「困難」三個難度，分別進入第 1、2、3 關', async () => {});
test.skip('AC-LV-6 時間上限：89.96 秒仍進行、90.00 秒失敗；第 3 關 60.0 失敗；鎖定中到時失敗；89.9 配對最後一對為勝利', async () => {});
test.skip('AC-LV-7 沒有任何紀錄時可直接選擇「困難」並開始遊玩', async () => {});
test.skip('AC-LV-8 進入第 3 關：顯示「困難」與 60 秒時間上限', async () => {});
test.skip('AC-LV-9 選單、三關遊戲、勝利、失敗畫面都出現對應的難度名稱', async () => {});
