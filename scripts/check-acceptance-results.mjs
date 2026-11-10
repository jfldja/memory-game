// 驗收測試執行結果檢查（spec.md 12.2.1）。只用 Node.js 內建模組。
//
// 用法：node scripts/check-acceptance-results.mjs --layer unit|e2e [--no-skip] <結果檔>...
//   結果檔：scripts/acceptance-reporter.mjs（node:test）或 scripts/acceptance-reporter-pw.mjs（Playwright）的輸出。
//   e2e 層傳入同一引擎的一般與 realtime 兩個結果檔，合併判定。
//   結束代碼 0：通過；1：有任一項判定失敗；2：參數錯誤、結果檔不存在或不完整、需求文件解析失敗
//
// 判定（spec.md 12.2.1；下列任一項成立即失敗，列出檔名與名稱）：
//   1. 預期失敗或失敗：Playwright expectedStatus 不是 passed、outcome 不是 expected、任何一次結果不是 passed；
//      node:test 的 test:fail。不論是否 --no-skip
//   2. 非骨架的略過：結果為略過，但同一檔案沒有同名的最上層骨架宣告（todo 一律視為非骨架）
//   3. 骨架略過（只在 --no-skip）
//   4. 沒有執行：靜態掃描到的每個測試在同一檔案的結果中至少有一筆名稱相符者；每個 describe 名稱出現在
//      某筆結果的外層路徑中；該層每個測試檔至少有一筆結果。樣板名稱以第一個 ${ 之前的固定文字為前綴比對；
//      前綴去除前後空白後為空時不比對任何結果（v0.6.1；12.2 第 9d 點在靜態檢查就拒絕，本項是第二道）
//   5. 編號沒有通過的執行結果（只在 --no-skip）
//   6. 沒有執行任何斷言，或有失敗的斷言被吞掉：每筆非略過且通過的結果，斷言執行次數 ≥ 1、失敗次數為 0；
//      缺少計數資料也失敗
// 另外：Playwright 回報的全域錯誤（例：測試檔載入失敗）一律失敗。
//
// 判定邏輯為純函式 evaluateResults，供模組單元測試呼叫；讀檔與結束程式只在 main 中。
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCheck, containsId, ACCEPTANCE_DIR } from './check-acceptance-ids.mjs';

export const LAYERS = Object.freeze(['unit', 'e2e']);

/**
 * 解析一個結果檔（JSON Lines）。最後一行必須是 {"type":"end","count":n} 且 n 等於結果筆數。
 * @param {string} text
 * @returns {{ records: object[], errors: object[] }}
 */
export function parseResultFile(text) {
  const lines = String(text).split('\n').filter((l) => l.trim() !== '');
  if (lines.length === 0) throw new Error('結果檔是空的（reporter 沒有完成）');
  const items = lines.map((l, k) => {
    try {
      return JSON.parse(l);
    } catch {
      throw new Error(`結果檔第 ${k + 1} 行不是 JSON`);
    }
  });
  const end = items[items.length - 1];
  if (!end || end.type !== 'end') throw new Error('結果檔沒有結束行（reporter 沒有完成）');
  const records = items.filter((x) => x.type === 'result');
  const errors = items.filter((x) => x.type === 'error');
  if (records.length + errors.length !== items.length - 1) throw new Error('結果檔含無法辨識的行');
  if (end.count !== records.length) throw new Error(`結果檔筆數不符：結束行為 ${end.count}，實際 ${records.length}`);
  return { records, errors };
}

/** 結果紀錄的狀態：'passed'｜'failed'｜'skipped'（與判定第 1、2 項對應）。 */
export function statusOf(r) {
  if (r.runner === 'playwright') {
    if (r.expectedStatus === 'skipped') {
      return Array.isArray(r.results) && r.results.every((s) => s === 'skipped') ? 'skipped' : 'failed';
    }
    const ok = r.expectedStatus === 'passed' && r.outcome === 'expected' &&
      Array.isArray(r.results) && r.results.length > 0 && r.results.every((s) => s === 'passed');
    return ok ? 'passed' : 'failed';
  }
  if (r.runner === 'node') {
    if (r.todo || r.skip) return 'skipped';
    return r.event === 'test:pass' ? 'passed' : 'failed';
  }
  return 'failed';
}

/**
 * 樣板名稱的固定前綴（第一個 `${` 之前的文字）；不是含 `${` 的樣板時為 null。
 * 前綴去除前後空白後為空時回傳 ''（v0.6.1：不以前綴比對任何結果）。
 */
function templatePrefixOf(staticTest) {
  if (staticTest.literal !== 'template' || !staticTest.name.includes('${')) return null;
  const prefix = staticTest.name.slice(0, staticTest.name.indexOf('${'));
  return prefix.trim() === '' ? '' : prefix;
}

/** 以前綴比對：前綴為空（含只有空白）時不與任何名稱相符。 */
function prefixMatches(prefix, name) {
  return prefix !== '' && typeof name === 'string' && name.startsWith(prefix);
}

function staticNameMatches(staticTest, name) {
  if (typeof name !== 'string') return false;
  const prefix = templatePrefixOf(staticTest);
  if (prefix !== null) return prefixMatches(prefix, name);
  return name === staticTest.name;
}

const label = (r) => JSON.stringify([...(r.path ?? []), r.name].join(' › '));

/**
 * @param {{
 *   layer: 'unit'|'e2e',
 *   staticTests: Array<{ file: string, name: string, kind: 'test'|'describe', skeleton: boolean, literal: string, path: Array<string|null> }>,
 *   staticFiles: string[],
 *   results: object[],
 *   errors?: object[],
 *   noSkip?: boolean,
 *   requiredIds?: string[],
 * }} input staticTests／staticFiles 只含該層目錄（tests/acceptance/<layer>/）
 * @returns {{ ok: boolean, failures: Array<{ item: number|string, file: string|null, name: string|null, message: string }>, counts: object }}
 */
export function evaluateResults({ layer, staticTests, staticFiles, results, errors = [], noSkip = false, requiredIds = [] }) {
  const failures = [];
  const fail = (item, r, message) => failures.push({ item, file: r?.file ?? null, name: r?.name ?? null, message });

  for (const e of errors) fail('錯誤', null, `執行器回報錯誤：${JSON.stringify(String(e.message ?? '').split('\n')[0])}`);

  const skeletonOf = (r) =>
    staticTests.some((s) => s.skeleton && s.file === r.file && s.name === r.name) && (r.path ?? []).length === 0;

  let passed = 0;
  let skipped = 0;
  for (const r of results) {
    const isSuite = r.kind === 'suite';
    const st = statusOf(r);
    if (st === 'failed') {
      fail(1, r, `${label(r)} 失敗或預期失敗（${r.runner === 'playwright'
        ? `expectedStatus=${r.expectedStatus}、outcome=${r.outcome}、results=${JSON.stringify(r.results)}`
        : r.event}）`);
      continue;
    }
    if (st === 'skipped') {
      skipped++;
      if (r.todo) fail(2, r, `${label(r)} 為 todo（不允許）`);
      else if (isSuite || !skeletonOf(r)) fail(2, r, `${label(r)} 被略過，但不是骨架宣告`);
      else if (noSkip) fail(3, r, `${label(r)} 是略過的骨架（--no-skip）`);
      continue;
    }
    if (isSuite) continue;
    passed++;
    const a = r.assertions;
    if (!a || typeof a.run !== 'number' || typeof a.failed !== 'number') {
      fail(6, r, `${label(r)} 沒有斷言計數（無瀏覽器層須經 tests/support/assertions.mjs 斷言）`);
    } else if (a.failed > 0) {
      fail(6, r, `${label(r)} 有 ${a.failed} 個失敗的斷言被吞掉，測試卻回報通過`);
    } else if (a.run < 1) {
      fail(6, r, `${label(r)} 通過但沒有執行任何斷言`);
    }
  }

  // 4. 沒有執行
  for (const f of staticFiles) {
    if (!results.some((r) => r.file === f)) fail(4, { file: f, name: null }, '這個測試檔沒有任何執行結果');
  }
  for (const s of staticTests) {
    const inFile = results.filter((r) => r.file === s.file);
    if (s.kind === 'describe') {
      const prefix = templatePrefixOf(s);
      if (prefix !== null) {
        if (!inFile.some((r) => (r.path ?? []).some((p) => prefixMatches(prefix, p)) || (r.kind === 'suite' && staticNameMatches(s, r.name)))) {
          fail(4, s, `describe ${JSON.stringify(s.name)} 沒有出現在任何執行結果中`);
        }
      } else if (!inFile.some((r) => (r.path ?? []).includes(s.name) || (r.kind === 'suite' && r.name === s.name))) {
        fail(4, s, `describe ${JSON.stringify(s.name)} 沒有出現在任何執行結果中`);
      }
    } else if (!inFile.some((r) => r.kind !== 'suite' && staticNameMatches(s, r.name))) {
      fail(4, s, `測試 ${JSON.stringify(s.name)} 沒有執行結果（略過區塊、名稱過濾或沒有被執行）`);
    }
  }

  // 5. 編號沒有通過的執行結果（--no-skip）
  if (noSkip) {
    const ids = requiredIds.filter((id) => staticTests.some((s) => containsId(s.name, id)));
    for (const id of ids) {
      const ok = results.some((r) => r.kind !== 'suite' && statusOf(r) === 'passed' &&
        containsId([...(r.path ?? []), r.name].join(' '), id));
      if (!ok) fail(5, { file: null, name: id }, `${id} 沒有任何通過的執行結果`);
    }
  }

  return { ok: failures.length === 0, failures, counts: { results: results.length, passed, skipped, layer } };
}

/** 結果紀錄的 file 正規化為版本庫相對路徑。 */
function normalizeFile(file, root, cwd) {
  if (typeof file !== 'string') return file;
  const abs = path.isAbsolute(file) ? file : path.resolve(cwd, file);
  return path.relative(root, abs).split(path.sep).join('/');
}

export function parseArgs(argv) {
  const out = { layer: null, noSkip: false, files: [] };
  for (let k = 0; k < argv.length; k++) {
    const a = argv[k];
    if (a === '--layer') out.layer = argv[++k] ?? null;
    else if (a === '--no-skip') out.noSkip = true;
    else if (a.startsWith('--')) throw new Error(`不認得的參數 ${JSON.stringify(a)}`);
    else out.files.push(a);
  }
  if (!LAYERS.includes(out.layer)) throw new Error('需要 --layer unit 或 --layer e2e');
  if (out.files.length === 0) throw new Error('需要至少一個結果檔');
  return out;
}

/**
 * 外層：讀取結果檔與同一份原始碼的靜態掃描，判定。
 * @param {{ root: string, argv: string[], cwd?: string }} options
 */
export function runResultsCheck({ root, argv, cwd = process.cwd() }) {
  const args = parseArgs(argv);
  const results = [];
  const errors = [];
  for (const f of args.files) {
    const p = path.resolve(cwd, f);
    if (!existsSync(p)) throw new Error(`結果檔不存在：${JSON.stringify(f)}`);
    let parsed;
    try {
      parsed = parseResultFile(readFileSync(p, 'utf8'));
    } catch (err) {
      throw new Error(`${JSON.stringify(f)}：${err.message}`);
    }
    for (const r of parsed.records) results.push({ ...r, file: normalizeFile(r.file, root, cwd) });
    errors.push(...parsed.errors);
  }
  const scan = runCheck({ root });
  const dir = `tests/${ACCEPTANCE_DIR}/${args.layer}/`;
  const staticTests = scan.tests.filter((t) => t.file.startsWith(dir));
  const staticFiles = scan.files.filter((f) => f.startsWith(dir));
  if (staticFiles.length === 0) throw new Error(`${dir} 下沒有任何驗收測試檔`);
  const r = evaluateResults({
    layer: args.layer,
    staticTests,
    staticFiles,
    results,
    errors,
    noSkip: args.noSkip,
    requiredIds: scan.requiredIds,
  });
  return { ...r, staticTests, staticFiles, args };
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  let r;
  try {
    r = runResultsCheck({ root, argv: process.argv.slice(2) });
  } catch (err) {
    console.error(`acceptance-results：${err.message}`);
    process.exit(2);
  }
  const { counts } = r;
  console.log(
    `acceptance-results：${counts.layer} 層，結果 ${counts.results} 筆（通過 ${counts.passed}、略過 ${counts.skipped}）；` +
      `靜態掃描測試檔 ${r.staticFiles.length} 個、名稱 ${r.staticTests.length} 個${r.args.noSkip ? '；--no-skip' : ''}`,
  );
  // 名稱以 JSON.stringify 輸出，且每行以固定前綴開頭（不會在行首形成工作流程指令）
  for (const f of r.failures) {
    console.error(`acceptance-results：第 ${f.item} 項：${f.file ?? '-'}  ${f.message}`);
  }
  if (!r.ok) process.exit(1);
  console.log('acceptance-results：通過');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
