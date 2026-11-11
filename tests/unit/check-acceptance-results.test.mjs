// 模組單元測試：scripts/check-acceptance-results.mjs（module-test-standards.md M12、spec.md 12.2.1）。
// 結果紀錄的形狀取自本機實測（Node.js 22.23.4、Playwright 1.63.0）經兩個自訂 reporter 輸出的格式。
// 測試名稱與資料不含真實驗收編號（虛構編號 AC-ZZ-…）。
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  evaluateResults,
  parseResultFile,
  parseArgs,
  statusOf,
  runResultsCheck,
} from '../../scripts/check-acceptance-results.mjs';

const UF = 'tests/acceptance/unit/x.test.mjs';
const EF = 'tests/acceptance/e2e/x.spec.mjs';
const RF = 'tests/acceptance/e2e/timing-real.spec.mjs';

const st = (file, name, { kind = 'test', skeleton = false, literal = 'string', path: p = [] } = {}) =>
  ({ file, name, kind, skeleton, literal, path: p });

const node = (name, { file = UF, event = 'test:pass', skip = false, todo = false, kind = 'test', path: p = [], assertions = { run: 1, failed: 0 } } = {}) =>
  ({ type: 'result', runner: 'node', file, name, path: p, kind, event, skip, todo, assertions });

const pw = (name, { file = EF, expectedStatus = 'passed', outcome = 'expected', results = ['passed'], path: p = [], assertions = { run: 1, failed: 0 }, annotations = [] } = {}) =>
  ({ type: 'result', runner: 'playwright', project: 'chromium', file, name, path: p, expectedStatus, outcome, results, annotations, assertions });

const PW_SKIPPED = { expectedStatus: 'skipped', outcome: 'skipped', results: ['skipped'], assertions: { run: 0, failed: 0 } };

function judge({ layer = 'unit', staticTests, staticFiles, results, errors, noSkip, requiredIds }) {
  const files = staticFiles ?? [...new Set(staticTests.map((s) => s.file))];
  return evaluateResults({ layer, staticTests, staticFiles: files, results, errors, noSkip, requiredIds });
}
const items = (r) => r.failures.map((f) => f.item);

describe('evaluateResults：node:test 結果', () => {
  const statics = [st(UF, 'AC-ZZ-1 a'), st(UF, 'AC-ZZ-2 b', { skeleton: true })];

  test('通過（有斷言計數）與骨架略過：無 --no-skip 時通過；--no-skip 時骨架失敗（第 3 項）', () => {
    const results = [node('AC-ZZ-1 a'), node('AC-ZZ-2 b', { skip: true, assertions: null })];
    assert.equal(judge({ staticTests: statics, results }).ok, true);
    const r = judge({ staticTests: statics, results, noSkip: true, requiredIds: ['AC-ZZ-1', 'AC-ZZ-2'] });
    assert.deepEqual(items(r), [3, 5]);
  });

  test('test:fail：第 1 項', () => {
    const r = judge({ staticTests: statics, results: [node('AC-ZZ-1 a', { event: 'test:fail' }), node('AC-ZZ-2 b', { skip: true })] });
    assert.deepEqual(items(r), [1]);
  });

  test('非骨架的略過（本體內 t.skip()、{ skip }、別名）與 todo：第 2 項', () => {
    for (const rec of [node('AC-ZZ-1 a', { skip: true }), node('AC-ZZ-1 a', { todo: true })]) {
      const r = judge({ staticTests: statics, results: [rec, node('AC-ZZ-2 b', { skip: true })] });
      assert.deepEqual(items(r), [2], JSON.stringify(rec));
    }
  });

  test('骨架同名但位於 describe 內的略過結果不是骨架：第 2 項', () => {
    const r = judge({
      staticTests: [...statics, st(UF, 'D', { kind: 'describe' })],
      results: [node('AC-ZZ-1 a'), node('AC-ZZ-2 b', { skip: true, path: ['D'] }), node('D', { kind: 'suite' })],
    });
    assert.ok(items(r).includes(2));
  });

  test('略過的 describe 區塊（suite 略過）失敗，區塊內沒有結果的測試也失敗（第 2、4 項）', () => {
    const r = judge({
      staticTests: [st(UF, 'blk', { kind: 'describe' }), st(UF, 'AC-ZZ-3 hidden', { path: ['blk'] })],
      results: [node('blk', { kind: 'suite', skip: true, assertions: null })],
    });
    assert.deepEqual(items(r).sort(), [2, 4]);
  });

  test('斷言計數：缺少、0 次、有失敗被吞掉皆為第 6 項；suite 與略過不需要計數', () => {
    for (const assertions of [null, { run: 0, failed: 0 }, { run: 2, failed: 1 }]) {
      const r = judge({ staticTests: statics, results: [node('AC-ZZ-1 a', { assertions }), node('AC-ZZ-2 b', { skip: true, assertions: null })] });
      assert.deepEqual(items(r), [6], JSON.stringify(assertions));
    }
    const ok = judge({
      staticTests: [st(UF, 'D', { kind: 'describe' }), st(UF, 'in', { path: ['D'] })],
      results: [node('in', { path: ['D'] }), node('D', { kind: 'suite', assertions: null })],
    });
    assert.equal(ok.ok, true);
  });
});

describe('evaluateResults：Playwright 結果', () => {
  const statics = [st(EF, 'AC-ZZ-1 a'), st(EF, 'AC-ZZ-2 b', { skeleton: true })];
  const skel = pw('AC-ZZ-2 b', PW_SKIPPED);

  test('通過與骨架略過：通過', () => {
    assert.equal(judge({ layer: 'e2e', staticTests: statics, results: [pw('AC-ZZ-1 a'), skel] }).ok, true);
  });

  test('test.fail（expectedStatus: failed、outcome: expected）：第 1 項（不得只看統計）', () => {
    const r = judge({ layer: 'e2e', staticTests: statics, results: [pw('AC-ZZ-1 a', { expectedStatus: 'failed', outcome: 'expected', results: ['failed'] }), skel] });
    assert.deepEqual(items(r), [1]);
  });

  test('任何一次結果不是 passed（flaky、timedOut、interrupted）或沒有任何結果：第 1 項', () => {
    for (const extra of [
      { outcome: 'flaky', results: ['failed', 'passed'] },
      { outcome: 'unexpected', results: ['timedOut'] },
      { outcome: 'unexpected', results: ['interrupted'] },
      { outcome: 'expected', results: [] },
    ]) {
      const r = judge({ layer: 'e2e', staticTests: statics, results: [pw('AC-ZZ-1 a', extra), skel] });
      assert.deepEqual(items(r), [1], JSON.stringify(extra));
    }
  });

  test('本體內 test.skip()／條件略過／describe.skip 內的測試（expectedStatus: skipped）：第 2 項', () => {
    const r = judge({ layer: 'e2e', staticTests: statics, results: [pw('AC-ZZ-1 a', PW_SKIPPED), skel] });
    assert.deepEqual(items(r), [2]);
  });

  test('斷言步驟 0 次（空本體、第一個斷言前 return）：第 6 項', () => {
    const r = judge({ layer: 'e2e', staticTests: statics, results: [pw('AC-ZZ-1 a', { assertions: { run: 0, failed: 0 } }), skel] });
    assert.deepEqual(items(r), [6]);
  });

  test('try/catch 吞掉的失敗斷言（計數 1、帶 error 1、狀態 passed）：第 6 項', () => {
    const r = judge({ layer: 'e2e', staticTests: statics, results: [pw('AC-ZZ-1 a', { assertions: { run: 1, failed: 1 } }), skel] });
    assert.deepEqual(items(r), [6]);
  });

  test('expect.soft（1）、expect.poll（2）、test.step 內的斷言（1）計入：通過', () => {
    for (const run of [1, 2]) {
      assert.equal(judge({ layer: 'e2e', staticTests: statics, results: [pw('AC-ZZ-1 a', { assertions: { run, failed: 0 } }), skel] }).ok, true);
    }
  });

  test('一般與 realtime 兩個結果檔合併判定：realtime 專用檔只出現在其中一個', () => {
    const statics2 = [...statics, st(RF, 'NFR-99 10 秒', { skeleton: true })];
    const ok = judge({ layer: 'e2e', staticTests: statics2, results: [pw('AC-ZZ-1 a'), skel, pw('NFR-99 10 秒', { file: RF, ...PW_SKIPPED })] });
    assert.equal(ok.ok, true);
    const missingRealtime = judge({ layer: 'e2e', staticTests: statics2, results: [pw('AC-ZZ-1 a'), skel] });
    assert.deepEqual(items(missingRealtime).sort(), [4, 4]);
  });

  test('全域錯誤（例：測試檔載入失敗）：失敗', () => {
    const r = judge({ layer: 'e2e', staticTests: statics, results: [pw('AC-ZZ-1 a'), skel], errors: [{ type: 'error', message: 'TypeError: x' }] });
    assert.equal(r.ok, false);
    assert.deepEqual(items(r), ['錯誤']);
  });
});

describe('evaluateResults：第 4 項（沒有執行）', () => {
  test('靜態有、結果沒有的測試（例：名稱過濾、.only 讓其他測試沒有執行）：失敗', () => {
    const r = judge({ staticTests: [st(UF, 'a'), st(UF, 'b')], results: [node('a')] });
    assert.deepEqual(r.failures.map((f) => [f.item, f.name]), [[4, 'b']]);
  });

  test('整個測試檔沒有結果：失敗', () => {
    const r = judge({ staticTests: [st(UF, 'a')], staticFiles: [UF, 'tests/acceptance/unit/y.test.mjs'], results: [node('a')] });
    assert.deepEqual(r.failures.map((f) => [f.item, f.file]), [[4, 'tests/acceptance/unit/y.test.mjs']]);
  });

  test('樣板名稱以第一個 ${ 之前的固定文字為前綴比對；沒有 ${ 的樣板須完全相同', () => {
    const statics = [st(EF, 'NFR-99 ${w}x${h}', { literal: 'template' }), st(EF, 'AC-ZZ-7 固定', { literal: 'template' })];
    const ok = judge({ layer: 'e2e', staticTests: statics, results: [pw('NFR-99 360x640'), pw('NFR-99 1280x720'), pw('AC-ZZ-7 固定')] });
    assert.equal(ok.ok, true);
    const bad = judge({ layer: 'e2e', staticTests: statics, results: [pw('NFR-9 360x640'), pw('AC-ZZ-7 固定 2')] });
    assert.deepEqual(items(bad), [4, 4]);
  });

  test('v0.6.1：樣板的固定前綴去除空白後為空時，即使同檔有其他結果也判定「沒有執行」', () => {
    for (const name of ['${a} AC-ZZ-5', '  ${a}', '\t${a}${b}']) {
      const statics = [st(UF, name, { literal: 'template' }), st(UF, 'AC-ZZ-6 其他')];
      const r = judge({ staticTests: statics, results: [node('AC-ZZ-5 x'), node('AC-ZZ-6 其他'), node('  x')] });
      assert.deepEqual(r.failures.map((f) => [f.item, f.name]), [[4, name]], JSON.stringify(name));
      assert.match(r.failures[0].message, /沒有執行結果/);
    }
  });

  test('v0.6.1：前綴為空的樣板 describe 也不以前綴比對外層路徑或套件結果', () => {
    const statics = [st(EF, '${g}', { kind: 'describe', literal: 'template' }), st(EF, 'in', { path: ['${g}'] })];
    const r = judge({ layer: 'e2e', staticTests: statics, results: [pw('in', { path: ['組 1'] })] });
    assert.deepEqual(r.failures.map((f) => [f.item, f.name]), [[4, '${g}']]);
    // 對照：前綴非空的樣板 describe 以前綴比對外層路徑
    const okStatics = [st(EF, '組 ${g}', { kind: 'describe', literal: 'template' }), st(EF, 'in', { path: ['組 ${g}'] })];
    assert.equal(judge({ layer: 'e2e', staticTests: okStatics, results: [pw('in', { path: ['組 1'] })] }).ok, true);
  });

  test('describe 名稱以外層路徑比對', () => {
    const statics = [st(EF, '區', { kind: 'describe' }), st(EF, 'in', { path: ['區'] }), st(EF, '空區', { kind: 'describe' })];
    const r = judge({ layer: 'e2e', staticTests: statics, results: [pw('in', { path: ['區'] })] });
    assert.deepEqual(r.failures.map((f) => [f.item, f.name]), [[4, '空區']]);
  });

  test('結果檔為空（沒有任何結果）：每個檔案與測試都失敗', () => {
    const r = judge({ staticTests: [st(UF, 'a')], results: [] });
    assert.deepEqual(items(r), [4, 4]);
  });
});

describe('evaluateResults：第 5 項（--no-skip 時每個必要編號都有通過的結果）', () => {
  test('編號只有失敗或略過的結果：失敗；外層路徑含編號時算', () => {
    const statics = [st(EF, 'AC-ZZ-1 a'), st(EF, 'NFR-98 區', { kind: 'describe' }), st(EF, 'x', { path: ['NFR-98 區'] })];
    const ok = judge({ layer: 'e2e', staticTests: statics, noSkip: true, requiredIds: ['AC-ZZ-1', 'NFR-98', 'AC-ZZ-9'], results: [pw('AC-ZZ-1 a'), pw('x', { path: ['NFR-98 區'] })] });
    assert.equal(ok.ok, true, JSON.stringify(ok.failures));
    const bad = judge({ layer: 'e2e', staticTests: statics, noSkip: true, requiredIds: ['AC-ZZ-1', 'NFR-98'], results: [pw('AC-ZZ-1 a', { results: ['failed'], outcome: 'unexpected' }), pw('x', { path: ['NFR-98 區'] })] });
    assert.deepEqual(items(bad), [1, 5]);
  });

  test('AC-ZZ-1 不被 AC-ZZ-10 的結果滿足', () => {
    const r = judge({ layer: 'e2e', staticTests: [st(EF, 'AC-ZZ-1 AC-ZZ-10 a')], noSkip: true, requiredIds: ['AC-ZZ-1'], results: [pw('AC-ZZ-10 a')] });
    assert.ok(items(r).includes(5));
  });
});

describe('statusOf', () => {
  test('Playwright：skipped 但結果含非 skipped 時視為失敗；未知 runner 視為失敗', () => {
    assert.equal(statusOf(pw('a', { expectedStatus: 'skipped', results: ['passed'] })), 'failed');
    assert.equal(statusOf({ runner: 'other' }), 'failed');
    assert.equal(statusOf(node('a', { todo: true, event: 'test:fail' })), 'skipped');
  });
});

describe('parseResultFile 與 parseArgs', () => {
  const end = (count) => JSON.stringify({ type: 'end', count });
  test('最後一行必須是結束行且筆數相符；空檔、非 JSON、無法辨識的行都丟出錯誤', () => {
    const rec = JSON.stringify(node('a'));
    assert.equal(parseResultFile(`${rec}\n${end(1)}\n`).records.length, 1);
    assert.throws(() => parseResultFile(''), /空的/);
    assert.throws(() => parseResultFile(`${rec}\n`), /沒有結束行/);
    assert.throws(() => parseResultFile(`${rec}\n${end(2)}`), /筆數不符/);
    assert.throws(() => parseResultFile(`{x\n${end(0)}`), /不是 JSON/);
    assert.throws(() => parseResultFile(`{"type":"other"}\n${end(0)}`), /無法辨識/);
  });

  test('參數：需要 --layer unit|e2e 與至少一個結果檔；不認得的參數失敗', () => {
    assert.deepEqual(parseArgs(['--layer', 'e2e', 'a', 'b', '--no-skip']), { layer: 'e2e', noSkip: true, files: ['a', 'b'] });
    assert.throws(() => parseArgs(['a']), /--layer/);
    assert.throws(() => parseArgs(['--layer', 'x', 'a']), /--layer/);
    assert.throws(() => parseArgs(['--layer', 'unit']), /至少一個/);
    assert.throws(() => parseArgs(['--layer', 'unit', '--grep', 'x', 'a']), /不認得/);
  });
});

describe('runResultsCheck：對暫存版本庫執行', () => {
  const REQ = [
    '### 10.2 功能驗收', '**AC-ZZ-1**（自動）', '**AC-ZZ-2**（自動）',
    '## 13. 需求追溯矩陣', '| 需求 | 優先 | 驗收 | 驗證 |', '|---|---|---|---|',
  ].join('\n');
  function repo(files) {
    const root = mkdtempSync(path.join(tmpdir(), 'results-'));
    for (const [rel, content] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      writeFileSync(path.join(root, rel), content);
    }
    return root;
  }

  test('以同一份原始碼的靜態掃描判定；結果檔的絕對路徑正規化為版本庫相對路徑；只取該層目錄', () => {
    const root = repo({
      'docs/requirements.md': REQ,
      'docs/design/supplementary-acceptance.json': '{"items":[]}',
      [UF]: "import { assert } from '../../support/assertions.mjs';\ntest('AC-ZZ-1 a', () => { assert.ok(1); });\ntest.skip('AC-ZZ-2 b', () => {});\n",
      [EF]: "test('其他層', async () => { expect(1).toBe(1); });\n",
    });
    try {
      const lines = [
        { ...node('AC-ZZ-1 a'), file: path.join(root, UF) },
        { ...node('AC-ZZ-2 b', { skip: true, assertions: null }), file: path.join(root, UF) },
      ];
      writeFileSync(path.join(root, 'r.jsonl'), [...lines.map((l) => JSON.stringify(l)), JSON.stringify({ type: 'end', count: 2 })].join('\n'));
      const r = runResultsCheck({ root, argv: ['--layer', 'unit', 'r.jsonl'], cwd: root });
      assert.equal(r.ok, true, JSON.stringify(r.failures));
      assert.deepEqual(r.staticFiles, [UF]);
      const strict = runResultsCheck({ root, argv: ['--layer', 'unit', '--no-skip', 'r.jsonl'], cwd: root });
      assert.deepEqual(items(strict), [3, 5]);
      assert.throws(() => runResultsCheck({ root, argv: ['--layer', 'unit', 'none.jsonl'], cwd: root }), /不存在/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
