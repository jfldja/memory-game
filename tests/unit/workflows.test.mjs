// 模組單元測試：.github/workflows 的靜態安全檢查（spec.md 12.1「共同設定」、review-process.md 第 4 節）。
// 事件觸發與權限的實際效果無法在本機驗證，由產品負責人依 spec.md 12.6 步驟 8 確認。
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIR = path.join(ROOT, '.github', 'workflows');
const files = readdirSync(DIR).filter((f) => f.endsWith('.yml')).sort();
// 只看設定本身：去除整行註解
const read = (f) =>
  readFileSync(path.join(DIR, f), 'utf8').split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');

/** 取出每個 run: 的內容（單行或區塊）。 */
function runBlocks(text) {
  const lines = text.split('\n');
  const blocks = [];
  for (let k = 0; k < lines.length; k++) {
    const m = lines[k].match(/^(\s*)(?:-\s+)?run:\s*(.*)$/);
    if (!m) continue;
    const indent = lines[k].search(/\S/);
    if (m[2] && !/^[|>][-+]?$/.test(m[2])) {
      blocks.push(m[2]);
      continue;
    }
    const body = [];
    for (let j = k + 1; j < lines.length; j++) {
      if (lines[j].trim() !== '' && lines[j].search(/\S/) <= indent) break;
      body.push(lines[j]);
    }
    blocks.push(body.join('\n'));
  }
  return blocks;
}

describe('工作流程', () => {
  test('四個工作流程都存在', () => {
    assert.deepEqual(files, ['ci.yml', 'deploy.yml', 'pr-body.yml', 'review-gate.yml']);
  });

  for (const f of files) {
    test(`${f}：run: 中沒有 \${{ }} 插值`, () => {
      const blocks = runBlocks(read(f));
      assert.ok(blocks.length > 0);
      for (const b of blocks) assert.doesNotMatch(b, /\$\{\{/, b);
    });

    test(`${f}：宣告頂層 permissions`, () => {
      assert.match(read(f), /^permissions:/m);
    });

    test(`${f}：第三方 action 以完整 commit SHA 固定`, () => {
      const uses = [...read(f).matchAll(/^\s*(?:-\s+)?uses:\s*(\S+)/gm)].map((m) => m[1]);
      assert.ok(uses.length > 0);
      for (const u of uses) assert.match(u, /^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/, u);
    });

    test(`${f}：actions/checkout 不保留權杖`, () => {
      const text = read(f);
      const count = (text.match(/uses: actions\/checkout@/g) ?? []).length;
      const persisted = (text.match(/persist-credentials: false/g) ?? []).length;
      assert.equal(persisted, count);
    });
  }

  test('ci.yml：必要檢查名稱與三引擎矩陣；單元測試以引號傳 glob', () => {
    const t = read('ci.yml');
    assert.match(t, /^    name: unit\n/m);
    assert.match(t, /^    name: acceptance-ids\n/m);
    assert.match(t, /name: e2e \(\$\{\{ matrix\.browser \}\}\)/);
    assert.match(t, /browser: \[chromium, firefox, webkit\]/);
    assert.match(t, /node scripts\/check-acceptance-ids\.mjs/);
    assert.match(t, /--project="\$BROWSER-realtime" --workers=1/);
  });

  /** 取出 ci.yml 中某個 job 的區塊（到下一個同層 job 為止）。 */
  function jobBlock(text, job) {
    const lines = text.split('\n');
    const start = lines.findIndex((l) => l === `  ${job}:`);
    assert.ok(start >= 0, `找不到 job ${job}`);
    let end = lines.length;
    for (let k = start + 1; k < lines.length; k++) if (/^  \S/.test(lines[k])) { end = k; break; }
    return lines.slice(start, end).join('\n');
  }
  /** job 區塊中各步驟的 run 內容，依序（不含 uses 步驟）。 */
  const runsOf = (block) => runBlocks(block).map((b) => b.trim());

  test('ci.yml unit：模組單元測試與驗收測試分兩次執行，驗收測試以自訂 reporter 輸出並檢查結果（spec.md 12.1、12.2.1）', () => {
    const runs = runsOf(jobBlock(read('ci.yml'), 'unit'));
    assert.equal(runs.length, 3);
    assert.equal(runs[0], "node --test 'tests/unit/**/*.test.mjs'");
    assert.match(runs[1], /^mkdir -p acceptance-results\n/);
    assert.match(runs[1], /--test-reporter=spec --test-reporter-destination=stdout/);
    assert.match(runs[1], /--test-reporter=\.\/scripts\/acceptance-reporter\.mjs --test-reporter-destination=acceptance-results\/unit\.jsonl/);
    assert.match(runs[1], / 'tests\/acceptance\/unit\/\*\*\/\*\.test\.mjs'$/);
    assert.equal(runs[2], 'node scripts/check-acceptance-results.mjs --layer unit acceptance-results/unit.jsonl');
    // 執行器沒有名稱過濾或略過參數
    for (const r of runs) assert.doesNotMatch(r, /--test-name-pattern|--test-skip-pattern|--test-only|--no-skip/);
  });

  test('ci.yml e2e：BUILD_SHA 在 job 層級設定（建置與測試讀同一個值），步驟中不另外設定（spec.md 第 11 節）', () => {
    const block = jobBlock(read('ci.yml'), 'e2e');
    const jobEnv = block.match(/^    env:\n((?:      .*\n)+)/m);
    assert.ok(jobEnv, '應有 job 層級的 env');
    assert.match(jobEnv[1], /^      BUILD_SHA: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}$/m);
    assert.equal((block.match(/BUILD_SHA:/g) ?? []).length, 1, 'BUILD_SHA 只能在 job 層級設定一次');
  });

  test('ci.yml e2e：一般與 realtime 各輸出結果檔，最後以兩個結果檔檢查 e2e 層（spec.md 12.2.1）', () => {
    const block = jobBlock(read('ci.yml'), 'e2e');
    const runs = runsOf(block);
    assert.deepEqual(runs.slice(-4), [
      'node scripts/build.mjs',
      'npx playwright test --project="$BROWSER"',
      'npx playwright test --project="$BROWSER-realtime" --workers=1',
      'node scripts/check-acceptance-results.mjs --layer e2e acceptance-results/e2e.jsonl acceptance-results/e2e-realtime.jsonl',
    ]);
    assert.match(block, /ACCEPTANCE_RESULTS_FILE: acceptance-results\/e2e\.jsonl\n\s+run: npx playwright test --project="\$BROWSER"\n/);
    assert.match(block, /ACCEPTANCE_RESULTS_FILE: acceptance-results\/e2e-realtime\.jsonl\n\s+run: npx playwright test --project="\$BROWSER-realtime" --workers=1\n/);
    for (const r of runs) assert.doesNotMatch(r, /--grep|--grep-invert|--last-failed|--only-changed|--pass-with-no-tests/);
  });

  // ───── v0.7（DQ-15 採 (g′)＋(c)＋(a)＋(e)；spec.md 12.7.4、12.7.5；module-test-standards.md M13）─────

  /** job 區塊中，job 層級（4 格縮排）的某個鍵的值；沒有時為 null。 */
  function jobKey(block, key) {
    const m = block.match(new RegExp(`^    ${key}:[ \\t]*(.*)$`, 'm'));
    return m ? m[1].trim() : null;
  }
  /** job 區塊中的步驟（以 6 格縮排的 `- ` 開頭切分），各自的原文。 */
  function stepsOf(block) {
    const lines = block.split('\n');
    const steps = [];
    let cur = null;
    for (const l of lines) {
      if (/^      - /.test(l)) {
        cur = [l];
        steps.push(cur);
      } else if (cur && (/^        /.test(l) || l.trim() === '')) {
        cur.push(l);
      } else if (cur && /^ {0,6}\S/.test(l)) {
        cur = null;
      }
    }
    return steps.map((s) => s.join('\n').replace(/\n+$/, ''));
  }
  const ciJobs = ['unit', 'acceptance-ids', 'e2e'];

  test('ci.yml v0.7：只有 unit、acceptance-ids、e2e 三個 job，job 名稱（必要檢查名稱）不變', () => {
    const t = read('ci.yml');
    const jobsText = t.slice(t.search(/^jobs:$/m));
    const jobs = [...jobsText.matchAll(/^  ([\w-]+):[ \t]*$/gm)].map((m) => m[1]);
    assert.deepEqual(jobs, ciJobs);
    assert.equal(jobKey(jobBlock(t, 'unit'), 'name'), 'unit');
    assert.equal(jobKey(jobBlock(t, 'acceptance-ids'), 'name'), 'acceptance-ids');
    assert.equal(jobKey(jobBlock(t, 'e2e'), 'name'), 'e2e (${{ matrix.browser }})');
  });

  test('ci.yml v0.7：每個 job 的 timeout-minutes 為規定值（unit、acceptance-ids 10，e2e 30）', () => {
    const t = read('ci.yml');
    assert.equal(jobKey(jobBlock(t, 'unit'), 'timeout-minutes'), '10');
    assert.equal(jobKey(jobBlock(t, 'acceptance-ids'), 'timeout-minutes'), '10');
    assert.equal(jobKey(jobBlock(t, 'e2e'), 'timeout-minutes'), '30');
  });

  test('ci.yml v0.7：runs-on 為規定值（unit、acceptance-ids 為 ubuntu-26.04，e2e 為 macos-15），e2e 矩陣仍為三引擎且沒有 include', () => {
    const t = read('ci.yml');
    assert.equal(jobKey(jobBlock(t, 'unit'), 'runs-on'), 'ubuntu-26.04');
    assert.equal(jobKey(jobBlock(t, 'acceptance-ids'), 'runs-on'), 'ubuntu-26.04');
    const e2e = jobBlock(t, 'e2e');
    assert.equal(jobKey(e2e, 'runs-on'), 'macos-15');
    assert.match(e2e, /^      matrix:\n        browser: \[chromium, firefox, webkit\]\n/m);
    assert.doesNotMatch(e2e, /^\s*(include|exclude):/m);
    // runs-on 只出現在三個 job 層級
    assert.equal((t.match(/^\s*runs-on:/gm) ?? []).length, 3);
  });

  test('ci.yml v0.7：任何 job 與 step 都沒有 continue-on-error', () => {
    assert.doesNotMatch(read('ci.yml'), /continue-on-error/);
  });

  test('ci.yml v0.7：沒有 --with-deps；e2e 的 install step 逐字為 npx playwright install "$BROWSER"，step 逾時 10 分鐘，沒有條件', () => {
    const t = read('ci.yml');
    assert.doesNotMatch(t, /--with-deps/);
    const steps = stepsOf(jobBlock(t, 'e2e'));
    const installs = steps.filter((s) => /playwright install/.test(s));
    assert.equal(installs.length, 1);
    assert.equal(runBlocks(installs[0]).map((b) => b.trim()).join('\n'), 'npx playwright install "$BROWSER"');
    assert.match(installs[0], /^\s*(?:-\s+)?timeout-minutes: 10$/m);
    assert.doesNotMatch(installs[0], /^\s*(?:-\s+)?if:/m);
    // 其他 job 沒有安裝瀏覽器
    for (const j of ['unit', 'acceptance-ids']) assert.doesNotMatch(jobBlock(t, j), /playwright install/);
  });

  test('ci.yml v0.7：e2e 的快取 step 在 npm ci 之後、install 之前；action、路徑、鍵為規定值，沒有 restore-keys', () => {
    const t = read('ci.yml');
    const steps = stepsOf(jobBlock(t, 'e2e'));
    const idxCache = steps.findIndex((s) => /uses: actions\/cache@/.test(s));
    const idxNpm = steps.findIndex((s) => /run: npm ci$/m.test(s));
    const idxInstall = steps.findIndex((s) => /playwright install/.test(s));
    assert.ok(idxNpm >= 0 && idxCache >= 0 && idxInstall >= 0);
    assert.ok(idxNpm < idxCache && idxCache < idxInstall, `順序：npm ci ${idxNpm}、cache ${idxCache}、install ${idxInstall}`);
    const cache = steps[idxCache];
    assert.match(cache, /^      - uses: actions\/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6\.1\.0$/m);
    const withBlock = cache.match(/^        with:\n((?:          .*\n?)+)/m);
    assert.ok(withBlock, '快取 step 應有 with:');
    const inputs = withBlock[1].trimEnd().split('\n').map((l) => l.trim());
    assert.deepEqual(inputs, [
      'path: ~/Library/Caches/ms-playwright',
      "key: playwright-${{ runner.os }}-${{ runner.arch }}-${{ matrix.browser }}-${{ hashFiles('package-lock.json') }}",
    ]);
    assert.doesNotMatch(t, /restore-keys/);
    // 整個 ci.yml 只有這一個 actions/cache；其他 job 沒有快取 step
    assert.equal((t.match(/uses: actions\/cache@/g) ?? []).length, 1);
    for (const j of ['unit', 'acceptance-ids']) assert.doesNotMatch(jobBlock(t, j), /actions\/cache|^\s*cache:/m);
  });

  test('ci.yml v0.7：沒有任何 step 以 cache-hit 為條件，ci.yml 沒有 if:', () => {
    const t = read('ci.yml');
    assert.doesNotMatch(t, /cache-hit/);
    assert.doesNotMatch(t, /^\s*(?:-\s+)?if:/m);
  });

  test('ci.yml v0.7：unit job 第一步逐字為模組單元測試的 glob（spec.md 12.7.5 同類風險第 1 點）', () => {
    const steps = stepsOf(jobBlock(read('ci.yml'), 'unit'));
    const runSteps = steps.filter((s) => runBlocks(s).length > 0);
    assert.equal(runBlocks(runSteps[0])[0].trim(), "node --test 'tests/unit/**/*.test.mjs'");
    assert.match(runSteps[0], /^      - name: unit tests\n        run: node --test 'tests\/unit\/\*\*\/\*\.test\.mjs'$/);
  });

  test('ci.yml v0.7：e2e 的 step 順序與內容（除新增的快取與 install 外）不變', () => {
    const runs = runsOf(jobBlock(read('ci.yml'), 'e2e'));
    assert.deepEqual(runs, [
      'npm ci',
      'npx playwright install "$BROWSER"',
      'node scripts/build.mjs',
      'npx playwright test --project="$BROWSER"',
      'npx playwright test --project="$BROWSER-realtime" --workers=1',
      'node scripts/check-acceptance-results.mjs --layer e2e acceptance-results/e2e.jsonl acceptance-results/e2e-realtime.jsonl',
    ]);
  });

  test('playwright.config.mjs：自訂 reporter、一般 project 只執行 *.spec.mjs、CI 禁止 .only、不重試（spec.md 12.3）', () => {
    const c = readFileSync(path.join(ROOT, 'playwright.config.mjs'), 'utf8');
    assert.match(c, /reporter: \[\['list'\], \['\.\/scripts\/acceptance-reporter-pw\.mjs', \{ outputFile: RESULTS_FILE \}\]\]/);
    assert.match(c, /const RESULTS_FILE = process\.env\.ACCEPTANCE_RESULTS_FILE \|\| 'acceptance-results\/playwright\.jsonl';/);
    assert.match(c, /const SPEC_FILES = \/\\\.spec\\\.mjs\$\/;/);
    assert.match(c, /\{ name, use: \{ \.\.\.device \}, testMatch: SPEC_FILES, testIgnore: REALTIME \}/);
    assert.match(c, /testDir: 'tests\/acceptance\/e2e'/);
    assert.match(c, /forbidOnly: Boolean\(process\.env\.CI\)/);
    assert.match(c, /retries: 0/);
  });

  test('review-gate.yml：只簽出預設分支、不安裝套件、不使用快取、PR 編號以 env 傳入', () => {
    const t = read('review-gate.yml');
    assert.match(t, /pull_request_target:/);
    assert.match(t, /issue_comment:/);
    assert.match(t, /ref: \$\{\{ github\.event\.repository\.default_branch \}\}/);
    assert.doesNotMatch(t, /head\.(sha|ref)/);
    assert.doesNotMatch(t, /npm (ci|install)/);
    assert.doesNotMatch(t, /^\s*cache:/m);
    assert.match(t, /package-manager-cache: false/);
    assert.match(t, /PR_NUMBER: \$\{\{ github\.event\.pull_request\.number \|\| github\.event\.issue\.number \}\}/);
    assert.match(t, /group: review-gate-\$\{\{ github\.event\.pull_request\.number \|\| github\.event\.issue\.number \}\}/);
    assert.match(t, /cancel-in-progress: false/);
    assert.match(t, /statuses: write/);
    assert.doesNotMatch(t, /(contents|pull-requests|issues): write/);
  });

  test('pr-body.yml：pull_request 事件、不安裝套件、不使用快取', () => {
    const t = read('pr-body.yml');
    assert.match(t, /types: \[opened, edited, synchronize, reopened\]/);
    assert.doesNotMatch(t, /pull_request_target/);
    assert.doesNotMatch(t, /npm (ci|install)/);
    assert.match(t, /package-manager-cache: false/);
    assert.match(t, /name: pr-body\n/);
    assert.doesNotMatch(t, /: write/);
  });

  test('deploy.yml：只在推送 main 時執行，部署 job 權限為 pages、id-token 寫入', () => {
    const t = read('deploy.yml');
    assert.match(t, /push:\n\s+branches: \[main\]/);
    assert.match(t, /group: pages\n\s+cancel-in-progress: false/);
    assert.match(t, /pages: write/);
    assert.match(t, /id-token: write/);
    assert.match(t, /BUILD_SHA: \$\{\{ github\.sha \}\}/);
    assert.match(t, /name: AC-EQ-9（部署）與 EQ-12 證據/);
    assert.match(t, /9 \* 60 \* 1000/);
  });
});
