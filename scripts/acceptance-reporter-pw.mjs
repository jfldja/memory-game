// Playwright 自訂 reporter：輸出驗收測試的執行結果與斷言計數（spec.md 12.2.1、12.3）。只用 Node.js 內建模組。
//
// playwright.config.mjs 以 ['./scripts/acceptance-reporter-pw.mjs', { outputFile }] 與 list reporter 並用。
// 輸出（JSON Lines）：每個測試一行，載入錯誤等全域錯誤各一行，最後一行為 {"type":"end","count":<測試筆數>}。
//   { type: 'result', runner: 'playwright', project, file, line, column, name, path,
//     expectedStatus, outcome, results: [<每次執行的 status>], annotations: [<type>], assertions: { run, failed } }
//   { type: 'error', message }
// - file：相對於目前工作目錄的 posix 路徑；path：外層 describe 名稱。
// - assertions：onStepEnd 中 category 為 'expect' 的步驟數，與其中帶 error 者（含巢狀於 test.step 內的）。
//   本機實測（Playwright 1.63）：空本體 0、第一個斷言前 return 0、expect.soft 1、expect.poll 2、
//   被 try/catch 吞掉的失敗斷言 1 且帶 error（測試狀態仍為 passed）。
// - 輸出檔不要放在 Playwright 的 outputDir（預設 test-results/）：每次執行開始時該目錄會被清空，
//   一般與 realtime 兩次執行的結果會互相刪除。
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const DEFAULT_OUTPUT = 'acceptance-results/playwright.jsonl';

function relFile(file, cwd) {
  return path.relative(cwd, file).split(path.sep).join('/');
}

/** 外層 describe 名稱（由內而外收集後反轉）。 */
function describePath(test) {
  const out = [];
  for (let s = test.parent; s; s = s.parent) if (s.type === 'describe') out.push(s.title);
  return out.reverse();
}

export default class AcceptanceReporter {
  /** @param {{ outputFile?: string }} [options] */
  constructor(options = {}) {
    this.outputFile = options.outputFile || DEFAULT_OUTPUT;
    this.counts = new Map();
    this.errors = [];
    this.suite = null;
    this.cwd = process.cwd();
  }

  printsToStdio() {
    return false;
  }

  onBegin(config, suite) {
    this.suite = suite;
    // 先清空：執行中途中止時檔案沒有 end 行，check-acceptance-results 會判定失敗，不會讀到上一次的結果
    mkdirSync(path.dirname(path.resolve(this.outputFile)), { recursive: true });
    writeFileSync(this.outputFile, '');
  }

  onStepEnd(test, result, step) {
    if (step.category !== 'expect') return;
    const c = this.counts.get(test.id) ?? { run: 0, failed: 0 };
    c.run++;
    if (step.error) c.failed++;
    this.counts.set(test.id, c);
  }

  onError(error) {
    this.errors.push(String(error?.message ?? error));
  }

  /** 組出輸出紀錄（單元測試以假的 suite 呼叫）。 */
  records() {
    const tests = this.suite ? this.suite.allTests() : [];
    const out = tests.map((t) => ({
      type: 'result',
      runner: 'playwright',
      project: t.parent?.project?.()?.name ?? null,
      file: relFile(t.location.file, this.cwd),
      line: t.location.line,
      column: t.location.column,
      name: t.title,
      path: describePath(t),
      expectedStatus: t.expectedStatus,
      outcome: t.outcome(),
      results: t.results.map((r) => r.status),
      annotations: t.annotations.map((a) => a.type),
      assertions: this.counts.get(t.id) ?? { run: 0, failed: 0 },
    }));
    return { out, errors: this.errors.map((message) => ({ type: 'error', runner: 'playwright', message })) };
  }

  onEnd() {
    const { out, errors } = this.records();
    const lines = [...out, ...errors, { type: 'end', runner: 'playwright', count: out.length }];
    mkdirSync(path.dirname(path.resolve(this.outputFile)), { recursive: true });
    writeFileSync(this.outputFile, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
  }
}
