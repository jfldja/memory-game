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
      { name: '區塊', kind: 'describe', skipped: false, line: 3 },
      { name: '項目', kind: 'test', skipped: false, line: 4 },
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
