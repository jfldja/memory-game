// EQ-4 編號覆蓋檢查（spec.md 12.2）。只用 Node.js 內建模組。
//
// 用法：node scripts/check-acceptance-ids.mjs [--no-skip]
//   結束代碼 0：全部必要編號都出現在測試名稱中（且 --no-skip 時沒有任何略過）
//   結束代碼 1：缺少編號，或 --no-skip 時有略過
//   結束代碼 2：需求文件或補充驗收檔解析失敗
//
// 判定邏輯全部是可匯出的純函式，供模組單元測試與 AC-EQ-4 驗收測試呼叫。
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** EQ-4 的例外：NFR-1 不需要獨立測試。 */
export const EXEMPT_IDS = Object.freeze(['NFR-1']);

/** 收集名稱的呼叫：base 加上可選的修飾。 */
export const TEST_BASES = Object.freeze(['test', 'it', 'describe', 'test.describe']);
export const TEST_MODIFIERS = Object.freeze(['skip', 'fixme', 'todo', 'only']);
/** 讓該呼叫被視為略過的修飾。 */
export const SKIP_MODIFIERS = Object.freeze(['skip', 'fixme', 'todo']);
/** 讓該呼叫被視為略過的選項鍵（`{ skip: … }`、`{ todo: … }`）。 */
export const SKIP_OPTION_KEYS = Object.freeze(['skip', 'todo']);

// ───────────────────────── 需求文件解析 ─────────────────────────

/**
 * 取出某個標題（例：'### 10.2'）到下一個同級或更高標題之間的行。
 * @returns {string[]|null}
 */
function sectionLines(text, headingPrefix) {
  const lines = text.split(/\r?\n/);
  const level = headingPrefix.match(/^#+/)[0].length;
  const start = lines.findIndex((l) => l.startsWith(headingPrefix));
  if (start < 0) return null;
  const out = [];
  for (let k = start + 1; k < lines.length; k++) {
    const m = lines[k].match(/^(#+)\s/);
    if (m && m[1].length <= level) break;
    out.push(lines[k]);
  }
  return out;
}

function splitRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|')) return null;
  return trimmed.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

const AC_HEADING = /^\*\*(AC-[A-Z]+-\d+(?:、AC-[A-Z]+-\d+)*)\*\*（([^）]+)）/;

/**
 * 從需求文件解析 EQ-4 要求的編號（spec.md 12.2 第 1 點）。
 * - 第 10.2 節以 `**AC-…**（自動）` 或 `（自動＋人工）` 開頭的標題，一個標題可含多個以「、」分隔的編號。
 * - 第 13 節追溯矩陣中優先為 M、驗證為「自動」的 NFR，排除 NFR-1。
 * @param {string} text 需求文件全文
 * @returns {{ acceptanceIds: string[], nfrIds: string[] }}
 */
export function parseRequiredIds(text) {
  const acSection = sectionLines(text, '### 10.2');
  if (!acSection) throw new Error('需求文件中找不到「### 10.2」節');
  const acceptanceIds = [];
  for (const line of acSection) {
    const m = line.match(AC_HEADING);
    if (!m) continue;
    const method = m[2];
    if (method === '自動' || method === '自動＋人工') {
      acceptanceIds.push(...m[1].split('、'));
    }
  }

  const matrix = sectionLines(text, '## 13.');
  if (!matrix) throw new Error('需求文件中找不到「## 13.」節（需求追溯矩陣）');
  let header = null;
  const nfrIds = [];
  for (const line of matrix) {
    const cells = splitRow(line);
    if (!cells) continue;
    if (!header) {
      header = cells;
      continue;
    }
    if (cells.every((c) => /^:?-+:?$/.test(c))) continue;
    const priority = cells[header.indexOf('優先')];
    const verify = cells[header.indexOf('驗證')];
    const id = cells[0];
    if (/^NFR-\d+$/.test(id) && priority === 'M' && verify === '自動' && !EXEMPT_IDS.includes(id)) {
      nfrIds.push(id);
    }
  }
  if (!header || header.indexOf('優先') < 0 || header.indexOf('驗證') < 0) {
    throw new Error('需求追溯矩陣缺少「優先」或「驗證」欄');
  }
  if (acceptanceIds.length === 0) throw new Error('第 10.2 節沒有解析到任何含「自動」的驗收編號');
  return { acceptanceIds: unique(acceptanceIds), nfrIds: unique(nfrIds) };
}

/**
 * 讀取設計補充驗收（spec.md 12.2 第 2 點）：`enforced: true` 的項目編號。
 * @param {string} jsonText supplementary-acceptance.json 的內容
 * @returns {string[]}
 */
export function parseSupplementaryIds(jsonText) {
  const data = JSON.parse(jsonText);
  if (!data || !Array.isArray(data.items)) throw new Error('補充驗收檔缺少 items 陣列');
  return unique(
    data.items.filter((it) => it && it.enforced === true).map((it) => {
      if (typeof it.id !== 'string' || !it.id) throw new Error('補充驗收項目缺少 id');
      return it.id;
    }),
  );
}

function unique(arr) {
  return [...new Set(arr)];
}

// ───────────────────────── 測試名稱收集 ─────────────────────────

const REGEX_PRECEDING_KEYWORDS = new Set([
  'return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void',
  'throw', 'instanceof', 'yield', 'await',
]);

function isIdentStart(c) {
  return /[A-Za-z_$]/.test(c) || c > '\x7f';
}
function isIdentPart(c) {
  return /[A-Za-z0-9_$]/.test(c) || c > '\x7f';
}

function unescapeString(raw) {
  return raw.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|[\s\S])/g, (_, e) => {
    if (e[0] === 'u' && e[1] === '{') return String.fromCodePoint(parseInt(e.slice(2, -1), 16));
    if (e[0] === 'u' && e.length === 5) return String.fromCharCode(parseInt(e.slice(1), 16));
    if (e[0] === 'x' && e.length === 3) return String.fromCharCode(parseInt(e.slice(1), 16));
    return { n: '\n', t: '\t', r: '\r', '\n': '' }[e] ?? e;
  });
}

/**
 * 把 JavaScript 原始碼切成 token。註解被丟棄；字串、樣板字面值與正規表示式各為一個 token，
 * 其內容不會被當成程式碼（因此測試資料字串中的 `test('AC-…')` 不會被採計）。
 * @param {string} src
 * @returns {Array<{ type: 'ident'|'string'|'template'|'regex'|'num'|'punct', value: string, pos: number }>}
 */
export function tokenize(src) {
  let i = 0;
  const n = src.length;

  function regexAllowed(tokens) {
    const prev = tokens[tokens.length - 1];
    if (!prev) return true;
    if (prev.type === 'punct') return !(prev.value === ')' || prev.value === ']');
    if (prev.type === 'ident') return REGEX_PRECEDING_KEYWORDS.has(prev.value);
    return false;
  }

  function readQuoted(quote) {
    const start = i;
    i++;
    let raw = '';
    while (i < n && src[i] !== quote) {
      if (src[i] === '\\') {
        raw += src.slice(i, i + 2);
        i += 2;
        continue;
      }
      if (src[i] === '\n') break; // 未結束的字串：容錯
      raw += src[i++];
    }
    i++;
    return { type: 'string', value: unescapeString(raw), pos: start };
  }

  function readTemplate() {
    const start = i;
    i++;
    let raw = '';
    while (i < n) {
      const c = src[i];
      if (c === '\\') {
        raw += src.slice(i, i + 2);
        i += 2;
        continue;
      }
      if (c === '`') {
        i++;
        break;
      }
      if (c === '$' && src[i + 1] === '{') {
        const exprStart = i;
        i += 2;
        lexCode([], true); // 樣板內的運算式：只為了正確找到結尾，不採計其中的呼叫
        raw += src.slice(exprStart, i);
        continue;
      }
      raw += c;
      i++;
    }
    return { type: 'template', value: unescapeString(raw), pos: start };
  }

  function readRegex() {
    const start = i;
    i++;
    let inClass = false;
    while (i < n) {
      const c = src[i];
      if (c === '\\') {
        i += 2;
        continue;
      }
      if (c === '\n') break;
      if (c === '[') inClass = true;
      else if (c === ']') inClass = false;
      else if (c === '/' && !inClass) {
        i++;
        break;
      }
      i++;
    }
    while (i < n && /[a-z]/i.test(src[i])) i++;
    return { type: 'regex', value: src.slice(start, i), pos: start };
  }

  function lexCode(tokens, stopAtClosingBrace) {
    let depth = 0;
    while (i < n) {
      const c = src[i];
      if (/\s/.test(c)) {
        i++;
      } else if (c === '/' && src[i + 1] === '/') {
        while (i < n && src[i] !== '\n') i++;
      } else if (c === '/' && src[i + 1] === '*') {
        const end = src.indexOf('*/', i + 2);
        i = end < 0 ? n : end + 2;
      } else if (c === '"' || c === "'") {
        tokens.push(readQuoted(c));
      } else if (c === '`') {
        tokens.push(readTemplate());
      } else if (c === '/' && regexAllowed(tokens)) {
        tokens.push(readRegex());
      } else if (isIdentStart(c)) {
        const start = i;
        while (i < n && isIdentPart(src[i])) i++;
        tokens.push({ type: 'ident', value: src.slice(start, i), pos: start });
      } else if (/[0-9]/.test(c)) {
        const start = i;
        while (i < n && /[0-9A-Za-z_.]/.test(src[i])) i++;
        tokens.push({ type: 'num', value: src.slice(start, i), pos: start });
      } else {
        if (c === '{') depth++;
        if (c === '}') {
          if (stopAtClosingBrace && depth === 0) {
            i++;
            return tokens;
          }
          depth--;
        }
        tokens.push({ type: 'punct', value: c, pos: i });
        i++;
      }
    }
    return tokens;
  }

  return lexCode([], false);
}

function isPunct(tok, value) {
  return Boolean(tok) && tok.type === 'punct' && tok.value === value;
}

function matchingClose(tokens, openIdx) {
  const open = tokens[openIdx].value;
  const close = { '(': ')', '{': '}', '[': ']' }[open];
  let depth = 0;
  for (let k = openIdx; k < tokens.length; k++) {
    if (isPunct(tokens[k], open)) depth++;
    else if (isPunct(tokens[k], close)) {
      depth--;
      if (depth === 0) return k;
    }
  }
  return tokens.length - 1;
}

/** 物件字面值的最上層是否有 skip／todo 鍵（含簡寫屬性）。 */
function objectHasSkipKey(tokens, openIdx) {
  const closeIdx = matchingClose(tokens, openIdx);
  let depth = 0;
  for (let k = openIdx; k <= closeIdx; k++) {
    const t = tokens[k];
    if (t.type === 'punct' && '([{'.includes(t.value)) depth++;
    else if (t.type === 'punct' && ')]}'.includes(t.value)) depth--;
    else if (
      depth === 1 &&
      (t.type === 'ident' || t.type === 'string') &&
      SKIP_OPTION_KEYS.includes(t.value) &&
      (isPunct(tokens[k - 1], '{') || isPunct(tokens[k - 1], ',')) &&
      (isPunct(tokens[k + 1], ':') || isPunct(tokens[k + 1], ',') || isPunct(tokens[k + 1], '}'))
    ) {
      return true;
    }
  }
  return false;
}

function lineOf(src, pos) {
  let line = 1;
  for (let k = 0; k < pos; k++) if (src.charCodeAt(k) === 10) line++;
  return line;
}

/**
 * 從一個測試檔的原始碼收集測試名稱（spec.md 12.2 第 3、5 點）。
 *
 * 採計的呼叫：`test(`、`it(`、`describe(`、`test.describe(` 及其 `.skip`、`.fixme`、`.todo`、`.only`
 * 變體；名稱是第一個參數，且必須是單一字串或樣板字面值（後面緊接 `,` 或 `)`）。
 * 前面接 `.` 的呼叫（例：`/re/.test('…')`、`t.test('…')`）不採計。
 *
 * 略過的判定：修飾為 `.skip`／`.fixme`／`.todo`；第二個參數為含 `skip` 或 `todo` 鍵的物件；
 * 或位於上述被略過的 `describe`／`test.describe` 呼叫的參數之內。
 *
 * @param {string} src
 * @returns {Array<{ name: string, kind: 'test'|'describe', skipped: boolean, line: number }>}
 */
export function extractTests(src) {
  const tokens = tokenize(src);
  const calls = [];
  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k];
    if (t.type !== 'ident' || !['test', 'it', 'describe'].includes(t.value)) continue;
    if (isPunct(tokens[k - 1], '.')) continue;
    const chain = [t.value];
    let j = k + 1;
    while (isPunct(tokens[j], '.') && tokens[j + 1] && tokens[j + 1].type === 'ident') {
      chain.push(tokens[j + 1].value);
      j += 2;
    }
    if (!isPunct(tokens[j], '(')) continue;
    let modifier = null;
    let base = chain.join('.');
    if (chain.length > 1 && TEST_MODIFIERS.includes(chain[chain.length - 1])) {
      modifier = chain[chain.length - 1];
      base = chain.slice(0, -1).join('.');
    }
    if (!TEST_BASES.includes(base)) continue;

    const openIdx = j;
    const closeIdx = matchingClose(tokens, openIdx);
    const first = tokens[openIdx + 1];
    const afterFirst = tokens[openIdx + 2];
    let name = null;
    if (first && (first.type === 'string' || first.type === 'template') &&
        (isPunct(afterFirst, ',') || isPunct(afterFirst, ')'))) {
      name = first.value;
    }
    let skipped = SKIP_MODIFIERS.includes(modifier);
    if (name !== null && isPunct(afterFirst, ',') && isPunct(tokens[openIdx + 3], '{')) {
      if (objectHasSkipKey(tokens, openIdx + 3)) skipped = true;
    }
    calls.push({
      name,
      kind: base.endsWith('describe') ? 'describe' : 'test',
      selfSkipped: skipped,
      openIdx,
      closeIdx,
      pos: t.pos,
    });
  }

  const skippedBlocks = calls.filter((c) => c.kind === 'describe' && c.selfSkipped);
  return calls
    .filter((c) => c.name !== null)
    .map((c) => ({
      name: c.name,
      kind: c.kind,
      skipped:
        c.selfSkipped ||
        skippedBlocks.some((b) => b !== c && b.openIdx < c.openIdx && c.openIdx < b.closeIdx),
      line: lineOf(src, c.pos),
    }));
}

/**
 * 名稱是否含完整的編號（`AC-GP-1` 不得被 `AC-GP-10` 或 `XAC-GP-1` 誤判）。
 * @param {string} name
 * @param {string} id
 */
export function containsId(name, id) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![A-Za-z0-9-])${escaped}(?![0-9A-Za-z])`).test(name);
}

/**
 * @param {{ requiredIds: string[], tests: Array<{ name: string, skipped: boolean, file?: string, line?: number }>, noSkip?: boolean }} input
 * @returns {{ ok: boolean, missing: string[], skippedWithIds: Array<object>, skippedTotal: number }}
 */
export function checkCoverage({ requiredIds, tests, noSkip = false }) {
  const missing = requiredIds.filter((id) => !tests.some((t) => containsId(t.name, id)));
  const skipped = tests.filter((t) => t.skipped);
  const skippedWithIds = skipped.filter((t) => requiredIds.some((id) => containsId(t.name, id)));
  const ok = missing.length === 0 && !(noSkip && skipped.length > 0);
  return { ok, missing, skippedWithIds, skippedTotal: skipped.length };
}

/**
 * 列出 dir 下所有 `*.test.mjs`、`*.spec.mjs`（遞迴，略過 node_modules）。回傳相對於 dir 的路徑，已排序。
 * @param {string} dir
 */
export function listTestFiles(dir) {
  const out = [];
  function walk(rel) {
    let entries;
    try {
      entries = readdirSync(path.join(dir, rel), { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name === 'node_modules') continue;
      const childRel = rel ? path.join(rel, e.name) : e.name;
      if (e.isDirectory()) walk(childRel);
      else if (e.isFile() && /\.(test|spec)\.mjs$/.test(e.name)) out.push(childRel);
    }
  }
  walk('');
  return out.sort();
}

/**
 * 對整個版本庫執行檢查。
 * @param {{ root: string, noSkip?: boolean, requirementsPath?: string, supplementaryPath?: string, testsDir?: string }} options
 */
export function runCheck({
  root,
  noSkip = false,
  requirementsPath = 'docs/requirements.md',
  supplementaryPath = 'docs/design/supplementary-acceptance.json',
  testsDir = 'tests',
}) {
  const { acceptanceIds, nfrIds } = parseRequiredIds(readFileSync(path.join(root, requirementsPath), 'utf8'));
  const supplementaryIds = parseSupplementaryIds(readFileSync(path.join(root, supplementaryPath), 'utf8'));
  const requiredIds = unique([...acceptanceIds, ...nfrIds, ...supplementaryIds]);
  const files = listTestFiles(path.join(root, testsDir));
  const tests = files.flatMap((f) =>
    extractTests(readFileSync(path.join(root, testsDir, f), 'utf8')).map((t) => ({
      ...t,
      file: path.posix.join(testsDir, f.split(path.sep).join('/')),
    })),
  );
  const result = checkCoverage({ requiredIds, tests, noSkip });
  return { ...result, acceptanceIds, nfrIds, supplementaryIds, requiredIds, files, tests };
}

function main() {
  const args = process.argv.slice(2);
  const noSkip = args.includes('--no-skip');
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  let r;
  try {
    r = runCheck({ root, noSkip });
  } catch (err) {
    console.error(`acceptance-ids：解析失敗：${err.message}`);
    process.exit(2);
  }
  console.log(
    `必要編號 ${r.requiredIds.length} 個（需求第 10.2 節驗收 ${r.acceptanceIds.length}、` +
      `第 13 節 NFR ${r.nfrIds.length}、補充驗收 ${r.supplementaryIds.length}）`,
  );
  console.log(`掃描測試檔 ${r.files.length} 個，測試名稱 ${r.tests.length} 個`);
  console.log(`名稱含必要編號但被略過的測試：${r.skippedWithIds.length} 個；全部略過：${r.skippedTotal} 個`);
  if (r.missing.length) {
    console.error(`缺少測試的編號（${r.missing.length}）：${r.missing.join('、')}`);
  }
  if (noSkip && r.skippedTotal > 0) {
    console.error('--no-skip：下列測試被略過：');
    for (const t of r.tests.filter((x) => x.skipped)) console.error(`  ${t.file}:${t.line}  ${t.name}`);
  }
  if (!r.ok) process.exit(1);
  console.log('acceptance-ids：通過');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
