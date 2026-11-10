// 模組單元測試：scripts/detection.mjs（module-test-standards.md M12 v0.6.1；review-process.md 第 4 節「偵測形式」、4.1）。
// 測試名稱與資料不含真實驗收編號。
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  fieldForm,
  stripHtml,
  stripLinks,
  firstCharRule,
  charRuleReason,
  HTML_TAG,
  SIMPLIFIED_TO_TRADITIONAL,
} from '../../scripts/detection.mjs';

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../scripts/detection.mjs');

describe('fieldForm：F2′（CommonMark 標籤文法）', () => {
  test('引號中含 `>` 的屬性整個屬於標籤（v0.5.1～v0.6 的 F2 會留下殘段）', () => {
    assert.equal(fieldForm('- 結<x y="a>b">果：X'), '結果:x');
    assert.equal(fieldForm("- 結<x y='a>b'>果：X"), '結果:x');
  });

  test('多個屬性（未加引號、單引號、雙引號、沒有值）、自我結束、結束標籤都刪除', () => {
    assert.equal(fieldForm('<span class="a" data-x=\'1\' hidden id=z>結果</span>：X'), '結果:x');
    assert.equal(fieldForm('<br/>結果<br />：X'), '結果:x');
    assert.equal(fieldForm('</b >結果：X'), '結果:x');
    assert.equal(fieldForm('<my-tag a:b="1" _c>結果：X'), '結果:x');
  });

  test('不合文法的「標籤」不刪（之後由 X7 判為無效）；`<版本>` 不是標籤', () => {
    assert.equal(fieldForm('- <b !>結果</b>：X'), 'b!>結果:x');
    assert.ok(!fieldForm('- <b !>結果</b>：X').startsWith('結果:'));
    assert.equal(fieldForm('需求文件 v<版本>'), '需求文件v<版本>');
    assert.equal(fieldForm('<1>結果：X'), '結果:x'); // F7 刪除非字母前綴 `<1>`
  });

  test('`<!--`、`-->` 只刪分隔符號、保留其間文字；巢狀標籤重複到不動點', () => {
    assert.equal(stripHtml('a<!-- b -->c'), 'a b c');
    assert.equal(stripHtml('<<b>b>x'), 'x');
    assert.equal(stripHtml('<i><b>x</b></i>'), 'x');
  });

  test('HTML_TAG 只匹配完整的開始與結束標籤', () => {
    const tags = (s) => s.match(HTML_TAG) ?? [];
    assert.deepEqual(tags('a <b> c </b> <x y="1>2"> <b !> <版本> a<b'), ['<b>', '</b>', '<x y="1>2">']);
  });
});

describe('fieldForm：F9（簡體字欄位名稱）', () => {
  test('结果、针对 commit、审查者、工作阶段 對應到正體的標籤', () => {
    assert.ok(fieldForm('- 结果：X').startsWith('結果:'));
    assert.ok(fieldForm('- 针对 commit：X').startsWith('針對commit:'));
    assert.ok(fieldForm('- 针對 Commit：X').startsWith('針對commit:'));
    assert.ok(fieldForm('- 审查者：X').startsWith('審查者:'));
    assert.ok(fieldForm('- 工作阶段：x').startsWith('工作階段:'));
  });

  test('對應表恰為設計列出的五個字', () => {
    assert.deepEqual(SIMPLIFIED_TO_TRADITIONAL, { 结: '結', 针: '針', 对: '對', 审: '審', 阶: '階' });
  });

  test('其他步驟維持 v0.5.1 的行為（F1、F3～F8）', () => {
    assert.equal(fieldForm('- 結果：APPROVED'), '結果:approved');
    assert.equal(fieldForm('[結果](#)：X'), '結果:x');
    assert.equal(stripLinks('[[a](b)](c)'), 'a');
    assert.equal(fieldForm('\\- **結果**：X'), '結果:x');
    assert.equal(fieldForm('- [x] ~~結果~~：X'), '結果:x');
  });
});

describe('firstCharRule：X1～X5（依序，回報第一個成立的規則）', () => {
  test('各規則的代表字元', () => {
    assert.equal(firstCharRule('a​b'), 'X1'); // Cf
    assert.equal(firstCharRule('a\u0001b'), 'X1'); // 控制字元
    assert.equal(firstCharRule('a\rb'), 'X1'); // 單獨的 CR
    assert.equal(firstCharRule('aㅤb'), 'X2'); // HANGUL FILLER（Lo）
    assert.equal(firstCharRule('aﾠb'), 'X2');
    assert.equal(firstCharRule('aᅟb'), 'X2');
    assert.equal(firstCharRule('a͏b'), 'X2'); // COMBINING GRAPHEME JOINER（Mn，同時是 DI）
    assert.equal(firstCharRule('a️b'), 'X2'); // 變體選擇符
    assert.equal(firstCharRule('a\u{E0100}b'), 'X2');
    assert.equal(firstCharRule('é'), 'X3'); // 結合符號（不是 DI）
    assert.equal(firstCharRule('a⠀b'), 'X4');
    assert.equal(firstCharRule('a&#124;b'), 'X5');
    assert.equal(firstCharRule('a&#x7D50;b'), 'X5');
    assert.equal(firstCharRule('a&#X7d50;b'), 'X5');
    assert.equal(firstCharRule('a&nbsp;b'), 'X5');
    assert.equal(firstCharRule('a&notAnEntity1;b'), 'X5'); // 不論是否為有效的具名參照
  });

  test('換行、定位字元、一般全形字、U+00A0、`&` 單獨出現、`& x;` 不成立', () => {
    for (const s of ['a\nb\tc', '全形：｜（）', 'a b', 'R&D', 'a & b;', '&#;', '&#x;', '&1a;', '✔', '一般 emoji 🎉']) {
      assert.equal(firstCharRule(s), null, JSON.stringify(s));
    }
  });

  test('順序：同時含 Cf 與字元參照時為 X1；同時含 DI 與結合符號時為 X2', () => {
    assert.equal(firstCharRule('&amp;​'), 'X1');
    assert.equal(firstCharRule('éㅤ'), 'X2');
    assert.equal(firstCharRule('✔️'), 'X2');
  });

  test('回報原因：X1～X4 為「含不可見字元」，X5 為「含字元參照」', () => {
    for (const r of ['X1', 'X2', 'X3', 'X4']) assert.equal(charRuleReason(r), '含不可見字元');
    assert.equal(charRuleReason('X5'), '含字元參照');
  });
});

describe('模組的自足性', () => {
  test('只用 Node.js 內建模組（本檔沒有任何 import）', () => {
    const src = readFileSync(SCRIPT, 'utf8');
    assert.doesNotMatch(src, /^\s*import\s/m);
    assert.doesNotMatch(src, /\brequire\(/);
  });
});
