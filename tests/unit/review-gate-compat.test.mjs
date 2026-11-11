// 模組單元測試：review-gate 新舊兩版的相容性（module-test-standards.md M12 v0.6.3；review-process.md 4.1「相容偵測」
// 「新舊兩版的關係」「差分測試」「相容偵測引入的案例」）。測試名稱與資料不含真實驗收編號。
//
// 對照的舊版：tests/unit/fixtures/pr1b/ 下的 review-gate.mjs、check-pr-body.mjs，是 main fa05bbb（PR-1b 版）的
// 逐字複本，只供本測試匯入，不得修改。斷言「新版 success ⇒ PR-1b 版 success」沒有反例。
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluate as evaluateNew, CHECKLIST_IDS, MARKER } from '../../scripts/review-gate.mjs';
import { evaluate as evaluateOld } from './fixtures/pr1b/review-gate.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HEAD = 'c'.repeat(40);
const CRQ = 'CHANGES_REQUESTED';
const PR_BODY = ['## 作者', '- 角色：實作 agent', '- 工作階段：impl-1', '## 上工檢查'].join('\n');

/** 第 2 節格式的合法紀錄；extraFields 放在欄位清單中，afterTable 緊接 R-15 列，end 空一行後放在文末。 */
function record({ extraFields = [], afterTable = [], end = [] } = {}) {
  return [
    MARKER,
    '## 審查紀錄',
    '',
    '- 結果：APPROVED',
    `- 針對 commit：${HEAD}`,
    '- 審查者：審查 agent，工作階段 review-1',
    '- 獨立性：審查者與作者為同一模型（Claude）的不同工作階段',
    ...extraFields,
    '',
    '### 逐項結果',
    '',
    '| 編號 | 項目 | 結果 | 說明 |',
    '|---|---|---|---|',
    ...CHECKLIST_IDS.map((id) => `| ${id} | 項目 | 通過 | |`),
    ...afterTable,
    '',
    '### 發現的問題',
    '',
    '1. 無。',
    ...(end.length ? ['', ...end] : []),
  ].join('\n');
}

const judge = (evaluate, body, prBody = PR_BODY) =>
  evaluate({ headSha: HEAD, prBody, prUrl: 'pr', comments: [{ body, author_association: 'OWNER', created_at: '2026-11-11T00:00:00Z', html_url: 'c' }] });

// ───────────── 差分測試的案例生成（4.1「差分測試」的方法） ─────────────

/** 語法字元：NFKC 後成為這些字元之一或 ASCII 英數的碼位，是替換的來源。 */
const SYNTAX = new Set([...'<>/|:-![]()\\*_~#="\'.+`', ' ', '\t']);
const isTarget = (n) => n.length === 1 && (SYNTAX.has(n) || /[A-Za-z0-9]/.test(n));

/** 全部 Unicode 碼位中 NFKC 會改變、且結果為單一語法字元或 ASCII 英數者；以 String.prototype.normalize 計算，不寫死。 */
function nfkcEquivalents() {
  const byTarget = new Map();
  for (let cp = 0; cp <= 0x10ffff; cp++) {
    if (cp >= 0xd800 && cp <= 0xdfff) continue;
    const s = String.fromCodePoint(cp);
    const n = s.normalize('NFKC');
    if (n === s || !isTarget(n)) continue;
    if (!byTarget.has(n)) byTarget.set(n, []);
    byTarget.get(n).push(s);
  }
  return byTarget;
}

/** 攻擊寫法（加入合法紀錄的一行）：欄位行、表格列、標籤、引號中的 `>`、連結、跳脫、核取方塊、強調等。 */
const ATTACKS = [
  `- <b !>結果：${CRQ}`,
  `- </b x>結果：${CRQ}`,
  `- <br/ >針對 commit：${HEAD}`,
  `- <b !>審查者：審查 agent，工作階段 review-2`,
  `- <x y=">結果：${CRQ}">`,
  `<x y=">| R-5 | 項目 | 不通過 | x |">`,
  '<b !>| R-5 | 項目 | 不通過 | x |',
  `- 結果：${CRQ}`,
  `> - 結果：${CRQ}`,
  `1. 結果：${CRQ}`,
  `+ 結果：${CRQ}`,
  `# 結果：${CRQ}`,
  `\\- 結果：${CRQ}`,
  `- [ ] 結果：${CRQ}`,
  `**結果**：${CRQ}`,
  `~~結果~~：${CRQ}`,
  `\`結果\`：${CRQ}`,
  `<b>結果</b>：${CRQ}`,
  `[結果](#)：${CRQ}`,
  `<!-- - 結果：${CRQ} -->`,
  '| R-5 | 項目 | 不通過 | x |',
  '- | R-5 | 項目 | 不通過 | |',
  '<table><tr><td>R-5</td><td>不通過</td></tr></table>',
  '--- | ---',
];
const POSITIONS = {
  fields: (line) => record({ extraFields: [line] }),
  afterTable: (line) => record({ afterTable: [line] }),
  end: (line) => record({ end: [line] }),
};

/** 把 line 中的字元 target 換成 sub：全部、只換第一個、只換最後一個。 */
function substitutions(line, target, sub) {
  const first = line.indexOf(target);
  if (first < 0) return [];
  const last = line.lastIndexOf(target);
  const out = new Set([line.split(target).join(sub), line.slice(0, first) + sub + line.slice(first + 1), line.slice(0, last) + sub + line.slice(last + 1)]);
  return [...out];
}

/** 以 build(line) 產生全部案例，回傳「新版 success、舊版 failure」的反例與總數。 */
function differential(lines, build, { prBodyOf = () => PR_BODY } = {}) {
  const eq = nfkcEquivalents();
  const counterexamples = [];
  let total = 0;
  for (const base of lines) {
    for (const [target, subs] of eq) {
      if (!base.includes(target)) continue;
      for (const sub of subs) {
        for (const variant of substitutions(base, target, sub)) {
          for (const body of build(variant)) {
            total++;
            const prBody = prBodyOf(variant);
            const recordBody = typeof body === 'string' ? body : body.record;
            const authors = typeof body === 'string' ? prBody : body.prBody;
            if (judge(evaluateNew, recordBody, authors).state === 'success' && judge(evaluateOld, recordBody, authors).state !== 'success') {
              counterexamples.push(variant);
            }
          }
        }
      }
    }
  }
  return { total, counterexamples };
}

describe('相容性：新版 success ⇒ PR-1b 版（fa05bbb）success', () => {
  test('碼位清單以 normalize 計算：涵蓋全形與小型小於號、全形、上標、圈號、數學字母', () => {
    const eq = nfkcEquivalents();
    for (const [target, sub] of [['<', '＜'], ['<', '﹤'], ['>', '＞'], ['b', 'ｂ'], ['b', 'ᵇ'], ['b', 'ⓑ'], ['b', '𝐛'], ['-', '－'], ['|', '｜']]) {
      assert.ok(eq.get(target)?.includes(sub), `${target} ← ${sub}`);
    }
    const count = [...eq.values()].reduce((n, a) => n + a.length, 0);
    assert.ok(count > 1000, `碼位數 ${count}`);
  });

  test('紀錄：攻擊寫法 × NFKC 等價字元替換（全部、第一個、最後一個）× 欄位中、表後、文末，沒有反例', () => {
    const { total, counterexamples } = differential(ATTACKS, (line) => Object.values(POSITIONS).map((at) => at(line)));
    assert.ok(total > 10000, `案例數 ${total}`);
    assert.deepEqual(counterexamples.slice(0, 20), [], `反例 ${counterexamples.length} 例（共 ${total} 例）`);
  });

  test('作者段落：把審查者識別寫成作者的寫法 × 同樣的替換，沒有反例', () => {
    const AUTHOR_LINES = [
      '- 工作階段: review-1',
      '- <b !>工作階段：review-1',
      '> 工作階段：review-1',
      '**工作階段**：review-1',
      '- <x y=">工作階段：review-1">',
    ];
    const { total, counterexamples } = differential(AUTHOR_LINES, (line) => [{
      record: record(),
      prBody: ['## 作者', '- 角色：實作 agent', '- 工作階段：impl-1', line, '## 上工檢查'].join('\n'),
    }]);
    assert.ok(total > 100, `案例數 ${total}`);
    assert.deepEqual(counterexamples.slice(0, 20), [], `反例 ${counterexamples.length} 例（共 ${total} 例）`);
  });

  test('對照：合法紀錄在兩版都是 success（差分測試不是因為全部判為無效而通過）', () => {
    assert.equal(judge(evaluateNew, record()).state, 'success');
    assert.equal(judge(evaluateOld, record()).state, 'success');
  });
});

describe('相容偵測引入的案例 N1～N12（4.1 表；文末）', () => {
  const DUP_RESULT = /^欄位重複或格式不符：結果$/;
  const CASES = [
    ['N1', record({ end: [`- <ｂ !>結果：${CRQ}`] }), DUP_RESULT],
    ['N2', record({ end: [`- ＜b !＞結果：${CRQ}`] }), DUP_RESULT],
    ['N3', record({ end: [`- ﹤b !﹥結果：${CRQ}`] }), DUP_RESULT],
    ['N4', record({ end: [`- </ｂ x>結果：${CRQ}`] }), DUP_RESULT],
    ['N5', record({ end: [`- <ｂｒ/ >針對 commit：${HEAD}`] }), /^欄位重複或格式不符：針對 commit$/],
    ['N6', record({ end: ['＜b !＞| R-5 | 項目 | 不通過 | x |'] }), /^表格格式不符：第 \d+ 行$/],
    ['N7', record({ end: [`- <ᵇ !>結果：${CRQ}`] }), DUP_RESULT],
    ['N8', record({ end: [`- <ⓑ !>結果：${CRQ}`] }), DUP_RESULT],
    ['N9', record({ end: [`- <𝐛 !>結果：${CRQ}`] }), DUP_RESULT],
    ['N10', record({ end: [`- <x y=">結果：${CRQ}">`] }), DUP_RESULT],
    ['N11', record({ end: ['<x y=">| R-5 | 項目 | 不通過 | x |">'] }), /^表格格式不符：第 \d+ 行$/],
    ['N12', record({ end: [`－ <x y=">結果：${CRQ}">`] }), DUP_RESULT],
  ];
  for (const [id, body, reason] of CASES) {
    test(`${id}：PR-1b 版與新版都判定無效，新版原因符合 4.1 表`, () => {
      const n = judge(evaluateNew, body);
      assert.equal(n.state, 'failure', id);
      assert.match(n.description, reason, `${id}：${n.description}`);
      assert.equal(judge(evaluateOld, body).state, 'failure', `${id}（PR-1b 版）`);
    });
  }
});

describe('對照固定資料的完整性', () => {
  test('tests/unit/fixtures/pr1b/ 的兩個檔案是 PR-1b 版：review-gate 依 DQ-13 (b)（F1～F8），作者段落不做 4.1 的檢查', () => {
    const rg = readFileSync(path.join(HERE, 'fixtures/pr1b/review-gate.mjs'), 'utf8');
    assert.match(rg, /^\/\/ EQ-11 審查紀錄判定（spec\.md 第 13 節、review-process\.md 第 2、4 節 v0\.5\.1；偵測形式依 DQ-13 \(b\)）/);
    assert.match(rg, /from '\.\/check-pr-body\.mjs'/);
    const pb = readFileSync(path.join(HERE, 'fixtures/pr1b/check-pr-body.mjs'), 'utf8');
    assert.doesNotMatch(pb, /validateAuthorSection/);
  });
});
