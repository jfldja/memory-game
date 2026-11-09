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
    assert.match(t, /name: unit\n/);
    assert.match(t, /name: acceptance-ids\n/);
    assert.match(t, /name: e2e \(\$\{\{ matrix\.browser \}\}\)/);
    assert.match(t, /browser: \[chromium, firefox, webkit\]/);
    assert.match(t, /node --test 'tests\/unit\/\*\*\/\*\.test\.mjs' 'tests\/acceptance\/unit\/\*\*\/\*\.test\.mjs'/);
    assert.match(t, /node scripts\/check-acceptance-ids\.mjs/);
    assert.match(t, /BUILD_SHA: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/);
    assert.match(t, /--project="\$BROWSER-realtime" --workers=1/);
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
