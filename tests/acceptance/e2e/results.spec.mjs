// 驗收測試（端對端層）：AC-RS-1～AC-RS-3；設計補充驗收 AC-RS-4、AC-RS-5（Should，DQ-10 啟用）。
// 骨架：AC-RS-1～3 於 PR-4；AC-RS-4、AC-RS-5 於 PR-6 轉為實際測試
// （acceptance-test-plan.md 第 2 節 #39～#41、第 3 節；spec.md 第 15 節）。
import { test } from '@playwright/test';

test.skip('AC-RS-1 以 42.3 秒、14 步、提示 1 次勝利：勝利畫面顯示 42.3、14、1', async () => {});
test.skip('AC-RS-2 勝利畫面點擊「重玩本關」：同一關新遊玩，已用時間 0.0、步數 0、剩餘提示 3', async () => {});
test.skip('AC-RS-3 勝利或失敗畫面點擊「回到選單」：顯示選單', async () => {});
test.skip('AC-RS-4 勝利時優於既有紀錄或尚無紀錄的項目標示「新紀錄」；相等、較差、他關無紀錄、第二次勝利不標示', async () => {});
test.skip('AC-RS-5 勝利畫面「挑戰下一個難度」：簡單→普通、普通→困難，困難沒有此按鈕', async () => {});
