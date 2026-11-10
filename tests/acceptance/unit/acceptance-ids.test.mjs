// 驗收測試（無瀏覽器層）：AC-EQ-4（EQ-4）。PR-1 轉為實際測試；PR-1b 依設計 v0.5／v0.5.1 補強。
// 依據：需求文件 v1.1 AC-EQ-4；acceptance-test-plan.md v0.5.1 第 1 節、第 2 節 #50、第 3 節、第 4 節第 9 點；
//       spec.md v0.5.1 第 12.2 節（第 3～5、7～12 點）、12.2.1（結果檔的交接、第 2、3、6 項）。
//
// 本檔以呼叫 scripts/check-acceptance-ids.mjs 匯出的檢查函式驗證，並另以子行程執行同一支 CLI
// （CI 的 acceptance-ids job 就是執行它），確認結束代碼。最後一組反例以 CI 的 unit job 實際執行的指令
// （node --test＋scripts/acceptance-reporter.mjs → scripts/check-acceptance-results.mjs）在暫存版本庫執行。
//
// 期望值（EXPECTED_*）是從 acceptance-test-plan.md 抄寫的獨立清單，不由檢查腳本產生：
// 需求文件或腳本的解析一旦改變，這裡會失敗，必須回到設計確認，不得直接改成新的結果。
//
// PR-1b 的修改（設計變更造成的驗收測試修改，spec.md 12.2 v0.5 第 8 點）：
// v0.4 的「各種略過寫法都可通過編號檢查」已不成立——v0.5 起驗收測試唯一允許的略過寫法是最上層的骨架宣告，
// 其餘寫法即使沒有 --no-skip 也失敗。該案例改寫為：骨架宣告可通過、--no-skip 時失敗；其他每一種寫法都失敗。
//
// 注意：
// - 反例都在暫存版本庫（需求文件、補充驗收檔、檢查腳本與 tests/ 的完整複本）上做，並先確認複本本身通過（對照組）。
// - 測試資料中的原始碼以字串保存，檢查腳本不把字串內的 test('…') 採計為測試名稱，也不把其中的 .skip 當成寫法。
// - 本檔的測試名稱除了 AC-EQ-4 以外，不得含任何其他必要編號（含 NFR 編號）：
//   檢查腳本會把名稱中的編號採計為覆蓋，反例會因此被本檔自己的名稱掩蓋。最後一個測試檢查這一點。
import { test } from 'node:test';
import { assert } from '../../support/assertions.mjs';
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
/** 反例的目標：需求文件 AC-EQ-4 反例指定的編號。 */
const TARGET = 'AC-GP-5';

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

/** 對照組：複本在加入反例之前，檢查函式與 CLI 都通過（排除「本來就失敗」造成的假陽性）。 */
function assertBaselinePasses(repo) {
  const base = runCheck({ root: repo });
  assert.deepEqual(base.violations, [], '加入反例前的複本不應有違規');
  assert.equal(base.ok, true, '加入反例前的複本應通過');
  assert.equal(runCli(repo).status, 0, '加入反例前的複本 CLI 應以 0 結束');
}

/** 從複本所有驗收測試檔刪除名稱以 id 開頭的測試；回傳被刪除的原始碼。刪除後的檔案須仍是合法的 JavaScript。 */
function removeFromAcceptance(repo, id) {
  const r = runCheck({ root: repo });
  const files = [...new Set(r.tests.filter((x) => new RegExp(`${id}(?![0-9])`).test(x.name)).map((x) => x.file))];
  assert.ok(files.length > 0, `複本中應至少有一個名稱含 ${id} 的驗收測試`);
  const removed = [];
  for (const rel of files) {
    const file = path.join(repo, rel);
    const out = removeTestsNamed(readFileSync(file, 'utf8'), id);
    removed.push(...out.removed.map((src) => ({ rel, src })));
    writeFileSync(file, out.src);
    execFileSync(process.execPath, ['--check', file]);
  }
  assert.ok(removed.length > 0, '應實際刪除至少一個測試');
  return removed;
}

/** 在複本中寫入一個檔案，執行檢查函式與 CLI 後刪除該檔案。 */
function checkWithFile(repo, rel, src) {
  const file = path.join(repo, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, src);
  try {
    const r = runCheck({ root: repo });
    const cli = runCli(repo);
    return { r, cli, inFile: r.violations.filter((v) => v.file === rel) };
  } finally {
    rmSync(file, { force: true });
  }
}

/** 測試資料中以 `// ←` 標示的行號（1 起算）。 */
function markedLine(src) {
  const k = src.split('\n').findIndex((l) => l.includes('// ←'));
  assert.ok(k >= 0, `測試資料缺少 // ← 標記：${src}`);
  return k + 1;
}

const E2E_HEAD = "import { test, expect } from '@playwright/test';\n";
const UNIT_HEAD = "import { test, describe, it, suite } from 'node:test';\nimport { assert } from '../../support/assertions.mjs';\n";
const CASE_FILE = { e2e: 'tests/acceptance/e2e/zz-case.spec.mjs', unit: 'tests/acceptance/unit/zz-case.test.mjs' };

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

test('AC-EQ-4 版本庫中 61 個必要編號都出現在至少一個驗收測試名稱中，沒有違反靜態規則，檢查通過', () => {
  const r = runCheck({ root: ROOT });
  assert.equal(r.requiredIds.length, 61);
  assert.deepEqual(sorted(r.requiredIds), sorted([...EXPECTED_AC, ...EXPECTED_NFR, ...EXPECTED_SUPPLEMENTARY]));
  assert.deepEqual(r.missing, []);
  assert.deepEqual(r.violations, []);
  // 採計覆蓋的測試只來自 tests/acceptance/（spec.md 12.2 第 3 點）
  assert.ok(r.tests.length > 0);
  for (const t of r.tests) assert.ok(t.file.startsWith('tests/acceptance/'), t.file);
  assert.equal(r.ok, true);
  assert.equal(runCli(ROOT).status, 0, 'CI 執行的檢查指令應以 0 結束');
});

test('AC-EQ-4 反例：刪除需求指定之編號（翻錯翻回的驗收）的測試後，檢查函式與 CI 執行的檢查指令都失敗，且只回報該編號', (t) => {
  const repo = makeTempRepo();
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  assertBaselinePasses(repo);

  const before = runCheck({ root: repo });
  const removed = removeFromAcceptance(repo, TARGET);

  const after = runCheck({ root: repo });
  assert.equal(after.ok, false);
  assert.deepEqual(after.missing, [TARGET]);
  assert.deepEqual(after.violations, []);
  // 只刪除了目標測試，其他測試未被誤刪
  assert.equal(after.tests.length, before.tests.length - removed.length);

  const cli = runCli(repo);
  assert.equal(cli.status, 1, `CLI 應以 1 結束；stdout=${cli.stdout} stderr=${cli.stderr}`);
  assert.match(cli.stderr, new RegExp(`${TARGET}(?![0-9])`));
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

test('AC-EQ-4 骨架宣告（最上層 test.skip(字串, 本體為空的函式)）可通過編號檢查但不算通過：--no-skip 時檢查函式與 CI 指令都失敗', (t) => {
  const repo = makeTempRepo();
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  assertBaselinePasses(repo);

  // 版本庫目前的骨架：需求指定之編號只由骨架涵蓋，仍可通過編號檢查
  const r = runCheck({ root: repo });
  const skeletons = r.tests.filter((x) => x.skeleton);
  assert.ok(skeletons.some((x) => x.name.startsWith(`${TARGET} `)), '需求指定之編號目前應只有骨架');
  assert.ok(r.skippedTotal > 0);
  assert.equal(r.ok, true);

  const strict = runCheck({ root: repo, noSkip: true });
  assert.equal(strict.ok, false, '--no-skip 時有骨架即失敗');
  assert.deepEqual(strict.missing, []);
  const cli = runCli(repo, ['--no-skip']);
  assert.equal(cli.status, 1, `--no-skip 的 CLI 應以 1 結束；stderr=${cli.stderr}`);
  assert.match(cli.stderr, new RegExp(`${TARGET}(?![0-9])`));

  // 骨架宣告允許的函式形式（可帶參數、async）都不是違規
  const forms = [
    `test.skip('${TARGET} 骨架 1', () => {});`,
    `test.skip('${TARGET} 骨架 2', async () => {});`,
    `test.skip('${TARGET} 骨架 3', async ({ page }) => {});`,
    `test.skip("${TARGET} 骨架 4", (t) => {
      // 只有註解的本體仍為空
    });`,
  ].join('\n');
  for (const layer of ['e2e', 'unit']) {
    const head = layer === 'e2e' ? E2E_HEAD : UNIT_HEAD;
    const { r: withForms, cli: formsCli, inFile } = checkWithFile(repo, CASE_FILE[layer], head + forms);
    assert.deepEqual(inFile, [], `${layer}：骨架宣告不應被判定違規`);
    assert.equal(withForms.ok, true);
    assert.equal(formsCli.status, 0);
  }
});

/**
 * spec.md 12.2 第 8 點：骨架宣告以外的略過、預期失敗與 .only 寫法。每筆以 `// ←` 標示應被指出的行。
 * 每筆本體都有斷言呼叫，讓判定原因只會是寫法本身。
 */
const FORBIDDEN_FORMS = [
  // ── 宣告形式的其他變體（Playwright）
  ['e2e', 'test.fixme 宣告', `test.fixme('${TARGET} a', async () => { expect(1).toBe(1); }); // ←`],
  ['e2e', 'test.fail 宣告', `test.fail('${TARGET} a', async () => { expect(1).toBe(2); }); // ←`],
  ['e2e', 'test.describe.skip', `test.describe.skip('區塊', () => { // ←\n  test('${TARGET} a', async () => { expect(1).toBe(1); });\n});`],
  ['e2e', 'test.describe.fixme', `test.describe.fixme('區塊', () => { // ←\n  test('${TARGET} a', async () => { expect(1).toBe(1); });\n});`],
  ['e2e', 'test.describe.serial.skip', `test.describe.serial.skip('區塊', () => { // ←\n  test('${TARGET} a', async () => { expect(1).toBe(1); });\n});`],
  ['e2e', 'test.step.skip', `test('${TARGET} a', async () => {\n  expect(1).toBe(1);\n  await test.step.skip('步驟', async () => {}); // ←\n});`],
  ['e2e', 'test.only', `test.only('${TARGET} a', async () => { expect(1).toBe(1); }); // ←`],
  ['e2e', 'test.describe.only', `test.describe.only('區塊', () => { // ←\n  test('${TARGET} a', async () => { expect(1).toBe(1); });\n});`],
  // ── 測試本體內的執行期呼叫（Playwright）
  ['e2e', '本體內 test.skip()', `test('${TARGET} a', async () => {\n  test.skip(); // ←\n  expect(1).toBe(1);\n});`],
  ['e2e', '本體內 test.skip(條件)', `test('${TARGET} a', async ({ browserName }) => {\n  test.skip(browserName === 'webkit'); // ←\n  expect(1).toBe(1);\n});`],
  ['e2e', '本體內 test.skip(條件, 說明)', `test('${TARGET} a', async ({ browserName }) => {\n  test.skip(browserName === 'webkit', '尚未支援'); // ←\n  expect(1).toBe(1);\n});`],
  ['e2e', '本體內 test.fixme()', `test('${TARGET} a', async () => {\n  test.fixme(); // ←\n  expect(1).toBe(1);\n});`],
  ['e2e', '本體內 test.fail()', `test('${TARGET} a', async () => {\n  test.fail(); // ←\n  expect(1).toBe(2);\n});`],
  ['e2e', 'testInfo.skip()', `test('${TARGET} a', async ({}, testInfo) => {\n  testInfo.skip(); // ←\n  expect(1).toBe(1);\n});`],
  ['e2e', 'testInfo.fixme()', `test('${TARGET} a', async ({}, testInfo) => {\n  testInfo.fixme(); // ←\n  expect(1).toBe(1);\n});`],
  ['e2e', 'testInfo.fail()', `test('${TARGET} a', async ({}, testInfo) => {\n  testInfo.fail(); // ←\n  expect(1).toBe(2);\n});`],
  ['e2e', 'describe 本體內 test.skip()', `test.describe('區塊', () => {\n  test.skip(); // ←\n  test('${TARGET} a', async () => { expect(1).toBe(1); });\n});`],
  // ── 選項物件與註記（Playwright）
  ['e2e', 'annotation type skip', `test('${TARGET} a', { annotation: { type: 'skip' } }, async () => { expect(1).toBe(1); }); // ←`],
  ['e2e', 'annotation 陣列含 fixme', `test('${TARGET} a', {\n  annotation: [{ type: 'issue', description: 'x' }, { type: 'fixme' }], // ←\n}, async () => { expect(1).toBe(1); });`],
  ['e2e', 'annotation type fail', `test('${TARGET} a', { annotation: { type: 'fail' } }, async () => { expect(1).toBe(2); }); // ←`],
  ['e2e', '計算屬性 test[\'skip\']', `test['skip']('${TARGET} a', async () => {}); // ←`],
  ['e2e', '計算屬性 test["fixme"]', `test["fixme"]('${TARGET} a', async () => { expect(1).toBe(1); }); // ←`],
  // ── 形狀不符的骨架（只有最上層 test.skip(字串, 本體為空的箭頭函式) 是骨架）
  ['e2e', '骨架本體不為空', `test.skip('${TARGET} a', async () => { expect(1).toBe(1); }); // ←`],
  ['e2e', '骨架在 describe 內', `test.describe('區塊', () => {\n  test.skip('${TARGET} a', async () => {}); // ←\n});`],
  ['e2e', '骨架名稱為樣板字面值', `test.skip(\`${TARGET} a\`, async () => {}); // ←`],
  ['e2e', '骨架本體為 function 運算式', `test.skip('${TARGET} a', async function () {}); // ←`],
  ['e2e', '骨架有三個參數', `test.skip('${TARGET} a', { tag: '@x' }, async () => {}); // ←`],
  // ── node:test
  ['unit', 'it.skip', `it.skip('${TARGET} a', () => { assert.ok(true); }); // ←`],
  ['unit', 'it.todo', `it.todo('${TARGET} a'); // ←`],
  ['unit', 'test.todo', `test.todo('${TARGET} a'); // ←`],
  ['unit', 'describe.skip', `describe.skip('區塊', () => { // ←\n  it('${TARGET} a', () => { assert.ok(true); });\n});`],
  ['unit', 'describe.todo', `describe.todo('區塊', () => { // ←\n  it('${TARGET} a', () => { assert.ok(true); });\n});`],
  ['unit', 'suite.skip', `suite.skip('區塊', () => { // ←\n  test('${TARGET} a', () => { assert.ok(true); });\n});`],
  ['unit', 'it.only', `it.only('${TARGET} a', () => { assert.ok(true); }); // ←`],
  ['unit', '本體內 t.skip()', `test('${TARGET} a', (t) => {\n  t.skip(); // ←\n  assert.ok(true);\n});`],
  ['unit', '本體內 t.skip(說明)', `test('${TARGET} a', (t) => {\n  if (process.platform === 'win32') t.skip('不支援'); // ←\n  assert.ok(true);\n});`],
  ['unit', '本體內 t.todo()', `test('${TARGET} a', (t) => {\n  t.todo(); // ←\n  assert.ok(true);\n});`],
  ['unit', '選項 skip', `test('${TARGET} a', { skip: true }, () => { assert.ok(true); }); // ←`],
  ['unit', '選項 skip（字串）', `test('${TARGET} a', { skip: '尚未實作' }, () => { assert.ok(true); }); // ←`],
  ['unit', '選項 todo', `test('${TARGET} a', { todo: true }, () => { assert.ok(true); }); // ←`],
  ['unit', '選項 expectFailure', `test('${TARGET} a', { expectFailure: true }, () => { assert.ok(false); }); // ←`],
  ['unit', 'describe 選項 skip', `describe('區塊', { skip: true }, () => { // ←\n  it('${TARGET} a', () => { assert.ok(true); });\n});`],
];

test('AC-EQ-4 反例：骨架宣告以外的每一種略過、預期失敗與 .only 寫法，即使沒有 --no-skip，檢查函式與 CI 指令都失敗並指出檔案與行號', (t) => {
  const repo = makeTempRepo();
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  assertBaselinePasses(repo);

  // 對照組：同一位置、同樣結構的一般測試不違規（排除「檔案本身就違規」）
  const controls = {
    e2e: `test('${TARGET} a', async ({ page }, testInfo) => {\n  expect(testInfo.title).toContain('a');\n});`,
    // assert.fail 是斷言（會讓測試失敗），不是預期失敗，不得被誤判
    unit: `test('${TARGET} a', () => {\n  if (1 > 2) assert.fail('不應執行到這裡');\n  assert.ok(true);\n});`,
  };
  for (const [layer, body] of Object.entries(controls)) {
    const head = layer === 'e2e' ? E2E_HEAD : UNIT_HEAD;
    const c = checkWithFile(repo, CASE_FILE[layer], head + body);
    assert.deepEqual(c.inFile, [], `${layer} 對照組不應違規`);
    assert.equal(c.r.ok, true, `${layer} 對照組應通過`);
    assert.equal(c.cli.status, 0, `${layer} 對照組 CLI 應以 0 結束`);
  }

  for (const [layer, label, body] of FORBIDDEN_FORMS) {
    const head = layer === 'e2e' ? E2E_HEAD : UNIT_HEAD;
    const src = head + body;
    const line = markedLine(src);
    const rel = CASE_FILE[layer];
    const { r, cli, inFile } = checkWithFile(repo, rel, src);
    assert.equal(r.ok, false, `${label}：檢查函式應失敗`);
    const at = inFile.filter((v) => v.line === line && /第 8 點/.test(v.rule));
    assert.ok(at.length > 0, `${label}：應在 ${rel}:${line} 回報 12.2 第 8 點；實際 ${JSON.stringify(inFile)}`);
    assert.equal(cli.status, 1, `${label}：CLI 應以 1 結束；stderr=${cli.stderr}`);
    assert.ok(cli.stderr.includes(`${rel}:${line}`), `${label}：CLI 應指出 ${rel}:${line}；stderr=${cli.stderr}`);
  }
});

test('AC-EQ-4 反例：需求指定之編號只出現在模組單元測試（tests/unit/）的名稱中時檢查失敗，且回報單元測試帶編號', (t) => {
  const repo = makeTempRepo();
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  assertBaselinePasses(repo);

  const rel = 'tests/unit/zz-impostor.test.mjs';
  const impostor = [
    "import { test } from 'node:test';",
    "import assert from 'node:assert/strict';",
    `test('${TARGET} 翻錯 1 秒後翻回（以單元測試冒充驗收）', () => { // ←`,
    '  assert.equal(1, 1);',
    '});',
  ].join('\n');
  const line = markedLine(impostor);

  // (1) 驗收測試仍在：單元測試帶編號本身就失敗（在變更請求中就被發現）
  const withBoth = checkWithFile(repo, rel, impostor);
  assert.equal(withBoth.r.ok, false);
  assert.deepEqual(withBoth.r.missing, []);
  assert.ok(withBoth.inFile.some((v) => v.line === line && /第 5 點/.test(v.rule)), JSON.stringify(withBoth.inFile));
  assert.equal(withBoth.cli.status, 1);
  assert.ok(withBoth.cli.stderr.includes(`${rel}:${line}`), withBoth.cli.stderr);

  // (2) 刪除驗收測試、只剩單元測試：編號不被採計為覆蓋
  removeFromAcceptance(repo, TARGET);
  const only = checkWithFile(repo, rel, impostor);
  assert.equal(only.r.ok, false);
  assert.deepEqual(only.r.missing, [TARGET], '單元測試的名稱不得採計為覆蓋');
  assert.ok(only.inFile.some((v) => v.line === line && /第 5 點/.test(v.rule)));
  assert.equal(only.cli.status, 1);
  assert.match(only.cli.stderr, new RegExp(`${TARGET}(?![0-9])`));

  // 對照組：非必要編號（EQ-4 例外）出現在單元測試名稱中不違規
  const exempt = checkWithFile(repo, 'tests/unit/zz-exempt.test.mjs',
    "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\ntest('NFR-1 不是必要編號', () => { assert.ok(true); });\n");
  assert.deepEqual(exempt.inFile, []);
});

test('AC-EQ-4 反例：需求指定之編號的測試放在不會被執行的位置或副檔名時檢查失敗，且不採計為覆蓋', (t) => {
  const repo = makeTempRepo();
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  assertBaselinePasses(repo);

  const bodies = {
    pw: `import { test, expect } from '@playwright/test';\ntest('${TARGET} a', async () => { expect(1).toBe(1); });\n`,
    node: `import { test } from 'node:test';\nimport { assert } from '../../support/assertions.mjs';\ntest('${TARGET} a', () => { assert.ok(true); });\n`,
  };
  const misplaced = [
    ['tests/acceptance/x.test.mjs', bodies.node], // 靜態掃描看得到、unit job 的 glob 不執行
    ['tests/acceptance/unit/x.spec.mjs', bodies.node], // 同上
    ['tests/acceptance/e2e/x.test.mjs', bodies.pw], // Playwright 一般 project 只執行 *.spec.mjs
    ['tests/acceptance/e2e/x.spec.js', bodies.pw], // Playwright 預設 testMatch 會執行，但不在靜態掃描範圍
    ['tests/acceptance/e2e/x.test.ts', bodies.pw],
    ['tests/acceptance/other/x.spec.mjs', bodies.pw],
  ];

  // (1) 驗收測試仍在：位置不符的檔案本身就失敗
  for (const [rel, src] of misplaced) {
    const c = checkWithFile(repo, rel, src);
    assert.equal(c.r.ok, false, `${rel}：應失敗`);
    assert.ok(c.inFile.some((v) => /第 4 點/.test(v.rule)), `${rel}：應回報 12.2 第 4 點；${JSON.stringify(c.inFile)}`);
    assert.ok(!c.r.files.includes(rel), `${rel}：不應列入掃描的驗收測試檔`);
    assert.equal(c.cli.status, 1, `${rel}：CLI 應以 1 結束`);
    assert.ok(c.cli.stderr.includes(rel), c.cli.stderr);
  }

  // (2) 刪除驗收測試、只剩位置不符的測試：不採計為覆蓋
  removeFromAcceptance(repo, TARGET);
  const c = checkWithFile(repo, misplaced[0][0], misplaced[0][1]);
  assert.deepEqual(c.r.missing, [TARGET]);
  assert.equal(c.cli.status, 1);
});

test('AC-EQ-4 反例：骨架刪掉略過標記留下空本體、或非骨架測試沒有斷言呼叫時，檢查函式與 CI 指令都失敗', (t) => {
  const repo = makeTempRepo();
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  assertBaselinePasses(repo);

  // 取出需求指定之編號的真實骨架（名稱與所在檔案）
  const removed = removeFromAcceptance(repo, TARGET);
  assert.equal(removed.length, 1, '需求指定之編號應恰有一個骨架');
  const [{ rel, src: skeletonSrc }] = removed;
  assert.match(skeletonSrc, /^test\.skip\(/, '目前應為骨架宣告');
  const original = readFileSync(path.join(repo, rel), 'utf8');
  const nameLiteral = skeletonSrc.match(/^test\.skip\((\s*'[^']*')/)[1];

  const variants = [
    // 骨架刪掉 .skip：本體為空的「實際測試」
    ['刪掉略過標記的空本體', skeletonSrc.replace(/^test\.skip\(/, 'test(')],
    // 有敘述但沒有任何斷言呼叫
    ['零斷言（只有操作）', `test(${nameLiteral}, async ({ page }) => {\n  await page.goto('/');\n});`],
    ['零斷言（斷言寫在字串與註解中）', `test(${nameLiteral}, async ({ page }) => {\n  // expect(page).toHaveTitle('x');\n  await page.evaluate("expect(1)");\n});`],
  ];
  for (const [label, replacement] of variants) {
    const src = `${original.trimEnd()}\n${replacement}\n`;
    const line = src.split('\n').length - replacement.split('\n').length;
    writeFileSync(path.join(repo, rel), src);
    execFileSync(process.execPath, ['--check', path.join(repo, rel)]);
    const r = runCheck({ root: repo });
    assert.deepEqual(r.missing, [], `${label}：名稱仍涵蓋編號（失敗的原因必須是斷言，不是缺編號）`);
    assert.equal(r.ok, false, `${label}：應失敗`);
    assert.ok(r.violations.some((v) => v.file === rel && v.line === line && /第 9a 點/.test(v.rule)),
      `${label}：應在 ${rel}:${line} 回報 12.2 第 9a 點；${JSON.stringify(r.violations)}`);
    const cli = runCli(repo);
    assert.equal(cli.status, 1, `${label}：CLI 應以 1 結束`);
    assert.ok(cli.stderr.includes(`${rel}:${line}`), cli.stderr);
  }

  // 對照組：同一名稱、有斷言呼叫的實際測試通過
  writeFileSync(path.join(repo, rel), `${original.trimEnd()}\ntest(${nameLiteral}, async ({ page }) => {\n  await page.goto('/');\n  await expect(page).toHaveTitle(/./);\n});\n`);
  const ok = runCheck({ root: repo });
  assert.deepEqual(ok.violations, []);
  assert.equal(ok.ok, true);
});

test('AC-EQ-4 反例：無瀏覽器層驗收測試未自 tests/support/assertions.mjs 匯入 assert（含只有骨架的檔案）、或同一檔案的測試名稱重複時失敗', (t) => {
  const repo = makeTempRepo();
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  assertBaselinePasses(repo);
  const rel = CASE_FILE.unit;

  const cases = [
    ['只有骨架、沒有匯入', `import { test } from 'node:test';\ntest.skip('${TARGET} a', () => {});\n`, /第 9c 點/],
    ['匯入 node:assert/strict', `import { test } from 'node:test';\nimport { assert } from '../../support/assertions.mjs';\nimport strict from 'node:assert/strict';\ntest('${TARGET} a', () => { assert.ok(true); strict.ok(true); });\n`, /第 9c 點/],
    ['匯入 node:assert', `import { test } from 'node:test';\nimport assert from 'node:assert';\ntest('${TARGET} a', () => { assert.ok(true); });\n`, /第 9c 點/],
    // 非骨架測試借用骨架的名稱（執行結果以名稱對應骨架，會得到豁免）
    ['名稱與骨架重複', `import { test } from 'node:test';\nimport { assert } from '../../support/assertions.mjs';\ntest.skip('${TARGET} a', () => {});\ntest('${TARGET} a', () => { assert.ok(true); });\n`, /第 9b 點/],
  ];
  for (const [label, src, rule] of cases) {
    const c = checkWithFile(repo, rel, src);
    assert.equal(c.r.ok, false, `${label}：應失敗`);
    assert.ok(c.inFile.some((v) => rule.test(v.rule)), `${label}：應回報 ${rule}；${JSON.stringify(c.inFile)}`);
    assert.equal(c.cli.status, 1, `${label}：CLI 應以 1 結束`);
  }

  // 版本庫中無瀏覽器層的每個驗收測試檔（含只有骨架的檔案）都自 tests/support/assertions.mjs 匯入
  const r = runCheck({ root: ROOT });
  const unitFiles = r.files.filter((f) => f.startsWith('tests/acceptance/unit/'));
  assert.ok(unitFiles.length >= 4);
  for (const f of unitFiles) {
    assert.match(readFileSync(path.join(ROOT, f), 'utf8'), /^import \{ assert \} from '\.\.\/\.\.\/support\/assertions\.mjs';$/m, f);
  }
});

// ───── 以 CI unit job 的指令執行（spec.md 12.2.1；結果檔沿用 acceptance-results/unit.jsonl 與結束標記）─────

/** 只含一個無瀏覽器層驗收測試檔的暫存版本庫（避免遞迴執行本檔）。 */
function makeRunRepo() {
  const dir = mkdtempSync(path.join(tmpdir(), 'ac-eq-4-run-'));
  mkdirSync(path.join(dir, 'docs/design'), { recursive: true });
  mkdirSync(path.join(dir, 'tests/acceptance/unit'), { recursive: true });
  mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  cpSync(REQUIREMENTS, path.join(dir, 'docs/requirements.md'));
  cpSync(SUPPLEMENTARY, path.join(dir, 'docs/design/supplementary-acceptance.json'));
  for (const s of ['check-acceptance-ids.mjs', 'check-acceptance-results.mjs', 'acceptance-reporter.mjs']) {
    cpSync(path.join(ROOT, 'scripts', s), path.join(dir, 'scripts', s));
  }
  cpSync(path.join(ROOT, 'tests/support'), path.join(dir, 'tests/support'), { recursive: true });
  return dir;
}

/** 執行 CI unit job 的步驟 2、3；回傳結果檢查的結束代碼與輸出。 */
function runUnitLayer(dir, src, resultArgs = []) {
  writeFileSync(path.join(dir, 'tests/acceptance/unit/zz-case.test.mjs'), src);
  rmSync(path.join(dir, 'acceptance-results'), { recursive: true, force: true });
  mkdirSync(path.join(dir, 'acceptance-results'));
  // 在 node --test 之內啟動的子行程會繼承 NODE_TEST_CONTEXT 而改向父行程回報、不使用指定的 reporter
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const run = spawnSync(process.execPath, [
    '--test',
    '--test-reporter=./scripts/acceptance-reporter.mjs',
    '--test-reporter-destination=acceptance-results/unit.jsonl',
    'tests/acceptance/unit/**/*.test.mjs',
  ], { cwd: dir, env, encoding: 'utf8' });
  const results = readFileSync(path.join(dir, 'acceptance-results/unit.jsonl'), 'utf8');
  assert.match(results.trimEnd().split('\n').at(-1), /"type":"end"/, '結果檔應有結束標記');
  const check = spawnSync(process.execPath, [
    'scripts/check-acceptance-results.mjs', '--layer', 'unit', ...resultArgs, 'acceptance-results/unit.jsonl',
  ], { cwd: dir, env, encoding: 'utf8' });
  return { testStatus: run.status, status: check.status, stdout: check.stdout, stderr: check.stderr };
}

test('AC-EQ-4 反例：以 CI 的指令執行時，零斷言、提前返回、吞掉失敗的斷言、靜態檢查看不到的執行期略過都判定失敗；骨架只在 --no-skip 時失敗', (t) => {
  const dir = makeRunRepo();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const head = UNIT_HEAD;

  // 對照組：有斷言的實際測試通過（排除「流程本來就失敗」）
  const control = runUnitLayer(dir, `${head}test('${TARGET} a', () => { assert.equal(1 + 1, 2); });\n`);
  assert.equal(control.testStatus, 0);
  assert.equal(control.status, 0, `對照組應通過；${control.stdout}${control.stderr}`);

  // 骨架：不加 --no-skip 通過，--no-skip 失敗（第 3 項）
  const skeletonSrc = `${head}test.skip('${TARGET} a', () => {});\n`;
  assert.equal(runUnitLayer(dir, skeletonSrc).status, 0);
  const strict = runUnitLayer(dir, skeletonSrc, ['--no-skip']);
  assert.equal(strict.status, 1);
  assert.match(strict.stderr, /第 3 項/);

  const cases = [
    // 靜態有斷言呼叫，但執行時一次也沒有執行（第 6 項）
    ['在第一個斷言前提前返回', `test('${TARGET} a', () => {\n  if (process.env.ZZ_NEVER_SET === undefined) return;\n  assert.ok(true);\n});`, /第 6 項/],
    ['斷言寫在永遠不執行的分支', `test('${TARGET} a', () => {\n  const items = [];\n  for (const x of items) assert.ok(x);\n});`, /第 6 項/],
    // 失敗的斷言被 try/catch 吞掉，測試回報通過（第 6 項）
    ['吞掉失敗的斷言', `test('${TARGET} a', () => {\n  try {\n    assert.equal(1, 2);\n  } catch {\n    // 吞掉\n  }\n});`, /第 6 項/],
    // 靜態偵測看不到的執行期略過（動態組字）：以執行結果判定為非骨架的略過（第 2 項）
    ['動態組字的執行期略過', `test('${TARGET} a', (t) => {\n  t['sk' + 'ip']();\n  assert.ok(true);\n});`, /第 2 項/],
  ];
  for (const [label, body, item] of cases) {
    const src = head + body + '\n';
    const r = runUnitLayer(dir, src);
    assert.equal(r.status, 1, `${label}：結果檢查應以 1 結束；${r.stdout}${r.stderr}`);
    assert.match(r.stderr, item, `${label}：應回報 ${item}`);
  }

  // 動態組字的略過，靜態檢查確實看不到（證明是執行結果抓到的）
  writeFileSync(path.join(dir, 'tests/acceptance/unit/zz-case.test.mjs'), head + cases[3][1] + '\n');
  const scan = runCheck({ root: dir });
  assert.deepEqual(scan.violations.filter((v) => v.file === 'tests/acceptance/unit/zz-case.test.mjs'), []);
});

test('AC-EQ-4 本檔的測試名稱除了本身編號外不含其他必要編號（避免以自身名稱掩蓋反例）', () => {
  const required = [...EXPECTED_AC, ...EXPECTED_NFR, ...EXPECTED_SUPPLEMENTARY].filter((id) => id !== 'AC-EQ-4');
  const own = extractTests(readFileSync(fileURLToPath(import.meta.url), 'utf8'));
  assert.equal(own.length, 13);
  for (const x of own) {
    assert.ok(x.name.startsWith('AC-EQ-4 '), x.name);
    const leaked = required.filter((id) => new RegExp(`(?<![A-Za-z0-9-])${id}(?![0-9A-Za-z])`).test(x.name));
    assert.deepEqual(leaked, [], `測試名稱含其他必要編號：${x.name}`);
  }
});
