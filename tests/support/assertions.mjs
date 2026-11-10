// 無瀏覽器層驗收測試的斷言來源與斷言計數（spec.md 12.2 第 9c 點、12.2.1 第 6 項）。只用 Node.js 內建模組。
//
// 用法（tests/acceptance/unit/ 的每個測試檔，含只有骨架的檔案）：
//   import { test } from 'node:test';
//   import { assert } from '../../support/assertions.mjs';
//
// - `assert` 包裝 node:assert/strict：直接呼叫 `assert(x)` 與呼叫任何斷言方法（`assert.equal`、`assert.deepEqual`、
//   `assert.match`、`assert.throws`、`assert.rejects`、`assert.fail` …）各計為執行一次；丟出例外（或 `rejects`／
//   `doesNotReject` 回傳的 Promise 被拒絕）時另計為失敗一次，再把原例外丟出。類別與非函式屬性
//   （`AssertionError`、`CallTracker`）原樣傳回、不計數；`assert.strict` 傳回同一個包裝。
// - 巢狀斷言（例：`assert.throws(() => assert.equal(1, 2))` 中被 `throws` 預期而接住的內層失敗）只計外層一次：
//   內層的失敗是外層斷言預期的結果，不是被測試吞掉的失敗。限制：`rejects` 的非同步回呼在 await 之後執行的斷言
//   不在同步呼叫期間內，仍會被計數。
// - 本模組在最上層註冊 `beforeEach`（歸零）與 `afterEach`（以 `t.diagnostic('acceptance-assertions <執行> <失敗>')`
//   回報），由 scripts/acceptance-reporter.mjs 併入該測試的結果，供 check-acceptance-results 第 6 項判定。
//   略過的測試不執行 hook（spec.md 12.2.1 實測），所以只含骨架的檔案匯入本模組沒有副作用。
// - 限制：計數是每個測試行程一份的全域變數，以「同一時間只執行一個測試」為前提（node:test 預設同一檔案的
//   測試依序執行）。不要在驗收測試中使用 `{ concurrency }` 或子測試（`t.test`），否則計數會混在一起。
import { beforeEach, afterEach } from 'node:test';
import nodeAssert from 'node:assert/strict';

let run = 0;
let failed = 0;
let depth = 0;

function counted(fn, thisArg, args) {
  if (depth > 0) return Reflect.apply(fn, thisArg, args);
  run++;
  let result;
  depth++;
  try {
    result = Reflect.apply(fn, thisArg, args);
  } catch (err) {
    failed++;
    throw err;
  } finally {
    depth--;
  }
  if (result && typeof result.then === 'function') {
    return result.then(
      (v) => v,
      (err) => {
        failed++;
        throw err;
      },
    );
  }
  return result;
}

const wrappers = new Map();

/** 包裝 node:assert/strict 的斷言（見檔頭說明）。 */
export const assert = new Proxy(nodeAssert, {
  apply(target, thisArg, args) {
    return counted(target, thisArg, args);
  },
  get(target, key) {
    if (key === 'strict') return assert;
    const value = Reflect.get(target, key);
    // 類別（大寫開頭，例：AssertionError、CallTracker）與非函式屬性不是斷言
    if (typeof value !== 'function' || typeof key !== 'string' || /^[A-Z]/.test(key)) return value;
    if (!wrappers.has(key)) {
      wrappers.set(key, function countedAssertion(...args) {
        return counted(value, target, args);
      });
    }
    return wrappers.get(key);
  },
});

beforeEach(() => {
  run = 0;
  failed = 0;
  depth = 0;
});

afterEach((t) => {
  t.diagnostic(`acceptance-assertions ${run} ${failed}`);
});
