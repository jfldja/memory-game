// 驗收測試（端對端層）：AC-RC-1～AC-RC-8；設計補充驗收 AC-RC-9（Should，DQ-10 啟用）。
// 骨架：AC-RC-1～8 於 PR-5；AC-RC-9 於 PR-6 轉為實際測試（acceptance-test-plan.md 第 2 節 #42～#49、第 3 節）。
// 轉實測時：預寫紀錄依 spec.md 9.1 格式以 addInitScript 寫入；AC-RC-8、AC-RC-9 監聽 pageerror。
import { test } from '@playwright/test';

test.skip('AC-RC-1 以 25.0 秒、22 步勝利：最佳時間更新為 25.0（提示 2），最少步數維持 18（提示 1）', async () => {});
test.skip('AC-RC-2 第 1 關無紀錄時以時間到失敗：仍無紀錄', async () => {});
test.skip('AC-RC-3 以與最佳時間相同的顯示值勝利：維持原紀錄與其提示次數', async () => {});
test.skip('AC-RC-4 以 2 次提示取得最佳時間：選單最佳時間旁顯示提示 2 次', async () => {});
test.skip('AC-RC-5 只有第 1 關有紀錄：第 1 關顯示兩項數值，第 2、3 關四個項目為「—」', async () => {});
test.skip('AC-RC-6 關閉分頁後在同一瀏覽器重新開啟：選單顯示相同紀錄', async () => {});
test.skip('AC-RC-7 清除紀錄並在確認時取消：紀錄不變', async () => {});
test.skip('AC-RC-8 保存的紀錄無法解析：選單正常顯示、全部為「—」、主控台沒有未處理錯誤', async () => {});
test.skip('AC-RC-9 儲存不可用：顯示「紀錄無法保存」、可遊玩、勝利後選單顯示記憶體紀錄、重新整理後為「—」；儲存可用時不顯示提示', async () => {});
