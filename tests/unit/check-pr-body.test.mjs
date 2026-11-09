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

  test('只採計「## 作者」段落內、使用全形冒號的行', () => {
    const body = [
      '## 作者',
      '- 工作階段:half-width',
      '- 工作階段：ok-1',
      '## 其他',
      '- 工作階段：outside',
    ].join('\n');
    assert.deepEqual(parseAuthorSessions(body), ['ok-1']);
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
