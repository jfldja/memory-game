// 驗收測試（端對端層）：AC-GP-1～AC-GP-8（AC-GP-2 的端對端部分）。
// 骨架：PR-4 轉為實際測試（acceptance-test-plan.md 第 2 節 #1～#8）。
// 轉實測時：控制時鐘依計畫第 4 節第 1 點；找同一對、讀排列一律透過 tests/support/ 的配置輔助（PR-4 加入）。
import { test } from '@playwright/test';

test.skip('AC-GP-1 進入關卡後 12 張牌全部背面朝上且不帶牌面；依重算結果翻開 6 對全部配對（6 種各 2 張）', async () => {});
test.skip('AC-GP-2 連續 20 次遊玩：每次排列符合 6 種各 2 張且與前一次不同；重算結果與翻開後的牌面一致', async () => {});
test.skip('AC-GP-3 點擊一張背面的牌：該牌正面朝上，其餘 11 張維持背面', async () => {});
test.skip('AC-GP-4 翻開同一對的第二張：兩張正面朝上並成為已配對', async () => {});
test.skip('AC-GP-5 翻錯 1 秒後翻回：0.9 秒時兩張仍正面、1.1 秒時兩張已背面', async () => {});
test.skip('AC-GP-6 翻錯鎖定中 0.5 秒時點擊第三張：維持背面、步數不變', async () => {});
test.skip('AC-GP-7 再次點擊已翻開的同一張：維持正面、步數不變、下一張仍視為第二張', async () => {});
test.skip('AC-GP-8 配對最後一對：顯示勝利畫面', async () => {});
