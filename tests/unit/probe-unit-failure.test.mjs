// 探測 PR A 專用（spec.md 12.6 步驟 8、DQ-12 (b)）：刻意讓 unit 失敗，驗證 CI 失敗時管理員合併被拒。
// 本檔會在下一個 commit 刪除；探測 PR 不合併。
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('探測：刻意失敗以驗證必要檢查擋下合併', () => {
  assert.fail('刻意失敗（DQ-12 (b)）');
});
