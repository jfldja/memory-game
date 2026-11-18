// 模組單元測試：6 支腳本的直接執行判斷（spec.md 12.7.5 缺陷 D-macOS 的修正；
// module-test-standards.md M11、M12 的 v0.7 補充）。
// 經符號連結執行時，process.argv[1] 是連結路徑、import.meta.url 是實際路徑；
// 修正前的判斷在此情況為 false，腳本不執行主程式並以 0 結束（靜默通過）。
// 本檔在 Linux 以暫存目錄中的符號連結重現該情況，不依賴 macOS。
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import {
  cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { unitTestFilesIssue } from '../../scripts/check-acceptance-ids.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPTS = [
  'build.mjs',
  'serve.mjs',
  'check-acceptance-ids.mjs',
  'check-acceptance-results.mjs',
  'check-pr-body.mjs',
  'review-gate.mjs',
];
const ENTRY_LINE =
  'if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {';

/** 子行程的環境：去除 node:test 注入的變數與 GitHub 相關變數，避免影響被測腳本。 */
function cleanEnv(extra = {}) {
  const env = { ...process.env };
  for (const k of Object.keys(env)) {
    if (k === 'NODE_TEST_CONTEXT' || k.startsWith('GITHUB_') || k === 'PR_NUMBER' || k === 'BUILD_SHA') delete env[k];
  }
  return { ...env, ...extra };
}

/** 以 node 執行某個腳本路徑；cwd 固定，讓兩次執行的相對路徑參數相同。 */
function run(scriptPath, args = [], { cwd = ROOT, env = cleanEnv() } = {}) {
  const r = spawnSync(process.execPath, [scriptPath, ...args], { cwd, env, encoding: 'utf8', timeout: 60_000 });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, out: r.stdout + r.stderr };
}

/** 在暫存目錄建立指向 target 的符號連結，回傳 { dir, link }。 */
function makeLink(target) {
  const dir = mkdtempSync(path.join(tmpdir(), 'entry-link-'));
  const link = path.join(dir, 'link');
  symlinkSync(target, link, 'dir');
  return { dir, link };
}

/** 經實際路徑與經符號連結各執行一次，斷言結束碼相同且不為 0、輸出相同且含 expected。 */
function assertSameFailure(realRoot, script, args, expected, opts = {}) {
  const { dir, link } = makeLink(realRoot);
  try {
    const viaReal = run(path.join(realRoot, 'scripts', script), args, opts);
    const viaLink = run(path.join(link, 'scripts', script), args, opts);
    assert.notEqual(viaReal.status, 0, `${script} 經實際路徑應失敗；${viaReal.out}`);
    assert.match(viaReal.out, expected, `${script} 經實際路徑的輸出`);
    assert.equal(viaLink.status, viaReal.status, `${script} 經符號連結的結束碼應與實際路徑相同；連結：${viaLink.out}`);
    assert.equal(viaLink.stdout, viaReal.stdout, `${script} 經符號連結的標準輸出應相同`);
    assert.equal(viaLink.stderr, viaReal.stderr, `${script} 經符號連結的標準錯誤應相同`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** 列出目錄下所有檔案的相對路徑（排序）。 */
function listFiles(dir, base = dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFiles(p, base));
    else out.push(path.relative(base, p));
  }
  return out.sort();
}

describe('直接執行判斷：6 支腳本一致（靜態）', () => {
  for (const script of SCRIPTS) {
    test(`${script}：進入點判斷恰為規定的一行，自 node:fs 匯入 realpathSync，不含舊判斷，判斷處沒有 try`, () => {
      const src = readFileSync(path.join(ROOT, 'scripts', script), 'utf8');
      const lines = src.split('\n');
      const idx = lines.findIndex((l) => l === ENTRY_LINE);
      assert.ok(idx >= 0, '應含規定的進入點判斷那一行（行首無縮排、逐字相同）');
      assert.equal(lines.filter((l) => l === ENTRY_LINE).length, 1, '只能有一行');
      assert.doesNotMatch(src, /path\.resolve\(process\.argv\[1\]\)/);
      assert.doesNotMatch(src, /import\.meta\.main/);
      // realpathSync 自 node:fs 匯入（具名），且只用在進入點判斷
      assert.match(src, /^import \{[^}]*\brealpathSync\b[^}]*\} from 'node:fs';$/m);
      const uses = lines.filter((l) => /realpathSync/.test(l) && !/^import /.test(l));
      assert.deepEqual(uses, [ENTRY_LINE]);
      // 進入點判斷不在 try 之內，判斷以後的程式也沒有 try（不吞掉 realpathSync 的例外）
      const before = lines.slice(Math.max(0, idx - 3), idx).join('\n');
      assert.doesNotMatch(before, /\btry\b/);
      assert.doesNotMatch(lines.slice(idx).join('\n'), /\btry\b/);
      assert.equal(lines[idx].search(/\S/), 0, '進入點判斷在模組最上層');
    });
  }

  test('scripts/ 下沒有其他以 process.argv[1] 判斷直接執行的腳本（6 支以外）', () => {
    const others = readdirSync(path.join(ROOT, 'scripts'))
      .filter((f) => f.endsWith('.mjs') && !SCRIPTS.includes(f))
      .filter((f) => /process\.argv\[1\]/.test(readFileSync(path.join(ROOT, 'scripts', f), 'utf8')));
    assert.deepEqual(others, []);
  });
});

describe('經符號連結執行：與經實際路徑結果相同', () => {
  test('build.mjs：經符號連結執行時產生與實際路徑相同的 dist/ 檔案清單與 version.js', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'entry-build-'));
    try {
      const real = path.join(dir, 'real');
      mkdirSync(real);
      for (const f of ['package.json', 'src', 'scripts']) cpSync(path.join(ROOT, f), path.join(real, f), { recursive: true });
      const link = path.join(dir, 'link');
      symlinkSync(real, link, 'dir');
      const env = cleanEnv({ BUILD_SHA: '0123456789abcdef0123456789abcdef01234567' });

      const viaReal = run(path.join(real, 'scripts/build.mjs'), [], { cwd: dir, env });
      assert.equal(viaReal.status, 0, viaReal.out);
      const filesReal = listFiles(path.join(real, 'dist'));
      const versionReal = readFileSync(path.join(real, 'dist/js/version.js'), 'utf8');
      assert.ok(filesReal.length > 0);
      assert.equal(versionReal, "export const APP_VERSION = '" + JSON.parse(readFileSync(path.join(real, 'package.json'), 'utf8')).version + "+0123456';\n");
      rmSync(path.join(real, 'dist'), { recursive: true, force: true });

      const viaLink = run(path.join(link, 'scripts/build.mjs'), [], { cwd: dir, env });
      assert.equal(viaLink.status, 0, viaLink.out);
      assert.equal(viaLink.stdout, viaReal.stdout);
      assert.deepEqual(listFiles(path.join(real, 'dist')), filesReal, '經符號連結應產生 dist/（修正前不產生）');
      assert.equal(readFileSync(path.join(real, 'dist/js/version.js'), 'utf8'), versionReal);

      // 符號連結只指向 scripts/ 時也執行建置（輸出到連結所指的實際版本庫）
      rmSync(path.join(real, 'dist'), { recursive: true, force: true });
      const scriptsLink = path.join(dir, 'scripts-link');
      symlinkSync(path.join(real, 'scripts'), scriptsLink, 'dir');
      const viaScriptsLink = run(path.join(scriptsLink, 'build.mjs'), [], { cwd: dir, env });
      assert.equal(viaScriptsLink.status, 0, viaScriptsLink.out);
      assert.deepEqual(listFiles(path.join(real, 'dist')), filesReal);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('serve.mjs：缺少目錄參數時，經符號連結與實際路徑都以相同的非 0 結束碼與用法訊息結束', () => {
    assertSameFailure(ROOT, 'serve.mjs', [], /用法：node scripts\/serve\.mjs/);
  });

  test('serve.mjs：經符號連結執行時啟動伺服器（修正前不啟動、立即以 0 結束）', async () => {
    const { dir, link } = makeLink(ROOT);
    const child = spawn(process.execPath, [path.join(link, 'scripts/serve.mjs'), path.join(ROOT, 'src'), '0'], {
      cwd: ROOT, env: cleanEnv(), stdio: ['ignore', 'pipe', 'pipe'],
    });
    try {
      const line = await new Promise((resolve, reject) => {
        let buf = '';
        const timer = setTimeout(() => reject(new Error(`逾時；輸出：${buf}`)), 10_000);
        child.stdout.on('data', (d) => {
          buf += d;
          if (buf.includes('\n')) { clearTimeout(timer); resolve(buf); }
        });
        child.on('exit', (code) => { clearTimeout(timer); reject(new Error(`伺服器提早結束（${code}）；輸出：${buf}`)); });
      });
      assert.match(line, /^serve: http:\/\/127\.0\.0\.1:\d+\/ → /);
    } finally {
      child.kill();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('check-acceptance-results.mjs：結果檔不存在時，經符號連結與實際路徑結果相同且不為 0', () => {
    assertSameFailure(ROOT, 'check-acceptance-results.mjs', ['--layer', 'unit', 'no-such-dir/no-such-results.jsonl'],
      /^acceptance-results：/m);
  });

  test('check-pr-body.mjs：未填寫的 PR 範本，經符號連結與實際路徑結果相同且不為 0', () => {
    assertSameFailure(ROOT, 'check-pr-body.mjs', ['--body-file', '.github/pull_request_template.md'], /^pr-body 錯誤：/m);
  });

  test('review-gate.mjs：沒有 GITHUB_TOKEN 時，經符號連結與實際路徑結果相同且不為 0', () => {
    assertSameFailure(ROOT, 'review-gate.mjs', [], /^review-gate：缺少 GITHUB_TOKEN/m,
      { env: cleanEnv({ GITHUB_REPOSITORY: 'example/repo', PR_NUMBER: '1' }) });
  });

  /** check-acceptance-ids 的暫存版本庫複本：需求、補充驗收、檢查腳本、驗收測試與輔助模組；tests/unit/ 依參數。 */
  function makeIdsRepo(unitFiles) {
    const dir = mkdtempSync(path.join(tmpdir(), 'entry-ids-'));
    const real = path.join(dir, 'real');
    mkdirSync(path.join(real, 'docs/design'), { recursive: true });
    mkdirSync(path.join(real, 'scripts'), { recursive: true });
    mkdirSync(path.join(real, 'tests/unit'), { recursive: true });
    cpSync(path.join(ROOT, 'docs/requirements.md'), path.join(real, 'docs/requirements.md'));
    cpSync(path.join(ROOT, 'docs/design/supplementary-acceptance.json'), path.join(real, 'docs/design/supplementary-acceptance.json'));
    cpSync(path.join(ROOT, 'scripts/check-acceptance-ids.mjs'), path.join(real, 'scripts/check-acceptance-ids.mjs'));
    cpSync(path.join(ROOT, 'tests/acceptance'), path.join(real, 'tests/acceptance'), { recursive: true });
    cpSync(path.join(ROOT, 'tests/support'), path.join(real, 'tests/support'), { recursive: true });
    for (const [rel, content] of Object.entries(unitFiles)) writeFileSync(path.join(real, 'tests/unit', rel), content);
    return { dir, real };
  }

  test('check-acceptance-ids.mjs：tests/unit/ 為空的複本，經符號連結與實際路徑結果相同且不為 0', () => {
    const { dir, real } = makeIdsRepo({ 'README.txt': '不是測試檔\n', 'x.spec.mjs': '' });
    try {
      assertSameFailure(real, 'check-acceptance-ids.mjs', [], /^acceptance-ids：tests\/unit\/ 下沒有任何模組單元測試檔$/m,
        { cwd: dir });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('check-acceptance-ids.mjs：tests/unit/ 有 1 個測試檔的複本不因此失敗', () => {
    const { dir, real } = makeIdsRepo({ 'a.test.mjs': "import { test } from 'node:test';\ntest('模組行為', () => {});\n" });
    try {
      const r = run(path.join(real, 'scripts/check-acceptance-ids.mjs'), [], { cwd: dir });
      assert.equal(r.status, 0, r.out);
      assert.doesNotMatch(r.out, /沒有任何模組單元測試檔/);
      assert.match(r.stdout, /^acceptance-ids：通過$/m);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('check-acceptance-ids.mjs：以版本庫本身經符號連結執行，結束碼 0 且輸出含「acceptance-ids：通過」', () => {
    const { dir, link } = makeLink(ROOT);
    try {
      const viaLink = run(path.join(link, 'scripts/check-acceptance-ids.mjs'));
      assert.equal(viaLink.status, 0, viaLink.out);
      assert.match(viaLink.stdout, /^acceptance-ids：通過$/m);
      const viaReal = run(path.join(ROOT, 'scripts/check-acceptance-ids.mjs'));
      assert.equal(viaLink.stdout, viaReal.stdout);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('unitTestFilesIssue（tests/unit/ 沒有模組單元測試檔時失敗）', () => {
  test('0 個檔案時回傳訊息；1 個以上時為 null', () => {
    assert.equal(unitTestFilesIssue([]), 'tests/unit/ 下沒有任何模組單元測試檔');
    assert.equal(unitTestFilesIssue(['tests/unit/a.test.mjs']), null);
    assert.equal(unitTestFilesIssue(['tests/unit/a.test.mjs', 'tests/unit/b/c.test.mjs']), null);
  });

  test('testsDir 參數反映在訊息中', () => {
    assert.equal(unitTestFilesIssue([], 'fixtures/tests'), 'fixtures/tests/unit/ 下沒有任何模組單元測試檔');
  });
});
