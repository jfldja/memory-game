// 驗收測試（無瀏覽器層）：AC-LV-5。
// 骨架：PR-2 轉為實際測試（acceptance-test-plan.md 第 2 節 #18；讀 core/config.js 的 LEVELS）。
import { test } from 'node:test';
// 12.2 第 9c 點（v0.5.1）：只含骨架的檔案也自 tests/support/assertions.mjs 匯入 assert；轉實測時以它斷言。
import { assert } from '../../support/assertions.mjs';

test.skip('AC-LV-5 三關時間上限：第 1 關 90 秒、第 2 關 75 秒、第 3 關 60 秒', () => {});
