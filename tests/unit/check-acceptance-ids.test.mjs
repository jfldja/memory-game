// 模組單元測試：scripts/check-acceptance-ids.mjs（module-test-standards.md M12）。
// 注意：本檔的測試名稱與測試資料一律使用虛構編號（AC-ZZ-…、NFR-9x），
// 不使用需求文件中的真實驗收編號，以免編號覆蓋檢查誤把本檔當成驗收測試。
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  parseRequiredIds,
  parseSupplementaryIds,
  extractTests,
  containsId,
  checkCoverage,
  listTestFiles,
  runCheck,
  tokenize,
  analyzeSource,
  findForbiddenSkips,
  findDuplicateNames,
  checkAssertImports,
  acceptanceLayer,
  hasAssertionCall,
  findTemplateNameIssues,
  findSubtestsAndConcurrency,
  templatePrefix,
} from '../../scripts/check-acceptance-ids.mjs';

const REQ_FIXTURE = [
  '# 需求',
  '## 10. 驗收標準',
  '### 10.1 驗證方式標示',
  '**AC-ZZ-99**（自動）在 10.1，不採計',
  '### 10.2 功能驗收',
  '**AC-ZZ-1**（自動）',
  '- Given …',
  '**AC-ZZ-2、AC-ZZ-3、AC-ZZ-4**（自動＋人工）',
  '**AC-ZZ-5**（人工）',
  '**AC-ZZ-10**（自動）',
  '一般文字提到 **AC-ZZ-6** 但不在行首（自動）',
  '### 10.3 UAT 清單',
  '**AC-ZZ-7**（自動）在 10.3，不採計',
  '## 13. 需求追溯矩陣',
  '',
  '| 需求 | 優先 | 驗收 | 驗證 | 里程碑 |',
  '|---|---|---|---|---|',
  '| ZZ-1 | M | AC-ZZ-1 | 自動 | M3 |',
  '| NFR-1 | M | 量測方法 | 自動 | M3 |',
  '| NFR-91 | M | 量測方法 | 自動 | M3 |',
  '| NFR-92 | S | 量測方法 | 自動 | M3 |',
  '| NFR-93 | M | 量測方法 | 人工 | M3 |',
  '| NFR-94 | M | 量測方法 | 自動 | M3 |',
  '## 14. 變更紀錄',
  '| NFR-95 | M | 量測方法 | 自動 | M3 |',
].join('\n');

describe('parseRequiredIds：需求文件解析', () => {
  test('只採計 10.2 節行首、驗證含「自動」的標題；一個標題可含多個編號', () => {
    const r = parseRequiredIds(REQ_FIXTURE);
    assert.deepEqual(r.acceptanceIds, ['AC-ZZ-1', 'AC-ZZ-2', 'AC-ZZ-3', 'AC-ZZ-4', 'AC-ZZ-10']);
  });

  test('只採計第 13 節優先為 M、驗證為自動的 NFR，排除 NFR-1', () => {
    const r = parseRequiredIds(REQ_FIXTURE);
    assert.deepEqual(r.nfrIds, ['NFR-91', 'NFR-94']);
  });

  test('找不到 10.2 節或第 13 節時丟出錯誤，不得視為零個編號而通過', () => {
    assert.throws(() => parseRequiredIds('## 13. 需求追溯矩陣\n| 需求 | 優先 | 驗收 | 驗證 |'), /10\.2/);
    assert.throws(() => parseRequiredIds('### 10.2 功能驗收\n**AC-ZZ-1**（自動）'), /13/);
  });

  test('10.2 節沒有任何自動驗收時丟出錯誤', () => {
    const text = '### 10.2 功能驗收\n**AC-ZZ-1**（人工）\n## 13. 矩陣\n| 需求 | 優先 | 驗收 | 驗證 |\n|---|---|---|---|';
    assert.throws(() => parseRequiredIds(text), /沒有解析到/);
  });

  test('可處理 CRLF 換行', () => {
    const r = parseRequiredIds(REQ_FIXTURE.replace(/\n/g, '\r\n'));
    assert.equal(r.acceptanceIds.length, 5);
    assert.deepEqual(r.nfrIds, ['NFR-91', 'NFR-94']);
  });
});

describe('parseSupplementaryIds：補充驗收', () => {
  test('只取 enforced 為 true 的項目', () => {
    const json = JSON.stringify({
      items: [
        { id: 'AC-ZZ-50', enforced: true },
        { id: 'AC-ZZ-51', enforced: false },
        { id: 'AC-ZZ-52', enforced: 'true' },
        { id: 'AC-ZZ-53' },
      ],
    });
    assert.deepEqual(parseSupplementaryIds(json), ['AC-ZZ-50']);
  });

  test('格式錯誤時丟出錯誤', () => {
    assert.throws(() => parseSupplementaryIds('{}'), /items/);
    assert.throws(() => parseSupplementaryIds('not json'));
    assert.throws(() => parseSupplementaryIds(JSON.stringify({ items: [{ enforced: true }] })), /id/);
  });
});

describe('containsId：完整編號比對', () => {
  test('AC-ZZ-1 不被 AC-ZZ-10 誤判，反之亦然', () => {
    assert.equal(containsId('AC-ZZ-10 說明', 'AC-ZZ-1'), false);
    assert.equal(containsId('AC-ZZ-1 說明', 'AC-ZZ-10'), false);
    assert.equal(containsId('AC-ZZ-10 說明', 'AC-ZZ-10'), true);
  });

  test('編號前後接中文、空白、標點時都算；前面接英數字或連字號時不算', () => {
    assert.equal(containsId('AC-ZZ-1翻牌', 'AC-ZZ-1'), true);
    assert.equal(containsId('前綴 AC-ZZ-1：說明', 'AC-ZZ-1'), true);
    assert.equal(containsId('（AC-ZZ-1）', 'AC-ZZ-1'), true);
    assert.equal(containsId('XAC-ZZ-1', 'AC-ZZ-1'), false);
    assert.equal(containsId('B-AC-ZZ-1', 'AC-ZZ-1'), false);
    assert.equal(containsId('AC-ZZ-1a', 'AC-ZZ-1'), false);
  });

  test('NFR 編號同樣以完整編號比對', () => {
    assert.equal(containsId('NFR-95 選單', 'NFR-9'), false);
    assert.equal(containsId('NFR-9 選單', 'NFR-9'), true);
  });
});

describe('tokenize', () => {
  test('註解被丟棄；字串、樣板、正規表示式各為單一 token', () => {
    const toks = tokenize("// a\n/* b */ x = 'c' + `d${e}f` + /g\\/h/i;");
    assert.deepEqual(
      toks.map((t) => [t.type, t.value]),
      [
        ['ident', 'x'], ['punct', '='], ['string', 'c'], ['punct', '+'],
        ['template', 'd${e}f'], ['punct', '+'], ['regex', '/g\\/h/i'], ['punct', ';'],
      ],
    );
  });

  test('除號不被誤認為正規表示式', () => {
    const toks = tokenize('a = b / c / d;');
    assert.ok(toks.every((t) => t.type !== 'regex'));
  });
});

describe('extractTests：收集名稱', () => {
  test('採計 test、it、describe、test.describe 及 .only', () => {
    const src = `
      test('AC-ZZ-1 a', () => {});
      it("AC-ZZ-2 b", () => {});
      describe(\`AC-ZZ-3 c\`, () => {});
      test.describe('AC-ZZ-4 d', () => {});
      test.only('AC-ZZ-5 e', () => {});
      test.describe.only('AC-ZZ-6 f', () => {});
    `;
    const names = extractTests(src).map((t) => [t.name, t.skipped]);
    assert.deepEqual(names, [
      ['AC-ZZ-1 a', false], ['AC-ZZ-2 b', false], ['AC-ZZ-3 c', false],
      ['AC-ZZ-4 d', false], ['AC-ZZ-5 e', false], ['AC-ZZ-6 f', false],
    ]);
  });

  test('編號只在註解中出現不算', () => {
    const src = `
      // test('AC-ZZ-1 註解中的呼叫', () => {});
      /* test('AC-ZZ-2 區塊註解', () => {}); */
      test('一般測試', () => {}); // AC-ZZ-3
    `;
    assert.deepEqual(extractTests(src).map((t) => t.name), ['一般測試']);
  });

  test('字串或樣板字面值內的 test( 呼叫不算（測試資料）', () => {
    const src = [
      "const fixture = \"test('AC-ZZ-1 x', () => {})\";",
      'const fixture2 = `',
      "  test('AC-ZZ-2 y', () => {});",
      '  ${"test(\'AC-ZZ-3 z\')"}',
      '`;',
      "test('外層', () => {});",
    ].join('\n');
    assert.deepEqual(extractTests(src).map((t) => t.name), ['外層']);
  });

  test('前面接「.」的呼叫不算（例如正規表示式的 .test、子測試 t.test）', () => {
    const src = `
      /AC-ZZ-1/.test('AC-ZZ-1');
      re.test('AC-ZZ-2');
      t.test('AC-ZZ-3', () => {});
      test('正常', () => {});
    `;
    assert.deepEqual(extractTests(src).map((t) => t.name), ['正常']);
  });

  test('名稱不是單一字面值時不採計', () => {
    const src = `
      test('AC-ZZ-' + n, () => {});
      test(name, () => {});
      test.step('AC-ZZ-4 step', () => {});
      test.describe.configure({ mode: 'serial' });
    `;
    assert.deepEqual(extractTests(src), []);
  });

  test('記錄行號與種類', () => {
    const src = "\n\ndescribe('區塊', () => {\n  it('項目', () => {});\n});";
    assert.deepEqual(extractTests(src), [
      { name: '區塊', kind: 'describe', skipped: false, line: 3, literal: 'string', skeleton: false, path: [], hasAssertion: false },
      { name: '項目', kind: 'test', skipped: false, line: 4, literal: 'string', skeleton: false, path: ['區塊'], hasAssertion: false },
    ]);
  });
});

describe('extractTests：略過的判定（spec.md 12.2 第 5 點的全部寫法）', () => {
  const cases = [
    ["test.skip('N', () => {})", 'test.skip'],
    ["test.fixme('N', () => {})", 'test.fixme'],
    ["test.todo('N')", 'test.todo'],
    ["test.describe.skip('N', () => {})", 'test.describe.skip'],
    ["test.describe.fixme('N', () => {})", 'test.describe.fixme'],
    ["describe.skip('N', () => {})", 'describe.skip'],
    ["it.skip('N', () => {})", 'it.skip'],
    ["it.todo('N')", 'it.todo'],
    ["test('N', { skip: true }, () => {})", '選項 { skip: true }'],
    ["test('N', { skip: '理由' }, () => {})", '選項 { skip: 字串 }'],
    ["test('N', { todo: true }, () => {})", '選項 { todo }'],
    ["test('N', { timeout: 5, skip }, () => {})", '選項簡寫 { skip }'],
    ["describe('N', { skip: true }, () => {})", 'describe 選項 { skip }'],
    ["it('N', { 'todo': 1 }, () => {})", '選項以字串為鍵'],
  ];
  for (const [src, label] of cases) {
    test(`${label} 計為略過`, () => {
      const tests = extractTests(src);
      assert.equal(tests.length, 1);
      assert.equal(tests[0].skipped, true);
    });
  }

  test('位於略過的 describe 區塊內的測試（含巢狀）計為略過', () => {
    const src = `
      test.describe.skip('外', () => {
        test('內一', () => {});
        test.describe('內層區塊', () => {
          test('內二', () => {});
        });
      });
      describe('未略過', { skip: true }, () => { it('內三', () => {}); });
      describe.skip('另一個', () => { it('內四', () => {}); });
      test.describe.fixme('fixme 區塊', () => { test('內五', () => {}); });
      test('外面', () => {});
    `;
    const m = Object.fromEntries(extractTests(src).map((t) => [t.name, t.skipped]));
    assert.deepEqual(m, {
      外: true, 內一: true, 內層區塊: true, 內二: true,
      未略過: true, 內三: true, 另一個: true, 內四: true,
      'fixme 區塊': true, 內五: true, 外面: false,
    });
  });

  test('一般區塊內的測試與區塊之後的測試不受前一個略過區塊影響', () => {
    const src = `
      describe.skip('A', () => {});
      describe('B', () => { test('b1', () => {}); });
      test('c', () => {});
    `;
    const m = Object.fromEntries(extractTests(src).map((t) => [t.name, t.skipped]));
    assert.deepEqual(m, { A: true, B: false, b1: false, c: false });
  });

  test('選項物件內較深層的 skip 鍵不算；其他選項不算略過', () => {
    const src = `
      test('深層', { meta: { skip: true } }, () => {});
      test('逾時', { timeout: 1000 }, () => {});
      test('only', { only: true }, () => {});
    `;
    assert.ok(extractTests(src).every((t) => t.skipped === false));
  });
});

describe('checkCoverage', () => {
  const tests = [
    { name: 'AC-ZZ-1 a', skipped: false },
    { name: 'AC-ZZ-10 b', skipped: true },
    { name: '其他', skipped: true },
  ];

  test('列出缺少的編號；AC-ZZ-10 的測試不涵蓋 AC-ZZ-1 以外的編號', () => {
    const r = checkCoverage({ requiredIds: ['AC-ZZ-1', 'AC-ZZ-10', 'AC-ZZ-2'], tests });
    assert.deepEqual(r.missing, ['AC-ZZ-2']);
    assert.equal(r.ok, false);
  });

  test('略過的測試可滿足編號覆蓋；略過數分別統計', () => {
    const r = checkCoverage({ requiredIds: ['AC-ZZ-1', 'AC-ZZ-10'], tests });
    assert.equal(r.ok, true);
    assert.equal(r.skippedWithIds.length, 1);
    assert.equal(r.skippedTotal, 2);
  });

  test('--no-skip 時有任何略過即失敗', () => {
    const r = checkCoverage({ requiredIds: ['AC-ZZ-1', 'AC-ZZ-10'], tests, noSkip: true });
    assert.equal(r.ok, false);
    const r2 = checkCoverage({
      requiredIds: ['AC-ZZ-1'],
      tests: [{ name: 'AC-ZZ-1', skipped: false }],
      noSkip: true,
    });
    assert.equal(r2.ok, true);
  });

  test('刪除某編號唯一的測試後檢查失敗（反例）', () => {
    const before = checkCoverage({ requiredIds: ['AC-ZZ-5'], tests: [{ name: 'AC-ZZ-5 x', skipped: false }] });
    const after = checkCoverage({ requiredIds: ['AC-ZZ-5'], tests: [] });
    assert.equal(before.ok, true);
    assert.equal(after.ok, false);
    assert.deepEqual(after.missing, ['AC-ZZ-5']);
  });
});

describe('listTestFiles 與 runCheck：對暫存版本庫執行', () => {
  function makeRepo(files) {
    const root = mkdtempSync(path.join(tmpdir(), 'ids-'));
    for (const [rel, content] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      writeFileSync(path.join(root, rel), content);
    }
    return root;
  }

  test('只掃描 tests/ 下的 *.test.mjs、*.spec.mjs，略過 node_modules', () => {
    const root = makeRepo({
      'tests/unit/a.test.mjs': '',
      'tests/e2e/b.spec.mjs': '',
      'tests/e2e/c.mjs': '',
      'tests/x/d.test.js': '',
      'tests/node_modules/e.test.mjs': '',
    });
    try {
      assert.deepEqual(listTestFiles(path.join(root, 'tests')), [
        path.join('e2e', 'b.spec.mjs'),
        path.join('unit', 'a.test.mjs'),
      ]);
      assert.deepEqual(listTestFiles(path.join(root, 'no-such-dir')), []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('合併需求與補充驗收的編號，並回報缺漏與略過', () => {
    const root = makeRepo({
      'docs/requirements.md': REQ_FIXTURE,
      'docs/design/supplementary-acceptance.json': JSON.stringify({
        items: [{ id: 'AC-ZZ-60', enforced: true }, { id: 'AC-ZZ-61', enforced: false }],
      }),
      'tests/acceptance/unit/a.test.mjs':
        "test.skip('AC-ZZ-1', () => {}); test('AC-ZZ-2、AC-ZZ-3、AC-ZZ-4', () => {});",
      'tests/acceptance/e2e/b.spec.mjs':
        "test.describe.skip('區', () => { test('AC-ZZ-10', () => {}); test('NFR-91 x', () => {}); });",
    });
    try {
      const r = runCheck({ root });
      assert.equal(r.requiredIds.length, 8);
      assert.deepEqual(r.missing, ['NFR-94', 'AC-ZZ-60']);
      assert.equal(r.ok, false);
      assert.equal(r.skippedTotal, 4);
      assert.ok(r.tests.every((t) => t.file.startsWith('tests/acceptance/')));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

// ───────────────────── v0.5（spec.md 12.2 第 3～5、8、9a～9c、10 點） ─────────────────────

const E2E_HEAD = "import { test, expect } from '@playwright/test';\n";
const UNIT_HEAD = "import { test, describe } from 'node:test';\nimport { assert } from '../../support/assertions.mjs';\n";

/** 一個通過全部檢查的基準版本庫（必要編號：AC-ZZ-1、2、3、4、10、NFR-91、NFR-94、補充 AC-ZZ-60）。 */
const BASE_FILES = {
  'docs/requirements.md': REQ_FIXTURE,
  'docs/design/supplementary-acceptance.json': JSON.stringify({ items: [{ id: 'AC-ZZ-60', enforced: true }] }),
  'tests/support/assertions.mjs': 'export const assert = {};\n',
  'tests/acceptance/unit/base.test.mjs':
    UNIT_HEAD +
    "test('AC-ZZ-1 a', () => { assert.equal(1, 1); });\n" +
    "test.skip('AC-ZZ-2 b', () => {});\n",
  'tests/acceptance/e2e/base.spec.mjs':
    E2E_HEAD +
    "test('AC-ZZ-3 AC-ZZ-4 c', async ({ page }) => { await expect(page).toHaveTitle('x'); });\n" +
    "test.skip('AC-ZZ-10 d', async () => {});\n" +
    "test.describe('NFR-91 區', () => { test('e', async () => { expect(1).toBe(1); }); });\n" +
    "test.skip('NFR-94 f', async ({ page }) => {});\n" +
    "test.skip('AC-ZZ-60 g', async () => {\n  // 骨架本體的註解不是敘述\n});\n",
  'tests/unit/mod.test.mjs':
    "import { test } from 'node:test';\ntest('NFR-1 與 AC-ZZ-99 不是必要編號', () => {});\n",
};

function makeRepo(files) {
  const root = mkdtempSync(path.join(tmpdir(), 'ids-'));
  for (const [rel, content] of Object.entries(files)) {
    if (content === null) continue;
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    writeFileSync(path.join(root, rel), content);
  }
  return root;
}

/** 以基準版本庫加上（或以 null 移除）檔案執行 runCheck。 */
function check(extra = {}, opts = {}) {
  const root = makeRepo({ ...BASE_FILES, ...extra });
  try {
    return runCheck({ root, ...opts });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
const rulesOf = (r) => r.violations.map((v) => v.rule);

describe('runCheck v0.5：基準', () => {
  test('基準版本庫通過；骨架計為略過；--no-skip 時失敗', () => {
    const r = check();
    assert.deepEqual(r.violations, []);
    assert.deepEqual(r.missing, []);
    assert.equal(r.ok, true);
    assert.equal(r.skeletons.length, 4);
    assert.equal(r.skippedTotal, 4);
    assert.equal(check({}, { noSkip: true }).ok, false);
  });

  test('沒有任何會被執行的驗收測試檔時丟出錯誤（不得視為零個而通過）', () => {
    assert.throws(
      () => check({ 'tests/acceptance/unit/base.test.mjs': null, 'tests/acceptance/e2e/base.spec.mjs': null }),
      /沒有任何會被執行的驗收測試檔/,
    );
  });
});

describe('runCheck v0.5：第 3、5 點（只採計 tests/acceptance/；單元測試不得帶必要編號）', () => {
  test('編號只出現在 tests/unit/ 的測試名稱中：判為缺少，且回報單元測試帶編號', () => {
    const base = BASE_FILES['tests/acceptance/unit/base.test.mjs'].replace("test('AC-ZZ-1 a'", "test('其他 a'");
    const r = check({
      'tests/acceptance/unit/base.test.mjs': base,
      'tests/unit/fake.test.mjs': "test('AC-ZZ-1 冒充', () => {});\ndescribe('AC-ZZ-10 區塊', () => {});\n",
    });
    assert.equal(r.ok, false);
    assert.deepEqual(r.missing, ['AC-ZZ-1']);
    const v = r.violations.filter((x) => x.rule === '12.2 第 5 點');
    assert.deepEqual(v.map((x) => [x.file, x.line]), [['tests/unit/fake.test.mjs', 1], ['tests/unit/fake.test.mjs', 2]]);
    assert.ok(r.tests.every((t) => t.file.startsWith('tests/acceptance/')));
  });

  test('單元測試名稱含非必要編號（NFR-1、虛構編號）時不失敗', () => {
    assert.equal(check({ 'tests/unit/other.test.mjs': "test('NFR-1 R-15 T-5 AC-ZZ-100', () => {});" }).ok, true);
  });

  test('--no-skip 時 tests/unit/ 的略過仍失敗（v0.4 的略過清單）；沒有 --no-skip 時不失敗', () => {
    const extra = {
      'tests/unit/skip.test.mjs': "describe.skip('區', () => { test('內', () => {}); });",
      // 讓驗收測試本身沒有骨架，只剩單元測試的略過
      'tests/acceptance/unit/base.test.mjs': UNIT_HEAD + "test('AC-ZZ-1 AC-ZZ-2', () => { assert.ok(1); });\n",
      'tests/acceptance/e2e/base.spec.mjs': E2E_HEAD +
        "test('AC-ZZ-3 AC-ZZ-4 AC-ZZ-10 NFR-91 NFR-94 AC-ZZ-60', async () => { expect(1).toBe(1); });\n",
    };
    assert.equal(check(extra).ok, true);
    const r = check(extra, { noSkip: true });
    assert.equal(r.ok, false);
    assert.equal(r.unitSkipped.length, 2);
    assert.equal(r.skippedTotal, 0);
  });
});

describe('runCheck v0.5：第 4 點（驗收測試檔的位置與副檔名）', () => {
  for (const rel of [
    'tests/acceptance/x.test.mjs',
    'tests/acceptance/unit/x.spec.mjs',
    'tests/acceptance/e2e/x.test.mjs',
    'tests/acceptance/e2e/x.test.ts',
    'tests/acceptance/e2e/x.spec.js',
    'tests/acceptance/e2e/x.spec.cjs',
    'tests/acceptance/unit/x.test.js',
    'tests/acceptance/other/x.spec.mjs',
  ]) {
    test(`${rel} 判定失敗，其中的測試不採計覆蓋`, () => {
      const base = BASE_FILES['tests/acceptance/unit/base.test.mjs'].replace("test('AC-ZZ-1 a'", "test('其他 a'");
      const r = check({ 'tests/acceptance/unit/base.test.mjs': base, [rel]: "test('AC-ZZ-1 x', () => { assert.ok(1); });" });
      assert.equal(r.ok, false);
      assert.deepEqual(r.violations.map((v) => [v.file, v.rule]), [[rel, '12.2 第 4 點']]);
      assert.deepEqual(r.missing, ['AC-ZZ-1']);
    });
  }

  test('acceptanceLayer：只有 unit/**/*.test.mjs 與 e2e/**/*.spec.mjs', () => {
    assert.equal(acceptanceLayer('unit/a/b.test.mjs'), 'unit');
    assert.equal(acceptanceLayer('e2e/a/b.spec.mjs'), 'e2e');
    assert.equal(acceptanceLayer('unit/b.spec.mjs'), null);
    assert.equal(acceptanceLayer('e2e/b.test.mjs'), null);
    assert.equal(acceptanceLayer('b.test.mjs'), null);
  });

  test('非測試檔（輔助模組）不受位置規則約束', () => {
    assert.equal(check({ 'tests/acceptance/e2e/helper.mjs': 'export const x = 1;' }).ok, true);
  });
});

describe('runCheck v0.5：第 8 點（唯一允許的略過寫法是最上層的骨架宣告）', () => {
  const e2e = (body) => ({ 'tests/acceptance/e2e/v.spec.mjs': E2E_HEAD + body + '\n' });
  const unit = (body) => ({ 'tests/acceptance/unit/v.test.mjs': UNIT_HEAD + body + '\n' });
  const cases = [
    ['test.fixme(名稱, …)', e2e("test.fixme('X', async () => { expect(1).toBe(1); });")],
    ['test.fail(名稱, …)', e2e("test.fail('X', async () => { expect(1).toBe(2); });")],
    ['test.todo(…)', unit("test.todo('X');")],
    ['it.skip', unit("it.skip('X', () => {});")],
    ['it.todo', unit("it.todo('X');")],
    ['describe.skip', unit("describe.skip('D', () => {});")],
    ['describe.todo', unit("describe.todo('D', () => {});")],
    ['suite.skip', unit("suite.skip('D', () => {});")],
    ['test.describe.skip', e2e("test.describe.skip('D', () => { test('X', async () => { expect(1).toBe(1); }); });")],
    ['test.describe.fixme', e2e("test.describe.fixme('D', () => { test('X', async () => { expect(1).toBe(1); }); });")],
    ['test.describe.serial.skip', e2e("test.describe.serial.skip('D', () => {});")],
    ['test.step.skip', e2e("test('X', async () => { await test.step.skip('s', async () => {}); expect(1).toBe(1); });")],
    ['test.only', e2e("test.only('X', async () => { expect(1).toBe(1); });")],
    ['test.describe.only', e2e("test.describe.only('D', () => {});")],
    ['本體內 test.skip()', e2e("test('X', async () => { test.skip(); expect(1).toBe(1); });")],
    ['本體內 test.skip(條件, 說明)', e2e("test('X', async ({ browserName }) => { test.skip(browserName === 'webkit', '理由'); expect(1).toBe(1); });")],
    ['describe 本體內 test.skip(條件)', e2e("test.describe('D', () => { test.skip(process.env.CI); test('X', async () => { expect(1).toBe(1); }); });")],
    ['本體內 test.fixme()', e2e("test('X', async () => { test.fixme(); expect(1).toBe(1); });")],
    ['本體內 test.fail()', e2e("test('X', async () => { test.fail(); expect(1).toBe(2); });")],
    ['node:test 的 t.skip()', unit("test('X', (t) => { t.skip(); assert.ok(1); });")],
    ['node:test 的 t.todo()', unit("test('X', (t) => { t.todo(); assert.ok(1); });")],
    ['testInfo.skip()', e2e("test('X', async ({}, testInfo) => { testInfo.skip(); expect(1).toBe(1); });")],
    ['testInfo.fixme()', e2e("test('X', async ({}, testInfo) => { testInfo.fixme(); expect(1).toBe(1); });")],
    ['testInfo.fail()', e2e("test('X', async ({}, testInfo) => { testInfo.fail(); expect(1).toBe(1); });")],
    ['選項 { skip }', unit("test('X', { skip: true }, () => { assert.ok(1); });")],
    ['選項 { todo }', unit("test('X', { todo: '理由' }, () => { assert.ok(1); });")],
    ['選項簡寫 { skip }', unit("const skip = true;\ntest('X', { skip }, () => { assert.ok(1); });")],
    ['選項以字串為鍵', unit("test('X', { 'skip': true }, () => { assert.ok(1); });")],
    ['annotation 物件', e2e("test('X', { annotation: { type: 'skip' } }, async () => { expect(1).toBe(1); });")],
    ['annotation 陣列', e2e("test('X', { annotation: [{ type: 'fixme', description: 'd' }] }, async () => { expect(1).toBe(1); });")],
    ['annotation type: fail', e2e("test('X', { annotation: { 'type': 'fail' } }, async () => { expect(1).toBe(1); });")],
    ['expectFailure 選項', unit("test('X', { expectFailure: true }, () => { assert.ok(1); });")],
    ['計算屬性 test[\'skip\']', e2e("test['skip']('X', async () => {});")],
    ['計算屬性（樣板字面值）', e2e("test[`fixme`]('X', async () => {});")],
    ['解構別名 const { skip } = test', e2e("const { skip } = test;\nskip('X', async () => {});")],
    ['別名 const s = test.skip', e2e("const s = test.skip;\ns('X', async () => {});")],
    ['可選鏈 test?.skip', e2e("test?.skip('X', async () => {});")],
    ['骨架寫在 describe 內', e2e("test.describe('D', () => { test.skip('X', async () => {}); });")],
    ['骨架名稱是樣板字面值', e2e('test.skip(`X`, async () => {});')],
    ['骨架名稱是變數', e2e("const n = 'X';\ntest.skip(n, async () => {});")],
    ['骨架多一個選項參數', e2e("test.skip('X', { tag: '@a' }, async () => {});")],
    ['骨架以 function 宣告', e2e("test.skip('X', async function () {});")],
    ['骨架寫在函式內', e2e("function f() { test.skip('X', async () => {}); }\nf();")],
  ];
  for (const [label, files] of cases) {
    test(`${label}：判定失敗`, () => {
      const r = check(files);
      assert.equal(r.ok, false, label);
      assert.ok(rulesOf(r).includes('12.2 第 8 點'), `${label}：${JSON.stringify(r.violations)}`);
    });
  }

  test('骨架本體不為空：判定失敗並指出應改為 test(', () => {
    const r = check(e2e("test.skip('X', async () => { expect(1).toBe(1); });"));
    const v = r.violations.filter((x) => x.rule === '12.2 第 8 點');
    assert.equal(v.length, 1);
    assert.match(v[0].message, /骨架本體必須為空/);
  });

  test('骨架可帶參數、可為 async、本體可有註解', () => {
    const r = check(e2e("test.skip('X1', async ({ page }) => {});\ntest.skip('X2', () => { /* 說明 */ });\ntest.skip('X3', (t) => {});"));
    assert.deepEqual(r.violations, []);
    assert.equal(r.skeletons.length, 7);
  });

  test('assert.fail、字串資料與註解中的 test.skip( 不誤判；與略過無關的同名識別字不誤判', () => {
    const r = check(unit([
      "test('X', () => {",
      "  const src = \"test.skip('Y', () => {}); test.fail('Z')\";",
      "  // test.skip(); t.todo()",
      "  assert.ok(src.length > 0);",
      "  if (!src) assert.fail('不應到這裡');",
      "  const skipped = { failures: 0, onlyOnce: true };",
      "  assert.equal(skipped.failures, 0);",
      '});',
    ].join('\n')));
    assert.deepEqual(r.violations, []);
  });

  test('findForbiddenSkips：回報行號', () => {
    const a = analyzeSource("test('X', async () => {\n  test.skip();\n});\n");
    assert.deepEqual(findForbiddenSkips(a).map((v) => v.line), [2]);
  });
});

describe('runCheck v0.5：第 9a 點（非骨架測試至少有一個斷言呼叫）', () => {
  const e2e = (body) => ({ 'tests/acceptance/e2e/v.spec.mjs': E2E_HEAD + body + '\n' });

  for (const [label, body] of [
    ['刪掉 .skip 留下空本體', "test('X', async () => {});"],
    ['本體只有操作沒有斷言', "test('X', async ({ page }) => { await page.goto('/'); });"],
    ['expect 只出現在字串與註解中', "test('X', async () => { const s = 'expect(1)'; /* expect(2) */ });"],
    ['只參照 expect 而沒有呼叫', "test('X', async () => { const e = expect; });"],
    ['本體以參照傳入', "const body = async () => { expect(1).toBe(1); };\ntest('X', body);"],
  ]) {
    test(`${label}：判定失敗`, () => {
      const r = check(e2e(body));
      assert.equal(r.ok, false);
      assert.deepEqual(rulesOf(r), ['12.2 第 9a 點']);
    });
  }

  test('expect、expect.soft、expect.poll、assert.equal、以 expect／assert 開頭的輔助函式都算', () => {
    const r = check(e2e([
      "test('A', async () => { expect(1).toBe(1); });",
      "test('B', async () => { expect.soft(1).toBe(1); });",
      "test('C', async () => { await expect.poll(() => 1).toBe(1); });",
      "test('D', async ({ page }) => { await expectVisible(page); });",
      "test('E', async () => { assertSameFace(1, 1); });",
      "test.describe('區', () => { test('F', async () => { await test.step('s', async () => { expect(1).toBe(1); }); }); });",
    ].join('\n')));
    assert.deepEqual(r.violations, []);
  });

  test('hasAssertionCall：前面接「.」的 expect 不是被呼叫者的第一個識別字', () => {
    const toks = tokenize('helpers.expect(1); t.assert.ok(1);');
    assert.equal(hasAssertionCall(toks, 0, toks.length), false);
  });
});

describe('runCheck v0.5：第 9b 點（同一檔案的測試名稱不得重複）', () => {
  test('同一檔案同名（含相同 describe 路徑）：失敗；不同 describe 下同名、不同檔案同名：不失敗', () => {
    const dup = check({
      'tests/acceptance/e2e/v.spec.mjs': E2E_HEAD +
        "test('X', async () => { expect(1).toBe(1); });\ntest('X', async () => { expect(1).toBe(1); });\n",
    });
    assert.deepEqual(rulesOf(dup), ['12.2 第 9b 點']);
    const ok = check({
      'tests/acceptance/e2e/v.spec.mjs': E2E_HEAD +
        "test.describe('A', () => { test('X', async () => { expect(1).toBe(1); }); });\n" +
        "test.describe('B', () => { test('X', async () => { expect(1).toBe(1); }); });\n",
      'tests/acceptance/e2e/w.spec.mjs': E2E_HEAD + "test('X', async () => { expect(1).toBe(1); });\n",
    });
    assert.deepEqual(ok.violations, []);
  });

  test('非骨架測試借用骨架的名稱：失敗', () => {
    const r = check({
      'tests/acceptance/e2e/v.spec.mjs': E2E_HEAD + "test.skip('X', async () => {});\ntest('X', async () => { expect(1).toBe(1); });\n",
    });
    assert.deepEqual(rulesOf(r), ['12.2 第 9b 點']);
  });

  test('findDuplicateNames 回報第二個的行號', () => {
    const t = extractTests("test('a', () => {});\n\ntest('a', () => {});");
    assert.deepEqual(findDuplicateNames(t).map((v) => v.line), [3]);
  });
});

describe('runCheck v0.5：第 9c 點（無瀏覽器層驗收測試的斷言來源）', () => {
  const unitFile = (src) => ({ 'tests/acceptance/unit/v.test.mjs': src + "\ntest('X', () => { assert.ok(1); });\n" });
  const nodeTest = "import { test } from 'node:test';\n";
  const support = "import { assert } from '../../support/assertions.mjs';\n";

  for (const [label, src] of [
    ['匯入 node:assert', nodeTest + support + "import nodeAssert from 'node:assert';"],
    ['匯入 node:assert/strict', nodeTest + support + "import { strict } from 'node:assert/strict';"],
    ['匯入 assert', nodeTest + support + "import a from 'assert';"],
    ['匯入 assert/strict', nodeTest + support + "import * as a from 'assert/strict';"],
    ['動態匯入 node:assert', nodeTest + support + "const m = await import('node:assert');"],
    ['require(\'assert\')', nodeTest + support + "const m = require('assert');"],
    ['沒有自 tests/support/assertions.mjs 匯入 assert', nodeTest + "const assert = { ok() {} };"],
    ['自錯誤路徑匯入', nodeTest + "import { assert } from '../support/assertions.mjs';"],
    ['只匯入其他名稱', nodeTest + "import { assert as a, other as assert } from '../../support/x.mjs';"],
  ]) {
    test(`${label}：判定失敗`, () => {
      const r = check(unitFile(src));
      assert.equal(r.ok, false);
      assert.ok(rulesOf(r).includes('12.2 第 9c 點'), JSON.stringify(r.violations));
    });
  }

  test('自 tests/support/assertions.mjs 匯入 assert（可與其他名稱並列）：通過；端對端層不受此限', () => {
    assert.deepEqual(check(unitFile(nodeTest + "import { helper, assert } from '../../support/assertions.mjs';")).violations, []);
    assert.deepEqual(check({
      'tests/acceptance/e2e/v.spec.mjs': E2E_HEAD + "import assert from 'node:assert';\ntest('X', async () => { expect(1).toBe(1); });",
    }).violations, []);
  });

  test('只有骨架的無瀏覽器層檔案同樣必須匯入（v0.5.1 釐清：12.2 第 9c 點不豁免只含骨架的檔案）', () => {
    const r = check({ 'tests/acceptance/unit/v.test.mjs': nodeTest + "test.skip('X', () => {});" });
    assert.deepEqual(rulesOf(r), ['12.2 第 9c 點']);
  });

  test('checkAssertImports：以檔案位置解析相對路徑', () => {
    const a = analyzeSource("import { assert } from '../../../support/assertions.mjs';");
    assert.deepEqual(checkAssertImports(a, 'tests/acceptance/unit/sub/x.test.mjs', 'tests/support/assertions.mjs'), []);
    assert.equal(checkAssertImports(a, 'tests/acceptance/unit/x.test.mjs', 'tests/support/assertions.mjs').length, 1);
  });
});

describe('runCheck v0.6.1：第 9d 點（樣板字面值的測試名稱）', () => {
  const UNIT_HEAD = "import { test, describe } from 'node:test';\nimport { assert } from '../../support/assertions.mjs';\n";
  const unitFile = (body) => ({ 'tests/acceptance/unit/v.test.mjs': UNIT_HEAD + body });
  const e2eFile = (body) => ({ 'tests/acceptance/e2e/v.spec.mjs': E2E_HEAD + body });
  const T = (name) => `test(\`${name}\`, () => { assert.ok(1); });\n`;
  const S = (name) => `test('${name}', () => { assert.ok(1); });\n`;
  const rule = '12.2 第 9d 點';
  const only9d = (r) => r.violations.filter((v) => v.rule === rule);

  test('固定前綴為空（以 ${ 開頭、前綴只有空白）：失敗「樣板名稱的固定前綴為空」，列出檔名與行號', () => {
    for (const name of ['${a} AC-ZZ-5', ' ${a}', '\t${a}x']) {
      const r = check(unitFile(T(name)));
      const v = only9d(r);
      assert.equal(r.ok, false, name);
      assert.equal(v.length, 1, JSON.stringify(r.violations));
      assert.match(v[0].message, /^樣板名稱的固定前綴為空/);
      assert.equal(v[0].file, 'tests/acceptance/unit/v.test.mjs');
      assert.equal(v[0].line, 3);
    }
  });

  test('同一檔案中兩個樣板前綴互為前綴（含相等）：失敗「樣板名稱前綴不唯一」', () => {
    for (const [a, b] of [['AC-ZZ-5 ${x}', 'AC-ZZ-5 ${y}'], ['AC-ZZ-5 ${x}', 'AC-ZZ-5 範圍 ${y}']]) {
      const v = only9d(check(unitFile(T(a) + T(b))));
      assert.ok(v.length >= 1, `${a} / ${b}`);
      assert.ok(v.every((x) => /^樣板名稱前綴不唯一/.test(x.message)));
    }
  });

  test('樣板前綴與同檔的字面值名稱相等或為其前綴：失敗（字串字面值與不含 ${ 的樣板都算）', () => {
    for (const other of [S('AC-ZZ-5 '), S('AC-ZZ-5 其他'), T('AC-ZZ-5 不含運算式')]) {
      const r = check(unitFile(T('AC-ZZ-5 ${x}') + other));
      assert.deepEqual(only9d(r).map((v) => v.line), [3], other);
      assert.match(only9d(r)[0].message, /^樣板名稱前綴不唯一："AC-ZZ-5 " 是第 4 行/);
    }
  });

  test('describe 名稱也採計；e2e 層同樣適用', () => {
    const r = check(e2eFile("test.describe('組 a', () => { test(`組 ${1}`, async () => { expect(1).toBe(1); }); });\n"));
    assert.equal(only9d(r).length, 1);
    assert.match(only9d(r)[0].message, /^樣板名稱前綴不唯一/);
    assert.equal(only9d(check(e2eFile("test(`${1} x`, async () => { expect(1).toBe(1); });\n"))).length, 1);
  });

  test('對照：前綴非空且唯一、不同檔案的相同前綴、名稱以字面值為前綴（反向）不失敗', () => {
    assert.deepEqual(only9d(check(unitFile(T('AC-ZZ-5 甲 ${x}') + T('AC-ZZ-5 乙 ${y}')))), []);
    assert.deepEqual(only9d(check({
      'tests/acceptance/unit/v.test.mjs': UNIT_HEAD + T('AC-ZZ-5 ${x}'),
      'tests/acceptance/unit/w.test.mjs': UNIT_HEAD + T('AC-ZZ-5 ${y}'),
    })), []);
    // 字面值「AC-ZZ-5」是樣板前綴「AC-ZZ-5 甲 」的前綴（反向）：結果「AC-ZZ-5」不會被樣板以前綴比對到，不失敗
    assert.deepEqual(only9d(check(unitFile(T('AC-ZZ-5 甲 ${x}') + S('AC-ZZ-5')))), []);
  });

  test('v0.6.2：修飾變體（test.only、describe.skip 等）與樣板 describe 的空前綴也失敗', () => {
    for (const src of [
      "test.only(`${a}`, () => { assert.ok(1); });\n",
      "describe.skip(`${a} 組`, () => {});\n",
      "describe(` ${a}`, () => { test('X', () => { assert.ok(1); }); });\n",
    ]) {
      const v = only9d(check(unitFile(src)));
      assert.equal(v.length, 1, src);
      assert.match(v[0].message, /^樣板名稱的固定前綴為空/);
    }
    const e2e = only9d(check(e2eFile("test.describe(`${a}`, () => { test('X', async () => { expect(1).toBe(1); }); });\n")));
    assert.equal(e2e.length, 1);
    assert.match(e2e[0].message, /^樣板名稱的固定前綴為空/);
  });

  test('test.describe.serial(…)、test.describe.parallel(…) 與其修飾變體也收集為 describe，9d 適用', () => {
    for (const src of [
      "test.describe.serial(`${a}`, () => { test('X', async () => { expect(1).toBe(1); }); });\n",
      "test.describe.parallel(` ${a}`, () => { test('X', async () => { expect(1).toBe(1); }); });\n",
      "test.describe.serial.only(`${a}`, () => { test('X', async () => { expect(1).toBe(1); }); });\n",
    ]) {
      const v = only9d(check(e2eFile(src)));
      assert.equal(v.length, 1, src);
      assert.match(v[0].message, /^樣板名稱的固定前綴為空/);
    }
    const a = analyzeSource("test.describe.serial('組', () => { test('X', async () => {}); });");
    assert.deepEqual(a.tests.map((t) => [t.name, t.kind, t.path]), [['組', 'describe', []], ['X', 'test', ['組']]]);
    assert.deepEqual(findTemplateNameIssues(analyzeSource("test.describe.serial(`${'x'}`, () => {});")).map((v) => v.message.slice(0, 11)), ['樣板名稱的固定前綴為空']);
  });

  test('v0.6.2：修飾變體的樣板前綴也參與「前綴不唯一」的比對', () => {
    const v = only9d(check(unitFile("test.skip(`組 ${a}`, () => {});\ntest('組 甲', () => { assert.ok(1); });\n")));
    assert.ok(v.some((x) => /^樣板名稱前綴不唯一/.test(x.message)), JSON.stringify(v));
  });

  test('樣板只出現在字串資料、斷言訊息、名稱以外的參數中時不採計', () => {
    const src = "test('X', () => { const s = `${a}`; assert.ok(1, `${b}`); });\nconst data = \"test(`${c}`, () => {})\";\n";
    assert.deepEqual(only9d(check(unitFile(src))), []);
  });

  test('templatePrefix 與 findTemplateNameIssues 純函式', () => {
    const calls = analyzeSource('test(`a ${x}`, () => {}); test(\'b\', () => {}); test(`c`, () => {});').calls;
    assert.deepEqual(calls.map(templatePrefix), ['a ', null, null]);
    assert.deepEqual(findTemplateNameIssues(analyzeSource('test(`a ${x}`, f);\ntest(`a ${y}`, f);')).map((v) => v.line), [1, 2]);
  });
});

describe('runCheck v0.6.1：第 9e 點（無瀏覽器層驗收測試不得使用子測試與並行）', () => {
  const UNIT_HEAD = "import { test, it, describe, suite } from 'node:test';\nimport { assert } from '../../support/assertions.mjs';\n";
  const unitFile = (body) => ({ 'tests/acceptance/unit/v.test.mjs': UNIT_HEAD + body });
  const rule = '12.2 第 9e 點';
  const only9e = (r) => r.violations.filter((v) => v.rule === rule);

  const SUBTESTS = [
    ['t.test(…)', "test('X', async (t) => { assert.ok(1); await t.test('子', () => {}); });"],
    ["t['test'](…)", "test('X', async (t) => { assert.ok(1); await t['test']('子', () => {}); });"],
    ['t?.test(…)', "test('X', async (t) => { assert.ok(1); await t?.test('子', () => {}); });"],
    ['以其他名稱的測試情境 ctx.test(…)', "test('X', async function (ctx) { assert.ok(1); await ctx.test('子', () => {}); });"],
    ['最上層 test(…)', "test('X', () => { assert.ok(1); test('子', () => {}); });"],
    ['最上層 it(…)', "test('X', () => { assert.ok(1); it('子', () => {}); });"],
    ['describe(…)', "test('X', () => { assert.ok(1); describe('子', () => {}); });"],
    ['suite(…)', "it('X', () => { assert.ok(1); suite('子', () => {}); });"],
    ['test.skip(…)', "test('X', () => { assert.ok(1); test.skip('子', () => {}); });"],
    ['巢狀箭頭函式內的 test(…)', "test('X', () => { assert.ok(1); [1].forEach(() => { test('子', () => {}); }); });"],
    ['describe 內的測試本體中的 it(…)', "describe('組', () => { it('X', () => { assert.ok(1); it('子', () => {}); }); });"],
  ];
  for (const [label, src] of SUBTESTS) {
    test(`${label}：失敗「驗收測試不得使用子測試」`, () => {
      const r = check(unitFile(src + '\n'));
      const v = only9e(r);
      assert.equal(r.ok, false, label);
      assert.ok(v.length >= 1, JSON.stringify(r.violations));
      assert.ok(v.every((x) => /^驗收測試不得使用子測試/.test(x.message)), JSON.stringify(v));
      assert.equal(v[0].line, 3);
    });
  }

  for (const [label, src] of [
    ['describe 的選項 { concurrency: 2 }', "describe('組', { concurrency: 2 }, () => { test('X', () => { assert.ok(1); }); });"],
    ['test 的選項 { concurrency: true }', "test('X', { concurrency: true }, () => { assert.ok(1); });"],
    ['簡寫 { concurrency }', "const concurrency = 2;\ndescribe('組', { concurrency }, () => { test('X', () => { assert.ok(1); }); });"],
    ["字串鍵 { 'concurrency': 2 }", "describe('組', { 'concurrency': 2 }, () => { test('X', () => { assert.ok(1); }); });"],
    ['屬性存取 o.concurrency', "const o = {};\no.concurrency = 2;\ntest('X', () => { assert.ok(1); });"],
    ["計算屬性 o['concurrency']", "const o = {};\no['concurrency'] = 2;\ntest('X', () => { assert.ok(1); });"],
  ]) {
    test(`${label}：失敗「驗收測試不得設定 concurrency」`, () => {
      const v = only9e(check(unitFile(src + '\n')));
      assert.equal(v.length, 1, JSON.stringify(v));
      assert.equal(v[0].message, '驗收測試不得設定 concurrency');
    });
  }

  for (const [label, src] of [
    ["可選串連的計算屬性 t?.['test'](…)", "test('X', async (t) => { assert.ok(1); await t?.['test']('子', () => {}); });"],
    ['可選呼叫 test?.(…)', "test('X', () => { assert.ok(1); test?.('子', () => {}); });"],
    ['屬性的可選呼叫 test.skip?.(…)', "test('X', () => { assert.ok(1); test.skip?.('子', () => {}); });"],
    ['可選串連的屬性 it?.skip(…)', "test('X', () => { assert.ok(1); it?.skip('子', () => {}); });"],
    ["計算屬性的呼叫 test['skip'](…)", "test('X', () => { assert.ok(1); test['skip']('子', () => {}); });"],
  ]) {
    test(`${label}：失敗「驗收測試不得使用子測試」`, () => {
      const v = only9e(check(unitFile(src + '\n')));
      assert.equal(v.length, 1, JSON.stringify(v));
      assert.match(v[0].message, /^驗收測試不得使用子測試/);
    });
  }

  test('對照：三元運算子 `? .5`、`t ? t.name : …` 不被誤判為可選串連', () => {
    const src = "test('X', (t) => { const a = t ? .5 : 1; const b = t ? t.name : ''; assert.ok(a && b !== undefined); });\n";
    assert.deepEqual(only9e(check(unitFile(src))), []);
  });

  test('對照：describe 本體中的 test(…)／it(…)、RegExp 的 .test(…)、字串資料與註解中的 t.test( 不誤判', () => {
    const src = [
      "describe('組', () => { test('X', () => { assert.ok(/a/.test('a')); }); it('Y', () => { assert.ok(1); }); });",
      "test('Z', (t) => { const re = /b/; assert.ok(re.test('b')); const s = \"t.test('子', () => {})\"; /* t.test( */ // test('註解')",
      "  assert.ok(s); t.after(() => {}); });",
      "const note = 'concurrency: 2'; // { concurrency: 2 }",
    ].join('\n');
    const r = check(unitFile(src + '\n'));
    assert.deepEqual(only9e(r), [], JSON.stringify(r.violations));
  });

  test('測試情境以外的物件的 .test 屬性（例：別的變數）不受 (2) 限制；測試本體外呼叫 test(…) 不受 (1) 限制', () => {
    const src = "const helper = { test() { return true; } };\ntest('X', (t) => { assert.ok(helper.test()); });\ntest('Y', () => { assert.ok(1); });\n";
    assert.deepEqual(only9e(check(unitFile(src))), []);
  });

  test('tests/acceptance/e2e/ 不適用 9e', () => {
    const r = check({
      'tests/acceptance/e2e/v.spec.mjs': E2E_HEAD +
        "test.describe('組', () => { test.describe.configure({ mode: 'parallel' }); test('X', async () => { expect(1).toBe(1); }); });\nconst o = { concurrency: 2 };\n",
    });
    assert.deepEqual(only9e(r), []);
  });

  test('findSubtestsAndConcurrency 純函式：同一呼叫只回報一次，依行號排序', () => {
    const a = analyzeSource("test('X', (t) => {\n  t.test('a', () => {});\n  test('b', () => { test('c', () => {}); });\n});\nconst o = { concurrency: 1 };");
    assert.deepEqual(findSubtestsAndConcurrency(a).map((v) => v.line), [2, 3, 3, 5]);
  });
});

describe('CLI：對暫存版本庫執行', () => {
  test('違反靜態規則時以 1 結束並逐列印出檔名、行號與點號', async () => {
    const { spawnSync } = await import('node:child_process');
    const { cpSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const root = makeRepo({ ...BASE_FILES, 'tests/acceptance/e2e/v.spec.mjs': E2E_HEAD + "test('X', async () => { test.skip(); });\n" });
    try {
      mkdirSync(path.join(root, 'scripts'));
      cpSync(fileURLToPath(new URL('../../scripts/check-acceptance-ids.mjs', import.meta.url)), path.join(root, 'scripts/check-acceptance-ids.mjs'));
      const r = spawnSync(process.execPath, [path.join(root, 'scripts/check-acceptance-ids.mjs')], { encoding: 'utf8' });
      assert.equal(r.status, 1);
      assert.match(r.stderr, /^acceptance-ids：tests\/acceptance\/e2e\/v\.spec\.mjs:2  12\.2 第 8 點/m);
      assert.match(r.stderr, /12\.2 第 9a 點/);
      for (const line of (r.stdout + r.stderr).split('\n').filter(Boolean)) assert.match(line, /^acceptance-ids：/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
