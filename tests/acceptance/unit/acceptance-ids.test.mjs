// 驗收測試（無瀏覽器層）：AC-EQ-4（EQ-4）。PR-1 轉為實際測試。
// 依據：需求文件 v1.1 AC-EQ-4；acceptance-test-plan.md v0.4 第 2 節 #50、第 3 節；spec.md v0.4 第 12.2 節。
//
// 本檔以呼叫 scripts/check-acceptance-ids.mjs 匯出的檢查函式驗證，並另以子行程執行同一支 CLI
// （CI 的 acceptance-ids job 就是執行它），確認結束代碼。
//
// 期望值（EXPECTED_*）是從 acceptance-test-plan.md 抄寫的獨立清單，不由檢查腳本產生：
// 需求文件或腳本的解析一旦改變，這裡會失敗，必須回到設計確認，不得直接改成新的結果。
//
// 注意：
// - 測試資料中的原始碼以字串保存，檢查腳本不把字串內的 test('…') 採計為測試名稱。
// - 本檔的測試名稱除了 AC-EQ-4 以外，不得含任何其他必要編號（含 NFR 編號）：
//   檢查腳本會把名稱中的編號採計為覆蓋，反例會因此被本檔自己的名稱掩蓋。
//   最後一個測試檢查這一點。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseRequiredIds,
  parseSupplementaryIds,
  extractTests,
  checkCoverage,
  runCheck,
} from '../../../scripts/check-acceptance-ids.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const REQUIREMENTS = path.join(ROOT, 'docs/requirements.md');
const SUPPLEMENTARY = path.join(ROOT, 'docs/design/supplementary-acceptance.json');
const CHECK_SCRIPT = path.join(ROOT, 'scripts/check-acceptance-ids.mjs');

/** acceptance-test-plan.md 第 2 節：第 10.2 節含「自動」的驗收 51 個。 */
const EXPECTED_AC = [
  'AC-GP-1', 'AC-GP-2', 'AC-GP-3', 'AC-GP-4', 'AC-GP-5', 'AC-GP-6', 'AC-GP-7', 'AC-GP-8',
  'AC-TM-1', 'AC-TM-2', 'AC-TM-3', 'AC-TM-4', 'AC-TM-5',
  'AC-LV-1', 'AC-LV-2', 'AC-LV-3', 'AC-LV-4', 'AC-LV-5', 'AC-LV-6', 'AC-LV-7', 'AC-LV-8', 'AC-LV-9',
  'AC-HT-1', 'AC-HT-2', 'AC-HT-3', 'AC-HT-4', 'AC-HT-5', 'AC-HT-7', 'AC-HT-8', 'AC-HT-9', 'AC-HT-10',
  'AC-PS-1', 'AC-PS-2', 'AC-PS-3', 'AC-PS-4', 'AC-PS-7', 'AC-PS-9', 'AC-PS-10',
  'AC-RS-1', 'AC-RS-2', 'AC-RS-3',
  'AC-RC-1', 'AC-RC-2', 'AC-RC-3', 'AC-RC-4', 'AC-RC-5', 'AC-RC-6', 'AC-RC-7', 'AC-RC-8',
  'AC-EQ-4', 'AC-EQ-9',
];
/** acceptance-test-plan.md 第 2 節：自動量測的 Must NFR 4 個（NFR-1 為 EQ-4 例外）。 */
const EXPECTED_NFR = ['NFR-3', 'NFR-5', 'NFR-6', 'NFR-7'];
/** acceptance-test-plan.md 第 3 節：DQ-10 決定全部啟用的設計補充驗收 6 個。 */
const EXPECTED_SUPPLEMENTARY = ['AC-PS-5', 'AC-PS-8', 'AC-RS-4', 'AC-RS-5', 'AC-RC-9', 'NFR-4'];

const sorted = (a) => [...a].sort();

// ───────────────────────── 測試資料工具 ─────────────────────────

/**
 * 從原始碼刪除名稱字串以 `id` 開頭的每一個 test(...) 呼叫（含其後的分號）。
 * 刻意不使用檢查腳本的 tokenizer，以免「刪除」與「判定」共用同一段程式而互相掩蓋錯誤。
 * 掃描時跳過字串、樣板字面值與註解；名稱需為呼叫的第一個參數。
 * @returns {{ src: string, removed: string[] }}
 */
function removeTestsNamed(src, id) {
  const head = new RegExp(String.raw`\btest(?:\.[A-Za-z]+)*\(\s*(['"\x60])${id}(?![0-9])`, 'g');
  const removed = [];
  let out = src;
  for (;;) {
    head.lastIndex = 0;
    const m = head.exec(out);
    if (!m) break;
    const start = m.index;
    let i = out.indexOf('(', start);
    let depth = 0;
    let end = -1;
    while (i < out.length) {
      const c = out[i];
      if (c === '"' || c === "'" || c === '`') {
        const q = c;
        i++;
        while (i < out.length && out[i] !== q) i += out[i] === '\\' ? 2 : 1;
      } else if (c === '/' && out[i + 1] === '/') {
        while (i < out.length && out[i] !== '\n') i++;
      } else if (c === '/' && out[i + 1] === '*') {
        i = out.indexOf('*/', i + 2) + 1;
      } else if (c === '(') {
        depth++;
      } else if (c === ')') {
        depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
      i++;
    }
    assert.ok(end > start, `找不到 ${id} 測試呼叫的結尾`);
    if (out[end] === ';') end++;
    removed.push(out.slice(start, end));
    out = out.slice(0, start) + out.slice(end);
  }
  return { src: out, removed };
}

/** 建立暫存版本庫：需求文件、補充驗收檔、檢查腳本與目前 tests/ 的完整複本。 */
function makeTempRepo() {
  const dir = mkdtempSync(path.join(tmpdir(), 'ac-eq-4-'));
  mkdirSync(path.join(dir, 'docs/design'), { recursive: true });
  mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  cpSync(REQUIREMENTS, path.join(dir, 'docs/requirements.md'));
  cpSync(SUPPLEMENTARY, path.join(dir, 'docs/design/supplementary-acceptance.json'));
  cpSync(CHECK_SCRIPT, path.join(dir, 'scripts/check-acceptance-ids.mjs'));
  cpSync(path.join(ROOT, 'tests'), path.join(dir, 'tests'), { recursive: true });
  return dir;
}

/** 以子行程執行（暫存版本庫中的）檢查 CLI，等同 CI 的 acceptance-ids job。 */
function runCli(repoDir, args = []) {
  const r = spawnSync(process.execPath, [path.join(repoDir, 'scripts/check-acceptance-ids.mjs'), ...args], {
    encoding: 'utf8',
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

// ───────────────────────── 驗收 ─────────────────────────

test('AC-EQ-4 從需求文件解析出的必要編號等於驗收測試骨架計畫的 55 個（51 個驗收＋4 個自動量測的 Must 非功能需求，不含 EQ-4 的例外）', () => {
  const { acceptanceIds, nfrIds } = parseRequiredIds(readFileSync(REQUIREMENTS, 'utf8'));
  assert.deepEqual(sorted(acceptanceIds), sorted(EXPECTED_AC));
  assert.deepEqual(sorted(nfrIds), sorted(EXPECTED_NFR));
  assert.ok(!nfrIds.includes('NFR-1'), 'NFR-1 是 EQ-4 的例外，不應列為必要編號');
  // 需求明文點名的「自動＋人工」驗收
  for (const id of ['AC-LV-2', 'AC-LV-3', 'AC-LV-4']) assert.ok(acceptanceIds.includes(id), id);
  assert.equal(acceptanceIds.length + nfrIds.length, 55);
});

test('AC-EQ-4 設計補充驗收中啟用的編號等於計畫第 3 節的 6 個', () => {
  const ids = parseSupplementaryIds(readFileSync(SUPPLEMENTARY, 'utf8'));
  assert.deepEqual(sorted(ids), sorted(EXPECTED_SUPPLEMENTARY));
});

test('AC-EQ-4 版本庫中 61 個必要編號都出現在至少一個測試名稱中，檢查通過', () => {
  const r = runCheck({ root: ROOT });
  assert.equal(r.requiredIds.length, 61);
  assert.deepEqual(sorted(r.requiredIds), sorted([...EXPECTED_AC, ...EXPECTED_NFR, ...EXPECTED_SUPPLEMENTARY]));
  assert.deepEqual(r.missing, []);
  assert.equal(r.ok, true);
});

test('AC-EQ-4 反例：刪除需求指定之編號（翻錯翻回的驗收）的測試後，檢查函式與 CI 執行的檢查指令都失敗，且只回報該編號', (t) => {
  const repo = makeTempRepo();
  t.after(() => rmSync(repo, { recursive: true, force: true }));

  // 對照組：未刪除前，複本的檢查通過（排除「本來就失敗」造成的假陽性）
  assert.equal(runCheck({ root: repo }).ok, true, '刪除前的複本應通過');
  assert.equal(runCli(repo).status, 0, '刪除前的複本 CLI 應以 0 結束');

  // 從複本中所有測試檔刪除名稱含 AC-GP-5 的測試
  const before = runCheck({ root: repo });
  const files = [...new Set(before.tests.filter((x) => /AC-GP-5(?![0-9])/.test(x.name)).map((x) => x.file))];
  assert.ok(files.length > 0, '版本庫中應至少有一個名稱含 AC-GP-5 的測試');
  let removedCount = 0;
  for (const rel of files) {
    const file = path.join(repo, rel);
    const { src, removed } = removeTestsNamed(readFileSync(file, 'utf8'), 'AC-GP-5');
    removedCount += removed.length;
    writeFileSync(file, src);
    // 刪除後的檔案仍是合法的 JavaScript（真的「刪除一個測試」，不是把檔案弄壞）
    execFileSync(process.execPath, ['--check', file]);
  }
  assert.ok(removedCount > 0, '應實際刪除至少一個測試');

  const after = runCheck({ root: repo });
  assert.equal(after.ok, false);
  assert.deepEqual(after.missing, ['AC-GP-5']);
  // 只刪除了目標測試，其他測試未被誤刪
  assert.equal(after.tests.length, before.tests.length - removedCount);

  const cli = runCli(repo);
  assert.equal(cli.status, 1, `CLI 應以 1 結束；stdout=${cli.stdout} stderr=${cli.stderr}`);
  assert.match(cli.stderr, /AC-GP-5(?![0-9])/);
});

test('AC-EQ-4 編號以完整編號比對（第 10 號的測試不涵蓋第 1 號）；只出現在註解中的編號不算', () => {
  const src = [
    "test('AC-HT-10 提示按鈕在尚未開始時停用', () => {});",
    "// test('AC-GP-5 只在註解中', () => {});",
    '/* AC-GP-6 也只在註解中 */',
    "test('一般測試', () => {}); // AC-GP-7",
  ].join('\n');
  const r = checkCoverage({
    requiredIds: ['AC-HT-1', 'AC-HT-10', 'AC-GP-5', 'AC-GP-6', 'AC-GP-7'],
    tests: extractTests(src),
  });
  assert.equal(r.ok, false);
  assert.deepEqual(r.missing, ['AC-HT-1', 'AC-GP-5', 'AC-GP-6', 'AC-GP-7']);
});

test('AC-EQ-4 略過判定涵蓋 spec.md 12.2 第 5 點的全部寫法：略過的測試可通過編號檢查，但 --no-skip 時失敗', () => {
  // 每一種寫法各帶一個編號；「控制組」不略過。
  const cases = {
    'AC-GP-1': "test.skip('AC-GP-1 a', () => {});",
    'AC-GP-2': "test.fixme('AC-GP-2 a', async () => {});",
    'AC-GP-3': "test.todo('AC-GP-3 a');",
    'AC-GP-4': "test.describe.skip('區塊', () => { test('AC-GP-4 a', async () => {}); });",
    'AC-GP-5': "test.describe.fixme('區塊', () => { test('AC-GP-5 a', async () => {}); });",
    'AC-GP-6': "describe.skip('區塊', () => { it('AC-GP-6 a', () => {}); });",
    'AC-GP-7': "it.skip('AC-GP-7 a', () => {});",
    'AC-GP-8': "it.todo('AC-GP-8 a');",
    'AC-TM-1': "test('AC-TM-1 a', { skip: '尚未實作' }, () => {});",
    'AC-TM-2': "test('AC-TM-2 a', { todo: true }, () => {});",
    'AC-TM-3': "describe('區塊', { skip: true }, () => { it('AC-TM-3 a', () => {}); });",
  };
  const control = "test('AC-TM-4 控制組', () => {});";

  for (const [id, line] of Object.entries(cases)) {
    const tests = extractTests(line);
    const target = tests.find((x) => x.name.startsWith(id));
    assert.ok(target, `${id}：應收集到測試名稱（${line}）`);
    assert.equal(target.skipped, true, `${id}：應判定為略過（${line}）`);
    const requiredIds = [id];
    assert.equal(checkCoverage({ requiredIds, tests }).ok, true, `${id}：略過的測試仍可通過編號檢查`);
    assert.equal(checkCoverage({ requiredIds, tests, noSkip: true }).ok, false, `${id}：--no-skip 時應失敗`);
  }

  const controlTests = extractTests(control);
  assert.equal(controlTests[0].skipped, false);
  assert.equal(checkCoverage({ requiredIds: ['AC-TM-4'], tests: controlTests, noSkip: true }).ok, true);
});

test('AC-EQ-4 本檔的測試名稱除了本身編號外不含其他必要編號（避免以自身名稱掩蓋反例）', () => {
  const required = [...EXPECTED_AC, ...EXPECTED_NFR, ...EXPECTED_SUPPLEMENTARY].filter((id) => id !== 'AC-EQ-4');
  const own = extractTests(readFileSync(fileURLToPath(import.meta.url), 'utf8'));
  assert.ok(own.length >= 7);
  for (const t of own) {
    const leaked = required.filter((id) => new RegExp(`(?<![A-Za-z0-9-])${id}(?![0-9A-Za-z])`).test(t.name));
    assert.deepEqual(leaked, [], `測試名稱含其他必要編號：${t.name}`);
  }
});
