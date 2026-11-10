// 模組單元測試：scripts/acceptance-reporter.mjs、scripts/acceptance-reporter-pw.mjs（module-test-standards.md M12、spec.md 12.2.1）。
// 事件序列取自本機實測的格式（Node.js 22.23.4、Playwright 1.63.0）；測試名稱與資料不含真實驗收編號。
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import acceptanceReporter, { collectResults } from '../../scripts/acceptance-reporter.mjs';
import PwReporter from '../../scripts/acceptance-reporter-pw.mjs';

const REPORTER = fileURLToPath(new URL('../../scripts/acceptance-reporter.mjs', import.meta.url));
const CWD = '/repo';
const F = '/repo/tests/acceptance/unit/x.test.mjs';
const ev = (type, data) => ({ type, data: { file: F, ...data } });
const start = (name, nesting, line, column = 1) => ev('test:start', { name, nesting, line, column });
const pass = (name, nesting, line, extra = {}, column = 1) =>
  ev('test:pass', { name, nesting, line, column, details: { type: 'test' }, ...extra });
const diag = (nesting, line, message, column = 1) => ev('test:diagnostic', { nesting, line, column, message });

describe('node:test reporter：collectResults', () => {
  test('通過、失敗、略過、todo 與 suite 各自記錄；file 為相對於 cwd 的路徑', () => {
    const r = collectResults([
      start('a', 0, 1), pass('a', 0, 1),
      start('b', 0, 2), ev('test:fail', { name: 'b', nesting: 0, line: 2, column: 1, details: { type: 'test' } }),
      start('c', 0, 3), pass('c', 0, 3, { skip: true }),
      start('d', 0, 4), pass('d', 0, 4, { skip: '理由' }),
      start('e', 0, 5), pass('e', 0, 5, { todo: true }),
      start('S', 0, 6), pass('S', 0, 6, { details: { type: 'suite' } }),
    ], CWD);
    assert.deepEqual(r.map((x) => [x.name, x.event, x.skip, x.todo, x.kind, x.file]), [
      ['a', 'test:pass', false, false, 'test', 'tests/acceptance/unit/x.test.mjs'],
      ['b', 'test:fail', false, false, 'test', 'tests/acceptance/unit/x.test.mjs'],
      ['c', 'test:pass', true, false, 'test', 'tests/acceptance/unit/x.test.mjs'],
      ['d', 'test:pass', true, false, 'test', 'tests/acceptance/unit/x.test.mjs'],
      ['e', 'test:pass', false, true, 'test', 'tests/acceptance/unit/x.test.mjs'],
      ['S', 'test:pass', false, false, 'suite', 'tests/acceptance/unit/x.test.mjs'],
    ]);
  });

  test('外層 describe 路徑由 test:start 的 nesting 推得（巢狀、兄弟區塊）', () => {
    const r = collectResults([
      start('D', 0, 1), start('in', 1, 1, 20), pass('in', 1, 1, {}, 20),
      start('E', 1, 2), start('deep', 2, 2, 30), pass('deep', 2, 2, {}, 30),
      pass('E', 1, 2, { details: { type: 'suite' } }), pass('D', 0, 1, { details: { type: 'suite' } }),
      start('F', 0, 3), start('x', 1, 3, 9), pass('x', 1, 3, {}, 9),
    ], CWD);
    const m = Object.fromEntries(r.map((x) => [x.name, x.path]));
    assert.deepEqual(m, { in: ['D'], deep: ['D', 'E'], E: ['D'], D: [], x: ['F'] });
  });

  test('acceptance-assertions 診斷以 file＋line＋column 對應到測試；同檔兩個測試不混淆', () => {
    const r = collectResults([
      start('a', 0, 1), pass('a', 0, 1), diag(0, 1, 'acceptance-assertions 3 0'),
      start('b', 0, 2), pass('b', 0, 2), diag(0, 2, 'acceptance-assertions 1 1'),
      start('c', 0, 3), pass('c', 0, 3),
    ], CWD);
    assert.deepEqual(r.map((x) => x.assertions), [{ run: 3, failed: 0 }, { run: 1, failed: 1 }, null]);
  });

  test('同一位置的多個測試（迴圈產生）依事件順序各自對應', () => {
    const r = collectResults([
      start('n1', 0, 5), pass('n1', 0, 5), diag(0, 5, 'acceptance-assertions 1 0'),
      start('n2', 0, 5), pass('n2', 0, 5), diag(0, 5, 'acceptance-assertions 2 0'),
      start('n3', 0, 5), pass('n3', 0, 5),
    ], CWD);
    assert.deepEqual(r.map((x) => x.assertions), [{ run: 1, failed: 0 }, { run: 2, failed: 0 }, null]);
  });

  test('同一測試收到兩則診斷時累加；其他診斷（彙總、格式不符）不採計', () => {
    const r = collectResults([
      start('a', 0, 1), pass('a', 0, 1),
      diag(0, 1, 'acceptance-assertions 1 0'), diag(0, 1, 'acceptance-assertions 2 1'),
      diag(0, 1, 'acceptance-assertions x 0'), diag(0, 1, '其他訊息'),
      { type: 'test:diagnostic', data: { nesting: 0, message: 'tests 1' } },
    ], CWD);
    assert.deepEqual(r[0].assertions, { run: 3, failed: 1 });
  });

  test('reporter 在全部事件後輸出 JSON Lines，最後一行為 end 與筆數', async () => {
    async function* source() {
      yield start('a', 0, 1);
      yield pass('a', 0, 1);
      yield diag(0, 1, 'acceptance-assertions 1 0');
    }
    const out = [];
    for await (const chunk of acceptanceReporter(source())) out.push(chunk);
    const lines = out.join('').trim().split('\n').map((l) => JSON.parse(l));
    assert.equal(lines.length, 2);
    assert.equal(lines[0].type, 'result');
    assert.deepEqual(lines[0].assertions, { run: 1, failed: 0 });
    assert.deepEqual(lines[1], { type: 'end', runner: 'node', count: 1 });
  });

  test('實際以 node --test 執行（本機格式核對）：略過區塊內的測試不出現；hook 診斷對應到測試', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'reporter-'));
    try {
      writeFileSync(path.join(dir, 'count.mjs'), [
        "import { beforeEach, afterEach } from 'node:test';",
        'let run = 0;',
        'beforeEach(() => { run = 0; });',
        "afterEach((t) => { t.diagnostic(`acceptance-assertions ${run} 0`); });",
        'export const check = () => { run++; };',
      ].join('\n'));
      writeFileSync(path.join(dir, 'x.test.mjs'), [
        "import { test, describe } from 'node:test';",
        "import { check } from './count.mjs';",
        "test('one', () => { check(); check(); });",
        "test('zero', () => {});",
        "test.skip('skel', () => {});",
        "describe('blk', { skip: true }, () => { test('hidden', () => {}); });",
        "describe('D', () => { test('in', () => { check(); }); });",
      ].join('\n'));
      mkdirSync(path.join(dir, 'out'));
      // 在 node --test 之內啟動的子行程會繼承 NODE_TEST_CONTEXT 而改向父行程回報、不使用指定的 reporter，須移除
      const env = { ...process.env };
      delete env.NODE_TEST_CONTEXT;
      const r = spawnSync(process.execPath, ['--test', `--test-reporter=${REPORTER}`, '--test-reporter-destination=out/r.jsonl', 'x.test.mjs'], { cwd: dir, encoding: 'utf8', env });
      assert.equal(r.status, 0, r.stderr);
      const lines = readFileSync(path.join(dir, 'out/r.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
      const byName = Object.fromEntries(lines.filter((l) => l.type === 'result').map((l) => [l.name, l]));
      assert.deepEqual(Object.keys(byName).sort(), ['D', 'blk', 'in', 'one', 'skel', 'zero']);
      assert.equal(byName.one.file, 'x.test.mjs');
      assert.deepEqual(byName.one.assertions, { run: 2, failed: 0 });
      assert.deepEqual(byName.zero.assertions, { run: 0, failed: 0 });
      assert.equal(byName.skel.skip, true);
      assert.equal(byName.skel.assertions, null);
      assert.equal(byName.blk.kind, 'suite');
      assert.equal(byName.blk.skip, true);
      assert.deepEqual(byName.in.path, ['D']);
      assert.deepEqual(byName.in.assertions, { run: 1, failed: 0 });
      assert.deepEqual(lines.at(-1), { type: 'end', runner: 'node', count: 6 });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ───────────────────────── Playwright reporter ─────────────────────────

/** 以 Playwright reporter API 的形狀建立假的 suite／test（只含 reporter 使用的欄位）。 */
function fakeSuite(cwd, specs) {
  const root = { type: 'root', title: '', parent: null };
  const project = { type: 'project', title: 'chromium', parent: root, project: () => ({ name: 'chromium' }) };
  const fileSuite = { type: 'file', title: 'x.spec.mjs', parent: project, project: () => ({ name: 'chromium' }) };
  const tests = specs.map((s, k) => {
    let parent = fileSuite;
    for (const d of s.describes ?? []) {
      parent = { type: 'describe', title: d, parent, project: () => ({ name: 'chromium' }) };
    }
    return {
      id: `t${k}`,
      title: s.title,
      parent,
      location: { file: path.join(cwd, 'tests/acceptance/e2e/x.spec.mjs'), line: k + 1, column: 1 },
      expectedStatus: s.expectedStatus ?? 'passed',
      outcome: () => s.outcome ?? 'expected',
      results: (s.results ?? ['passed']).map((status) => ({ status })),
      annotations: (s.annotations ?? []).map((type) => ({ type })),
    };
  });
  return { tests, suite: { allTests: () => tests } };
}

describe('Playwright reporter', () => {
  test('onStepEnd 只計數 category 為 expect 的步驟，帶 error 者計為失敗；沒有步驟的測試為 0', () => {
    const cwd = mkdtempSync(path.join(tmpdir(), 'pw-'));
    try {
      const { tests, suite } = fakeSuite(cwd, [{ title: 'a' }, { title: 'b', describes: ['D', 'E'] }, { title: 'c' }]);
      const rep = new PwReporter({ outputFile: path.join(cwd, 'out/r.jsonl') });
      rep.cwd = cwd;
      rep.onBegin({}, suite);
      rep.onStepEnd(tests[0], {}, { category: 'expect' });
      rep.onStepEnd(tests[0], {}, { category: 'expect', error: { message: 'x' } });
      rep.onStepEnd(tests[0], {}, { category: 'test.step' });
      rep.onStepEnd(tests[0], {}, { category: 'pw:api' });
      rep.onStepEnd(tests[1], {}, { category: 'expect' });
      const { out } = rep.records();
      assert.deepEqual(out.map((r) => r.assertions), [{ run: 2, failed: 1 }, { run: 1, failed: 0 }, { run: 0, failed: 0 }]);
      assert.deepEqual(out[1].path, ['D', 'E']);
      assert.equal(out[0].file, 'tests/acceptance/e2e/x.spec.mjs');
      assert.equal(out[0].project, 'chromium');
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test('記錄 expectedStatus、outcome、每次結果與註記；onEnd 寫入結束行；全域錯誤另列', () => {
    const cwd = mkdtempSync(path.join(tmpdir(), 'pw-'));
    try {
      const { suite } = fakeSuite(cwd, [
        { title: 'fl', expectedStatus: 'failed', outcome: 'expected', results: ['failed'], annotations: ['fail'] },
        { title: 'sk', expectedStatus: 'skipped', outcome: 'skipped', results: ['skipped'], annotations: ['skip'] },
      ]);
      const file = path.join(cwd, 'out/sub/r.jsonl');
      const rep = new PwReporter({ outputFile: file });
      rep.cwd = cwd;
      rep.onBegin({}, suite);
      rep.onError({ message: 'TypeError: x is not a function\n  at …' });
      rep.onEnd();
      const lines = readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
      assert.deepEqual(lines.map((l) => l.type), ['result', 'result', 'error', 'end']);
      assert.equal(lines[0].expectedStatus, 'failed');
      assert.equal(lines[0].outcome, 'expected');
      assert.deepEqual(lines[0].results, ['failed']);
      assert.deepEqual(lines[0].annotations, ['fail']);
      assert.deepEqual(lines[3], { type: 'end', runner: 'playwright', count: 2 });
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test('onBegin 先清空結果檔（中途中止時不會留下上一次的結果）', () => {
    const cwd = mkdtempSync(path.join(tmpdir(), 'pw-'));
    try {
      const file = path.join(cwd, 'r.jsonl');
      writeFileSync(file, '{"type":"end","runner":"playwright","count":0}\n');
      const rep = new PwReporter({ outputFile: file });
      rep.onBegin({}, fakeSuite(cwd, []).suite);
      assert.equal(readFileSync(file, 'utf8'), '');
      assert.equal(rep.printsToStdio(), false);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
