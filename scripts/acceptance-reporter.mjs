// node:test 自訂 reporter：輸出驗收測試的執行結果與斷言計數（spec.md 12.2.1）。只用 Node.js 內建模組。
//
// 用法（CI 的 unit job；與 spec reporter 並用，各自指定輸出；輸出目錄必須先存在）：
//   node --test --test-reporter=spec --test-reporter-destination=stdout \
//     --test-reporter=./scripts/acceptance-reporter.mjs --test-reporter-destination=acceptance-results/unit.jsonl \
//     'tests/acceptance/unit/**/*.test.mjs'
//
// 輸出（JSON Lines）：每個 test:pass／test:fail 一行，最後一行為 {"type":"end","count":<筆數>}。
//   { type: 'result', runner: 'node', file, line, column, name, path, kind: 'test'|'suite',
//     event: 'test:pass'|'test:fail', skip: boolean, todo: boolean, assertions: { run, failed } | null }
// - file：相對於目前工作目錄的 posix 路徑。
// - path：外層 describe 名稱（由 test:start 事件的 nesting 推得）。
// - assertions：tests/support/assertions.mjs 於 afterEach 以 t.diagnostic('acceptance-assertions <執行> <失敗>')
//   回報的次數（spec.md 12.2.1 第 6 項）；沒有收到時為 null。實測（Node.js 22）：診斷事件在該測試的
//   test:pass 之後、下一個測試之前送出，帶相同的 file、line、column；同一位置的多個測試（例：迴圈產生）
//   依事件順序對應到該位置最近的一筆結果。
// 全部事件收齊後才輸出，因為診斷事件晚於結果事件。
import path from 'node:path';

export const DIAGNOSTIC = /^acceptance-assertions (\d+) (\d+)$/;

function relFile(file, cwd) {
  if (typeof file !== 'string' || file === '') return null;
  let f = file;
  if (f.startsWith('file://')) f = new URL(f).pathname;
  return path.isAbsolute(f) ? path.relative(cwd, f).split(path.sep).join('/') : f.split(path.sep).join('/');
}

/**
 * 把 node:test 的事件序列轉為結果紀錄（純函式；reporter 與單元測試共用）。
 * @param {Iterable<{ type: string, data: any }>} events
 * @param {string} [cwd]
 * @returns {object[]}
 */
export function collectResults(events, cwd = process.cwd()) {
  const stacks = new Map(); // file → 依 nesting 的名稱
  const records = [];
  const byKey = new Map(); // file:line:column:nesting → 依序的紀錄
  for (const { type, data = {} } of events) {
    const file = relFile(data.file, cwd);
    if (type === 'test:start') {
      const stack = stacks.get(file) ?? [];
      stack.length = data.nesting;
      stack[data.nesting] = data.name;
      stacks.set(file, stack);
    } else if (type === 'test:pass' || type === 'test:fail') {
      const stack = stacks.get(file) ?? [];
      const rec = {
        type: 'result',
        runner: 'node',
        file,
        line: data.line ?? null,
        column: data.column ?? null,
        name: data.name,
        path: stack.slice(0, data.nesting),
        kind: data.details?.type === 'suite' ? 'suite' : 'test',
        event: type,
        skip: data.skip !== undefined && data.skip !== false,
        todo: data.todo !== undefined && data.todo !== false,
        assertions: null,
      };
      records.push(rec);
      const key = `${file}:${data.line}:${data.column}:${data.nesting}`;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(rec);
    } else if (type === 'test:diagnostic') {
      const m = DIAGNOSTIC.exec(String(data.message ?? ''));
      if (!m || !file) continue;
      const list = byKey.get(`${file}:${data.line}:${data.column}:${data.nesting}`);
      if (!list || list.length === 0) continue;
      const run = Number(m[1]);
      const failed = Number(m[2]);
      // 診斷事件緊接在該測試的結果之後：對應到同一位置最近的一筆。
      // 同一個測試收到多則（例：輔助模組被以不同路徑載入兩次）時累加
      const target = list[list.length - 1];
      target.assertions = target.assertions
        ? { run: target.assertions.run + run, failed: target.assertions.failed + failed }
        : { run, failed };
    }
  }
  return records;
}

export default async function* acceptanceReporter(source) {
  const events = [];
  for await (const event of source) events.push(event);
  const records = collectResults(events);
  for (const r of records) yield `${JSON.stringify(r)}\n`;
  yield `${JSON.stringify({ type: 'end', runner: 'node', count: records.length })}\n`;
}
