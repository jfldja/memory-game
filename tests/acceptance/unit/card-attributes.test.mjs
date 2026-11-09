// 驗收測試（無瀏覽器層）：AC-LV-2、AC-LV-3、AC-LV-4 的自動部分（人工部分為 UAT U-3）。
// 骨架：PR-3 轉為實際測試（acceptance-test-plan.md 第 2 節 #15～#17）。
// 依據：docs/design/card-attributes.json；另檢查 src/js/ui/faces.js 與 config.js 的識別碼集合與屬性表一致。
import { test } from 'node:test';

test.skip('AC-LV-2 第 1 關：屬性表中任兩種牌面的形狀不同且顏色不同', () => {});
test.skip('AC-LV-3 第 2 關：屬性表中 6 種牌面顏色全部相同、形狀兩兩不同', () => {});
test.skip('AC-LV-4 第 3 關：屬性表中 6 種牌面形狀與顏色全部相同、細節兩兩不同', () => {});
