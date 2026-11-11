// 模組單元測試：scripts/check-pr-body.mjs（module-test-standards.md M12）。
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluatePrBody,
  latestChangelogVersion,
  parseAuthorSessions,
  parseAuthorSessionsRaw,
  normalizeSessionId,
  validateAuthorSection,
  stripHtmlComments,
  skillReader,
  NO_VERSION,
} from '../../scripts/check-pr-body.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const SKILL_WITH_LOG = [
  '# 範例 skill',
  '## 1. 內容',
  '| 版本 | 說明 |',
  '|---|---|',
  '| 9.9 | 這不是變更紀錄（段落標題不含變更紀錄） |',
  '```',
  '## 9. 變更紀錄',
  '| 版本 | 日期 |',
  '|---|---|',
  '| 8.8 | 程式碼區塊內的範例 |',
  '```',
  '## 9. 回饋機制與變更紀錄',
  '',
  '| 版本 | 日期 | 修改 |',
  '|---|---|---|',
  '| 1.0 | 2026-01-01 | 初版 |',
  '| 1.2 | 2026-01-02 | 第二版 |',
  '',
  '## 10. 其他',
].join('\n');

const SKILL_NO_LOG = '# 沒有變更紀錄的 skill\n\n內容';

const SKILLS = {
  'agent-dev-workflow': SKILL_WITH_LOG,
  'some-skill': SKILL_WITH_LOG,
  'legacy-skill': SKILL_NO_LOG,
};
const readSkill = (name) => SKILLS[name] ?? null;

function makeBody({
  checks = ['- [x] 一', '- [x] 二'],
  skillRows = ['| agent-dev-workflow | 1.2 |'],
  authors = ['- 角色：實作 agent', '- 工作階段：impl-1'],
  omit = [],
} = {}) {
  const parts = ['## 對應編號', '', 'X-1', ''];
  if (!omit.includes('authors')) parts.push('## 作者', '', ...authors, '');
  if (!omit.includes('checks')) parts.push('## 上工檢查（agent-dev-workflow 第 1 節）', '', ...checks, '');
  if (!omit.includes('skills')) {
    parts.push('## 已載入的 skill', '', '| skill | 變更紀錄最新版本號 |', '|---|---|', ...skillRows, '');
  }
  parts.push('## 自我審查', '', '- [ ] 這一段的未勾選不影響判定');
  return parts.join('\n');
}

describe('latestChangelogVersion', () => {
  test('取標題含「變更紀錄」段落中、以「版本」為第一欄的表格的最後一列', () => {
    assert.equal(latestChangelogVersion(SKILL_WITH_LOG), '1.2');
  });

  test('程式碼區塊內的範例與其他段落的表格不採計', () => {
    const onlyFenced = SKILL_WITH_LOG.split('## 9. 回饋機制與變更紀錄')[0];
    assert.equal(latestChangelogVersion(onlyFenced), null);
  });

  test('沒有變更紀錄時為 null', () => {
    assert.equal(latestChangelogVersion(SKILL_NO_LOG), null);
  });

  test('版本庫中的 skill 副本都讀得到版本號', () => {
    const read = skillReader(ROOT);
    for (const name of ['agent-dev-workflow', 'requirements-spec', 'software-design-phase']) {
      assert.match(latestChangelogVersion(read(name)), /^\d+\.\d+$/, name);
    }
  });
});

describe('parseAuthorSessions', () => {
  test('多位作者時取出全部工作階段；去除 HTML 註解與前後空白', () => {
    const body = makeBody({
      authors: [
        '- 角色：實作 agent',
        '- 工作階段：  impl-1  ',
        '- 角色：測試 agent',
        '- 工作階段：test-1 <!-- 說明 -->',
        '工作階段：plain-3',
      ],
    });
    assert.deepEqual(parseAuthorSessions(body), ['impl-1', 'test-1', 'plain-3']);
  });

  test('只採計「## 作者」段落內的行；段落外的工作階段行不採計', () => {
    const body = ['## 作者', '- 工作階段：ok-1', '## 其他', '- 工作階段：outside', '- 工作階段:half-width'].join('\n');
    assert.deepEqual(parseAuthorSessions(body), ['ok-1']);
  });

  test('v0.6.1：段落內以半形冒號寫的工作階段行不再被略過，而是丟出「作者段落格式不符」', () => {
    const body = ['## 作者', '- 工作階段:half-width', '- 工作階段：ok-1'].join('\n');
    assert.throws(() => parseAuthorSessions(body), /作者段落格式不符：第 1 行/);
    assert.throws(() => parseAuthorSessionsRaw(body), /作者段落格式不符：第 1 行/);
  });

  test('只有範本的註解佔位時沒有工作階段；說明為空時回傳空陣列', () => {
    assert.deepEqual(parseAuthorSessions('## 作者\n- 工作階段：<!-- 填寫 -->'), []);
    assert.deepEqual(parseAuthorSessions(null), []);
  });
});

describe('evaluatePrBody', () => {
  test('完整且正確的說明通過', () => {
    const r = evaluatePrBody({ body: makeBody(), readSkill });
    assert.deepEqual(r, { ok: true, errors: [], warnings: [] });
  });

  test('上工檢查有未勾選時失敗；大寫 X 視為已勾選', () => {
    const r = evaluatePrBody({ body: makeBody({ checks: ['- [X] 一', '- [ ] 二'] }), readSkill });
    assert.equal(r.ok, false);
    assert.equal(r.errors.length, 1);
    assert.match(r.errors[0], /未勾選/);
  });

  test('上工檢查段落沒有任何核取方塊時失敗', () => {
    const r = evaluatePrBody({ body: makeBody({ checks: ['沒有勾選框'] }), readSkill });
    assert.ok(r.errors.some((e) => /沒有核取方塊/.test(e)));
  });

  test('缺段落時各自回報', () => {
    for (const [omit, re] of [['checks', /上工檢查/], ['skills', /已載入的 skill/], ['authors', /作者/]]) {
      const r = evaluatePrBody({ body: makeBody({ omit: [omit] }), readSkill });
      assert.equal(r.ok, false, omit);
      assert.ok(r.errors.some((e) => re.test(e)), omit);
    }
  });

  test('PR 說明為空時失敗', () => {
    assert.equal(evaluatePrBody({ body: null, readSkill }).ok, false);
    assert.equal(evaluatePrBody({ body: '', readSkill }).ok, false);
  });

  test('表格沒有 agent-dev-workflow 時失敗', () => {
    const r = evaluatePrBody({ body: makeBody({ skillRows: ['| some-skill | 1.2 |'] }), readSkill });
    assert.ok(r.errors.some((e) => /agent-dev-workflow/.test(e)));
  });

  test('版本號不符時失敗', () => {
    const r = evaluatePrBody({
      body: makeBody({ skillRows: ['| agent-dev-workflow | 1.0 |', '| some-skill | 1.2 |'] }),
      readSkill,
    });
    assert.equal(r.ok, false);
    assert.equal(r.errors.length, 1);
    assert.match(r.errors[0], /agent-dev-workflow 的版本號應為 "1.2"/);
  });

  test('版本號欄空白時失敗', () => {
    const r = evaluatePrBody({ body: makeBody({ skillRows: ['| agent-dev-workflow |  |'] }), readSkill });
    assert.equal(r.ok, false);
  });

  test('skill 不存在時失敗；名稱含路徑字元時視為不合法', () => {
    const r = evaluatePrBody({
      body: makeBody({ skillRows: ['| agent-dev-workflow | 1.2 |', '| no-such-skill | 1.0 |'] }),
      readSkill,
    });
    assert.ok(r.errors.some((e) => /no-such-skill/.test(e)));
    const r2 = evaluatePrBody({
      body: makeBody({ skillRows: ['| agent-dev-workflow | 1.2 |', '| ../../etc | 1.0 |'] }),
      readSkill,
    });
    assert.ok(r2.errors.some((e) => /不合法/.test(e)));
  });

  test('整列空白（範本的預留列）不採計', () => {
    const r = evaluatePrBody({ body: makeBody({ skillRows: ['| agent-dev-workflow | 1.2 |', '|  |  |'] }), readSkill });
    assert.equal(r.ok, true);
  });

  test('過渡規則：skill 沒有變更紀錄時填「無版本號」為警告，填其他值為錯誤', () => {
    const ok = evaluatePrBody({
      body: makeBody({ skillRows: ['| agent-dev-workflow | 1.2 |', `| legacy-skill | ${NO_VERSION} |`] }),
      readSkill,
    });
    assert.equal(ok.ok, true);
    assert.equal(ok.warnings.length, 1);
    const bad = evaluatePrBody({
      body: makeBody({ skillRows: ['| agent-dev-workflow | 1.2 |', '| legacy-skill | 1.0 |'] }),
      readSkill,
    });
    assert.equal(bad.ok, false);
  });

  test('過渡規則結束後：skill 有變更紀錄時填「無版本號」即失敗', () => {
    const r = evaluatePrBody({
      body: makeBody({ skillRows: [`| agent-dev-workflow | ${NO_VERSION} |`] }),
      readSkill,
    });
    assert.equal(r.ok, false);
  });

  test('多位作者時只要有一個工作階段即通過；全部為空時失敗', () => {
    const multi = makeBody({
      authors: ['- 角色：實作 agent', '- 工作階段：impl-1', '- 角色：測試 agent', '- 工作階段：test-1'],
    });
    assert.equal(evaluatePrBody({ body: multi, readSkill }).ok, true);
    const empty = makeBody({ authors: ['- 角色：實作 agent', '- 工作階段：<!-- 填寫 -->'] });
    const r = evaluatePrBody({ body: empty, readSkill });
    assert.ok(r.errors.some((e) => /工作階段/.test(e)));
  });

  test('註解中的核取方塊與表格列不採計', () => {
    const body = makeBody().replace('## 上工檢查（agent-dev-workflow 第 1 節）\n', '## 上工檢查（agent-dev-workflow 第 1 節）\n<!-- - [ ] 註解中的範例 -->\n');
    assert.equal(evaluatePrBody({ body, readSkill }).ok, true);
  });

  test('stripHtmlComments 可移除跨行註解', () => {
    assert.equal(stripHtmlComments('a<!--\nb\n-->c'), 'ac');
  });
});

describe('PR 範本', () => {
  const template = readFileSync(path.join(ROOT, '.github', 'pull_request_template.md'), 'utf8');

  test('未填寫的範本不會通過（核取方塊未勾選、版本號與工作階段空白）', () => {
    const r = evaluatePrBody({ body: template, readSkill: skillReader(ROOT) });
    assert.equal(r.ok, false);
  });

  test('範本含「## 作者」「## 上工檢查」「## 已載入的 skill」，且不預填「無版本號」', () => {
    assert.match(template, /^## 作者/m);
    assert.match(template, /^## 上工檢查/m);
    assert.match(template, /^## 已載入的 skill/m);
    assert.doesNotMatch(stripHtmlComments(template), new RegExp(NO_VERSION));
  });
});

describe('作者工作階段識別的格式（spec.md 12.4 第 4 點，review-process.md 第 4 節第 2 步）', () => {
  const withSession = (id) => makeBody({ authors: ['- 角色：實作 agent', `- 工作階段：${id}`] });

  test('normalizeSessionId：去除前後空白、NFKC（全形轉半形）、轉小寫', () => {
    assert.equal(normalizeSessionId('  impl-1 '), 'impl-1');
    assert.equal(normalizeSessionId('IMPL-1'), 'impl-1');
    assert.equal(normalizeSessionId('ｉｍｐｌ－１'), 'impl-1');
    assert.equal(normalizeSessionId('\u3000impl-1\u3000'), 'impl-1');
  });

  test('normalizeSessionId：零寬字元、BOM、方向控制字元、相似字、其他字元時為 null', () => {
    for (const bad of ['impl\u200b-1', '\ufeffimpl-1', 'impl-1\u202e', 'impl\u2060-1', 'іmpl-1', 'impl_1', 'impl 1', 'impl.1', '', '   ']) {
      assert.equal(normalizeSessionId(bad), null, JSON.stringify(bad));
    }
  });

  test('含大寫或全形的作者識別正規化後通過', () => {
    assert.equal(evaluatePrBody({ body: withSession('IMPL-1'), readSkill }).ok, true);
    assert.equal(evaluatePrBody({ body: withSession('ｉｍｐｌ－１'), readSkill }).ok, true);
  });

  test('作者識別含相似字或字元集以外的字元時：作者工作階段識別格式不符', () => {
    for (const bad of ['іmpl-1', 'impl_1']) {
      const r = evaluatePrBody({ body: withSession(bad), readSkill });
      assert.equal(r.ok, false, JSON.stringify(bad));
      assert.ok(r.errors.some((e) => /作者工作階段識別格式不符/.test(e)), r.errors.join('\n'));
    }
  });

  test('作者識別含零寬字元或 BOM 時失敗（v0.6.1 起在段落層級以 X1 先判定：作者段落含不可見字元或字元參照）', () => {
    for (const bad of ['impl\u200b-1', '\ufeffimpl-1']) {
      const r = evaluatePrBody({ body: withSession(bad), readSkill });
      assert.equal(r.ok, false, JSON.stringify(bad));
      assert.ok(r.errors.some((e) => /作者段落含不可見字元或字元參照/.test(e)), r.errors.join('\n'));
    }
  });

  test('多位作者中只要一位格式不符即失敗', () => {
    const body = makeBody({
      authors: ['- 角色：實作 agent', '- 工作階段：impl-1', '- 角色：測試 agent', '- 工作階段：test\u200b-1'],
    });
    assert.equal(evaluatePrBody({ body, readSkill }).ok, false);
  });

  test('parseAuthorSessionsRaw 保留原文的前後空白；BOM 在段落層級即被拒絕（不會被 trim 移除後才檢查）', () => {
    assert.deepEqual(parseAuthorSessionsRaw(withSession(' impl-1 ')), [' impl-1 ']);
    assert.deepEqual(parseAuthorSessions(withSession(' impl-1 ')), ['impl-1']);
    assert.throws(() => parseAuthorSessionsRaw(withSession('\ufeffimpl-1')), /作者段落含不可見字元或字元參照/);
    assert.equal(normalizeSessionId('\ufeffimpl-1'), null);
  });
});

describe('validateAuthorSection（v0.6.1；review-process.md 4.1「作者段落」、spec.md 12.4 第 4 點）', () => {
  const section = (...lines) => ['## 對應編號', '', '- 工作階段: 段落外不受限', '', '## 作者', '', ...lines, '', '## 上工檢查', '- [x] 一'].join('\n');

  // 行號為段落內的行號：標題的下一行為第 1 行（section() 在標題後有一個空行）
  test('看似「工作階段」卻不符逐字格式的行：作者段落格式不符，回報段落內行號與原文', () => {
    const cases = [
      ['- 工作階段: x', 3],
      ['**工作階段**：x', 3],
      ['> 工作階段：x', 3],
      ['- 工作阶段：x', 3],
      ['1. 工作階段：x', 3],
      ['- <b>工作階段</b>：x', 3],
      ['  + 工作階段：x', 3],
    ];
    for (const [line, n] of cases) {
      const r = validateAuthorSection(section('- 角色：實作 agent', line));
      assert.deepEqual(r, { ok: false, reason: `作者段落格式不符：第 ${n} 行 ${JSON.stringify(line)}` }, line);
    }
  });

  test('段落含字元參照或 X1～X4 的字元：作者段落含不可見字元或字元參照（不論在哪一行）', () => {
    for (const line of ['- 工作階段：impl&#45;1', '- 角色：實作&nbsp;agent', `- 工作階段：impl-1\u3164`, '- 角色：x\u200B', '- 角色：e\u0301', '- 角色：\u2800']) {
      const r = validateAuthorSection(section('- 工作階段：impl-1', line));
      assert.deepEqual(r, { ok: false, reason: '作者段落含不可見字元或字元參照' }, JSON.stringify(line));
    }
  });

  test('合法段落：取出識別原文；範本中只有註解的空值不採計、不失敗；角色行與段落外的行不影響', () => {
    const r = validateAuthorSection(section('- 角色：實作 agent', '- 工作階段：impl-1', '* 工作階段： test-1 ', '工作階段：plain-3', '- 工作階段：<!-- 例：x -->'));
    assert.deepEqual(r, { ok: true, sessions: ['impl-1', ' test-1 ', 'plain-3'] });
  });

  test('HTML 註解先移除：註解中的不合格式行與字元參照不影響；跨行註解移除後行號依移除後的段落計算', () => {
    assert.deepEqual(validateAuthorSection(section('<!-- 工作階段: x &amp;\n 說明 -->', '- 工作階段：impl-1')), { ok: true, sessions: ['impl-1'] });
    assert.equal(validateAuthorSection(section('<!-- a\nb -->', '- 工作階段: x')).reason, '作者段落格式不符：第 3 行 "- 工作階段: x"');
  });

  test('v0.6.2：段落前、標題下一行的多行註解移除後才計算行號（標題下一行為第 1 行）', () => {
    const before = ['<!-- 前面的\n多行\n註解 -->', '## 作者', '- 工作階段: x'].join('\n');
    assert.equal(validateAuthorSection(before).reason, '作者段落格式不符：第 1 行 "- 工作階段: x"');
    const after = ['## 作者', '<!-- 一\n二\n三 -->', '- 角色：實作 agent', '- 工作階段: x'].join('\n');
    assert.equal(validateAuthorSection(after).reason, '作者段落格式不符：第 3 行 "- 工作階段: x"');
  });

  test('v0.6.2：作者段落含 X1 字元（U+200B、控制字元）時失敗', () => {
    for (const ch of ['\u200B', '\u0001']) {
      assert.deepEqual(validateAuthorSection(`## 作者\n- 工作階段：impl-1\n- 角色：a${ch}`), { ok: false, reason: '作者段落含不可見字元或字元參照' });
    }
  });

  test('CRLF 換行的段落有效（CR 不視為控制字元）；沒有作者段落時 ok 且沒有識別', () => {
    assert.deepEqual(validateAuthorSection(section('- 工作階段：impl-1').replace(/\n/g, '\r\n')), { ok: true, sessions: ['impl-1'] });
    assert.deepEqual(validateAuthorSection('## 上工檢查\n- [x] 一'), { ok: true, sessions: [] });
    assert.deepEqual(validateAuthorSection(null), { ok: true, sessions: [] });
  });

  test('evaluatePrBody 使用同一函式：格式不符或含字元參照時失敗，訊息為該原因', () => {
    for (const [lines, re] of [
      [['- 角色：實作 agent', '- 工作階段: x'], /^作者段落格式不符：第 3 行 "- 工作階段: x"$/],
      [['- 角色：實作 agent', '**工作階段**：x'], /^作者段落格式不符：第 3 行/],
      [['- 角色：實作 agent', '> 工作階段：x'], /^作者段落格式不符：第 3 行/],
      [['- 角色：實作 agent', '- 工作阶段：x'], /^作者段落格式不符：第 3 行/],
      [['- 角色：實作 agent', '- 工作階段：impl&#45;1'], /^作者段落含不可見字元或字元參照$/],
      [['- 角色：實作 agent', '- 工作階段：impl-1\u3164'], /^作者段落含不可見字元或字元參照$/],
    ]) {
      const r = evaluatePrBody({ body: makeBody({ authors: lines }), readSkill });
      assert.equal(r.ok, false, lines.join(' / '));
      assert.equal(r.errors.length, 1, r.errors.join('\n'));
      assert.match(r.errors[0], re);
    }
  });

  test('evaluatePrBody：合法的 `- 工作階段：x`、範本中只有註解的空值、角色行維持現行判定', () => {
    assert.equal(evaluatePrBody({ body: makeBody({ authors: ['- 角色：實作 agent', '- 工作階段：impl-1', '- 角色：測試 agent', '- 工作階段：<!-- 例 -->'] }), readSkill }).ok, true);
    const empty = evaluatePrBody({ body: makeBody({ authors: ['- 角色：實作 agent', '- 工作階段：<!-- 例 -->'] }), readSkill });
    assert.deepEqual(empty.errors, ['「## 作者」段落沒有「工作階段：<識別>」']);
  });

  test('PR 範本（未填寫）仍判為失敗，作者段落本身不因範本的多行註解而判為格式不符', () => {
    const template = readFileSync(path.join(ROOT, '.github/pull_request_template.md'), 'utf8');
    assert.deepEqual(validateAuthorSection(template), { ok: true, sessions: [] });
    const r = evaluatePrBody({ body: template, readSkill: () => null });
    assert.equal(r.ok, false);
    assert.ok(r.errors.includes('「## 作者」段落沒有「工作階段：<識別>」'), r.errors.join('\n'));
  });
});
