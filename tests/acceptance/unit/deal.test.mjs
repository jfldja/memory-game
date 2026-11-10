// 驗收測試（無瀏覽器層）：AC-GP-2 的統計部分。
// 骨架：PR-2 轉為實際測試（acceptance-test-plan.md 第 2 節 #2；spec.md 第 8 節）。
// AC-GP-2 的端對端部分（連續 20 次遊玩）在 tests/acceptance/e2e/gameplay.spec.mjs。
import { test } from 'node:test';
// 12.2 第 9c 點（v0.5.1）：只含骨架的檔案也自 tests/support/assertions.mjs 匯入 assert；轉實測時以它斷言。
import { assert } from '../../support/assertions.mjs';

test.skip('AC-GP-2 統計：以正式 deal 與密碼學亂數洗牌 60,000 次，72 格每格都在 10,000 ± 500 之內；固定排列的反例判定失敗', () => {});
