// EQ-4 編號覆蓋檢查與驗收測試的靜態規則（spec.md 12.2 v0.5）。只用 Node.js 內建模組。
//
// 用法：node scripts/check-acceptance-ids.mjs [--no-skip]
//   結束代碼 0：全部必要編號都出現在 tests/acceptance/ 的測試名稱中，且沒有違反靜態規則
//               （--no-skip 時另外沒有任何略過）
//   結束代碼 1：缺少編號、違反靜態規則，或 --no-skip 時有略過
//   結束代碼 2：需求文件或補充驗收檔解析失敗、找不到任何驗收測試檔
//
// 檢查項目（點號為 spec.md 12.2 v0.5）：
//   第 3 點  採計覆蓋的測試只來自 tests/acceptance/
//   第 4 點  tests/acceptance/ 下的測試檔只能是 unit/**/*.test.mjs 或 e2e/**/*.spec.mjs
//   第 5 點  tests/unit/ 的測試名稱不得含必要編號
//   第 8 點  驗收測試唯一允許的略過寫法是最上層的骨架宣告 test.skip(<字串>, <本體為空的箭頭函式>)；
//            其他略過、預期失敗、.only 的寫法一律失敗
//   第 9a 點 非骨架測試本體至少有一個 expect…／assert… 呼叫
//   第 9b 點 同一檔案「外層 describe 路徑＋名稱」不得重複
//   第 9c 點 tests/acceptance/unit/ 必須自 tests/support/assertions.mjs 匯入 assert，不得匯入 node:assert 等
//   第 10 點 --no-skip：tests/acceptance/ 有任何骨架即失敗；tests/unit/ 依 v0.4 的略過清單判定
//
// 本檔必須只依賴 Node.js 內建模組（驗收測試會把本檔單獨複製到暫存版本庫執行）。
// 判定邏輯全部是可匯出的純函式，供模組單元測試、AC-EQ-4 驗收測試與 check-acceptance-results 呼叫。
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** EQ-4 的例外：NFR-1 不需要獨立測試。 */
export const EXEMPT_IDS = Object.freeze(['NFR-1']);

/** 收集名稱的呼叫：base 加上可選的修飾（spec.md 12.2 第 6 點）。 */
export const TEST_BASES = Object.freeze(['test', 'it', 'describe', 'test.describe']);
export const TEST_MODIFIERS = Object.freeze(['skip', 'fixme', 'todo', 'only']);
/** 讓該呼叫被視為略過的修飾（tests/unit/ 的 --no-skip 判定沿用 v0.4 的清單）。 */
export const SKIP_MODIFIERS = Object.freeze(['skip', 'fixme', 'todo']);
/** 讓該呼叫被視為略過的選項鍵（`{ skip: … }`、`{ todo: … }`）。 */
export const SKIP_OPTION_KEYS = Object.freeze(['skip', 'todo']);

/** 第 8 點：在驗收測試的程式碼中，以這些名稱做屬性存取、計算屬性或物件鍵即失敗（骨架宣告除外）。 */
export const FORBIDDEN_NAMES = Object.freeze(['skip', 'fixme', 'fail', 'todo', 'only', 'expectFailure']);
/** 第 8 點：`type` 鍵的這些值（`annotation: { type: 'skip' }` 等）即失敗。 */
export const FORBIDDEN_TYPE_VALUES = Object.freeze(['skip', 'fixme', 'fail']);
/** 第 9c 點：無瀏覽器層驗收測試不得匯入的模組。 */
export const FORBIDDEN_ASSERT_MODULES = Object.freeze(['node:assert', 'node:assert/strict', 'assert', 'assert/strict']);

/** 版本庫中的目錄（相對於 testsDir）。 */
export const ACCEPTANCE_DIR = 'acceptance';
export const UNIT_TEST_DIR = 'unit';
export const ASSERTIONS_MODULE = 'support/assertions.mjs';
/** 第 4 點：判定位置的對象（任何副檔名的測試檔）。 */
export const ANY_TEST_FILE = /\.(test|spec)\.(js|mjs|cjs|ts|mts|cts|jsx|tsx)$/;

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

/** 回傳 pos → 行號（1 起算）的函式。 */
function lineIndex(src) {
  const starts = [0];
  for (let k = 0; k < src.length; k++) if (src.charCodeAt(k) === 10) starts.push(k + 1);
  return (pos) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= pos) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
}

/** 每個 token 所在的括號深度（開括號與其對應的閉括號深度相同，為括號外的深度）。 */
function bracketDepths(tokens) {
  const depths = new Array(tokens.length);
  let d = 0;
  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k];
    if (t.type === 'punct' && ')]}'.includes(t.value)) d--;
    depths[k] = d;
    if (t.type === 'punct' && '([{'.includes(t.value)) d++;
  }
  return depths;
}

function isArrowAt(tokens, k) {
  return isPunct(tokens[k], '=') && isPunct(tokens[k + 1], '>') && tokens[k + 1].pos === tokens[k].pos + 1;
}

/**
 * 解析從 p 開始的箭頭函式：`[async] (參數) => {…}` 或 `[async] 參數 => {…}`。
 * @returns {null | { end: number, empty: boolean }} end 為函式之後的 token 索引（區塊本體時）；
 *   empty 表示本體為 `{}`（註解不算敘述，已被 tokenizer 丟棄）
 */
function parseArrow(tokens, p) {
  let q = p;
  const t = tokens[q];
  if (t && t.type === 'ident' && t.value === 'async' &&
      (isPunct(tokens[q + 1], '(') || (tokens[q + 1] && tokens[q + 1].type === 'ident'))) q++;
  if (isPunct(tokens[q], '(')) q = matchingClose(tokens, q) + 1;
  else if (tokens[q] && tokens[q].type === 'ident') q++;
  else return null;
  if (!isArrowAt(tokens, q)) return null;
  q += 2;
  if (!isPunct(tokens[q], '{')) return { end: -1, empty: false };
  const close = matchingClose(tokens, q);
  return { end: close + 1, empty: close === q + 1 };
}

/**
 * tokens[from..to) 中是否有斷言呼叫（spec.md 12.2 第 9a 點）：被呼叫者的第一個識別字以
 * `expect` 或 `assert` 開頭（例：`expect(…)`、`expect.soft(…)`、`assert.equal(…)`、`assertVisible(…)`）。
 */
export function hasAssertionCall(tokens, from, to) {
  for (let k = from; k < to; k++) {
    const t = tokens[k];
    if (t.type !== 'ident' || !/^(expect|assert)/.test(t.value) || isPunct(tokens[k - 1], '.')) continue;
    let j = k + 1;
    while (isPunct(tokens[j], '.') && tokens[j + 1] && tokens[j + 1].type === 'ident') j += 2;
    if (isPunct(tokens[j], '(')) return true;
  }
  return false;
}

/**
 * 分析一個測試檔：收集測試呼叫（spec.md 12.2 第 6 點），並判定骨架、外層 describe 路徑、斷言呼叫。
 *
 * 採計的呼叫：`test(`、`it(`、`describe(`、`test.describe(` 及其 `.skip`、`.fixme`、`.todo`、`.only`
 * 變體；名稱是第一個參數，且必須是單一字串或樣板字面值（後面緊接 `,` 或 `)`）。
 * 前面接 `.` 的呼叫（例：`/re/.test('…')`、`t.test('…')`）不採計。
 *
 * 骨架（第 8 點）：檔案最上層（括號深度 0，不在任何 describe、函式或區塊內）的
 * `test.skip(<字串字面值>, <箭頭函式>)`，箭頭函式本體為空 `{}`，且只有這兩個參數。
 *
 * @param {string} src
 */
export function analyzeSource(src) {
  const tokens = tokenize(src);
  const depths = bracketDepths(tokens);
  const lineAt = lineIndex(src);
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
    let literal = null;
    if (first && (first.type === 'string' || first.type === 'template') &&
        (isPunct(afterFirst, ',') || isPunct(afterFirst, ')'))) {
      name = first.value;
      literal = first.type;
    }
    let skipped = SKIP_MODIFIERS.includes(modifier);
    if (name !== null && isPunct(afterFirst, ',') && isPunct(tokens[openIdx + 3], '{')) {
      if (objectHasSkipKey(tokens, openIdx + 3)) skipped = true;
    }
    const kind = base.endsWith('describe') ? 'describe' : 'test';

    // 骨架宣告的形狀（不論本體是否為空）：最上層的 test.skip(<字串>, <箭頭函式>)
    let skeletonShape = false;
    let skeleton = false;
    if (chain.length === 2 && chain[0] === 'test' && chain[1] === 'skip' && depths[k] === 0 &&
        literal === 'string' && isPunct(afterFirst, ',')) {
      const fn = parseArrow(tokens, openIdx + 3);
      if (fn && fn.end === closeIdx) {
        skeletonShape = true;
        skeleton = fn.empty;
      }
    }
    calls.push({
      name,
      literal,
      kind,
      selfSkipped: skipped,
      skeleton,
      skeletonShape,
      skipTokenIdx: chain.length === 2 && chain[1] === 'skip' ? k + 2 : -1,
      hasAssertion: kind === 'test' ? hasAssertionCall(tokens, openIdx + 1, closeIdx) : false,
      openIdx,
      closeIdx,
      line: lineAt(t.pos),
    });
  }

  const describes = calls.filter((c) => c.kind === 'describe');
  const skippedBlocks = describes.filter((c) => c.selfSkipped);
  const inside = (b, c) => b !== c && b.openIdx < c.openIdx && c.openIdx < b.closeIdx;
  const tests = calls
    .filter((c) => c.name !== null)
    .map((c) => ({
      name: c.name,
      kind: c.kind,
      skipped: c.selfSkipped || skippedBlocks.some((b) => inside(b, c)),
      line: c.line,
      literal: c.literal,
      skeleton: c.skeleton,
      path: describes.filter((b) => inside(b, c)).sort((a, b) => a.openIdx - b.openIdx).map((b) => b.name),
      hasAssertion: c.hasAssertion,
    }));
  return { tokens, calls, tests, lineAt };
}

/**
 * 從一個測試檔的原始碼收集測試名稱（spec.md 12.2 第 6 點）。
 *
 * 略過的判定（tests/unit/ 的 --no-skip 沿用 v0.4 的清單）：修飾為 `.skip`／`.fixme`／`.todo`；
 * 第二個參數為含 `skip` 或 `todo` 鍵的物件；或位於上述被略過的 `describe`／`test.describe` 之內。
 *
 * @param {string} src
 * @returns {Array<{ name: string, kind: 'test'|'describe', skipped: boolean, line: number,
 *   literal: 'string'|'template', skeleton: boolean, path: Array<string|null>, hasAssertion: boolean }>}
 */
export function extractTests(src) {
  return analyzeSource(src).tests;
}

/**
 * 第 8 點：驗收測試中骨架宣告以外的略過、預期失敗與 .only 寫法。
 * 偵測規則：名稱為 skip、fixme、fail、todo、only、expectFailure 的屬性存取（`.skip`）、計算屬性
 * （`['skip']`）與物件鍵（`skip:`、簡寫 `{ skip }`、方法 `{ skip() {} }`），以及值為 skip、fixme、fail
 * 的 `type` 鍵。例外：骨架宣告的 `.skip`；接收者為 `assert` 的 `.fail`（`assert.fail(…)`）。
 * 註解與字串資料的內容不是程式碼，不採計。
 * @param {ReturnType<typeof analyzeSource>} analysis
 * @returns {Array<{ line: number, message: string }>}
 */
export function findForbiddenSkips({ tokens, calls, lineAt }) {
  const out = [];
  const allowed = new Set();
  const reported = new Set();
  for (const c of calls) {
    if (c.skeleton) allowed.add(c.skipTokenIdx);
    else if (c.skeletonShape) {
      reported.add(c.skipTokenIdx);
      out.push({ line: c.line, message: `骨架本體必須為空（${JSON.stringify(c.name)}）；轉為實際測試時把 test.skip( 改為 test(` });
    }
  }
  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k];
    const prev = tokens[k - 1];
    const next = tokens[k + 1];
    const named = FORBIDDEN_NAMES.includes(t.value);
    if (t.type === 'ident' && named && isPunct(prev, '.')) {
      if (allowed.has(k) || reported.has(k)) continue;
      const recv = tokens[k - 2];
      if (t.value === 'fail' && recv && recv.type === 'ident' && recv.value === 'assert' && !isPunct(tokens[k - 3], '.')) continue;
      out.push({ line: lineAt(t.pos), message: `不允許的寫法 .${t.value}（驗收測試唯一允許的略過是最上層的骨架宣告）` });
    } else if ((t.type === 'string' || t.type === 'template') && named && isPunct(prev, '[') && isPunct(next, ']')) {
      out.push({ line: lineAt(t.pos), message: `不允許的寫法 [${JSON.stringify(t.value)}]（計算屬性）` });
    } else if (named && (isPunct(prev, '{') || isPunct(prev, ',')) &&
        ((t.type === 'ident' && (isPunct(next, ':') || isPunct(next, ',') || isPunct(next, '}') || isPunct(next, '('))) ||
         ((t.type === 'string' || t.type === 'template') && isPunct(next, ':')))) {
      out.push({ line: lineAt(t.pos), message: `不允許的物件鍵 ${t.value}（選項物件中的略過或預期失敗）` });
    }
    if ((t.type === 'ident' || t.type === 'string') && t.value === 'type' &&
        (isPunct(prev, '{') || isPunct(prev, ',')) && isPunct(next, ':')) {
      const v = tokens[k + 2];
      if (v && (v.type === 'string' || v.type === 'template') && FORBIDDEN_TYPE_VALUES.includes(v.value)) {
        out.push({ line: lineAt(t.pos), message: `不允許的註記 type: ${JSON.stringify(v.value)}` });
      }
    }
  }
  return out.sort((a, b) => a.line - b.line);
}

/**
 * 第 9c 點：無瀏覽器層驗收測試的斷言來源。
 * @param {ReturnType<typeof analyzeSource>} analysis
 * @param {string} fileRel 版本庫相對路徑（posix）
 * @param {string} assertionsRel 斷言輔助模組的版本庫相對路徑（posix），例：tests/support/assertions.mjs
 * @returns {Array<{ line: number, message: string }>}
 */
export function checkAssertImports({ tokens, lineAt }, fileRel, assertionsRel) {
  const out = [];
  let importsAssert = false;
  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k];
    const prev = tokens[k - 1];
    if ((t.type === 'string' || t.type === 'template') && FORBIDDEN_ASSERT_MODULES.includes(t.value)) {
      const byKeyword = prev && prev.type === 'ident' && (prev.value === 'from' || prev.value === 'import');
      const byCall = isPunct(prev, '(') && tokens[k - 2] && tokens[k - 2].type === 'ident' &&
        ['import', 'require'].includes(tokens[k - 2].value);
      if (byKeyword || byCall) {
        out.push({ line: lineAt(t.pos), message: `不得匯入 ${JSON.stringify(t.value)}；自 ${assertionsRel} 匯入 assert` });
      }
    }
    if (t.type === 'ident' && t.value === 'import' && !isPunct(prev, '.') && isPunct(tokens[k + 1], '{')) {
      const close = matchingClose(tokens, k + 1);
      const from = tokens[close + 1];
      const spec = tokens[close + 2];
      if (!from || from.type !== 'ident' || from.value !== 'from' || !spec || spec.type !== 'string') continue;
      if (!/^\.\.?\//.test(spec.value)) continue;
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(fileRel), spec.value));
      if (resolved !== assertionsRel) continue;
      for (let m = k + 2; m < close; m++) {
        const x = tokens[m];
        if (x.type === 'ident' && x.value === 'assert' && (isPunct(tokens[m - 1], '{') || isPunct(tokens[m - 1], ','))) {
          importsAssert = true;
        }
      }
    }
  }
  if (!importsAssert) out.push({ line: 1, message: `必須自 ${assertionsRel} 匯入 assert（import { assert } from '…'）` });
  return out;
}

/**
 * 第 9b 點：同一檔案「外層 describe 名稱路徑＋測試名稱」重複的測試。
 * @param {Array<{ name: string, kind: string, path: Array<string|null>, line: number }>} tests
 * @returns {Array<{ line: number, message: string }>}
 */
export function findDuplicateNames(tests) {
  const seen = new Map();
  const out = [];
  for (const t of tests) {
    if (t.kind !== 'test') continue;
    const key = JSON.stringify([...t.path, t.name]);
    if (seen.has(key)) {
      out.push({ line: t.line, message: `測試名稱重複（與第 ${seen.get(key)} 行相同）：${JSON.stringify([...t.path, t.name].join(' › '))}` });
    } else {
      seen.set(key, t.line);
    }
  }
  return out;
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
 * 編號覆蓋（第 7 點）。tests 只應傳入 tests/acceptance/ 的測試（第 3 點）。
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
 * 列出 dir 下符合 pattern 的檔案（遞迴，略過 node_modules）。回傳相對於 dir 的路徑，已排序。
 * @param {string} dir
 * @param {RegExp} [pattern] 預設 `*.test.mjs`、`*.spec.mjs`
 */
export function listTestFiles(dir, pattern = /\.(test|spec)\.mjs$/) {
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
      else if (e.isFile() && pattern.test(e.name)) out.push(childRel);
    }
  }
  walk('');
  return out.sort();
}

/**
 * 第 4 點：tests/acceptance/ 內的相對路徑屬於哪一層；不是會被執行的位置時為 null。
 * @param {string} relWithinAcceptance posix，例：'unit/x.test.mjs'
 * @returns {'unit'|'e2e'|null}
 */
export function acceptanceLayer(relWithinAcceptance) {
  if (relWithinAcceptance.startsWith('unit/') && relWithinAcceptance.endsWith('.test.mjs')) return 'unit';
  if (relWithinAcceptance.startsWith('e2e/') && relWithinAcceptance.endsWith('.spec.mjs')) return 'e2e';
  return null;
}

const toPosix = (p) => p.split(path.sep).join('/');

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
  const violations = [];
  const violate = (file, line, rule, message) => violations.push({ file, line, rule, message });

  // 第 3、4 點：只掃描 tests/acceptance/；位置或副檔名不符的測試檔失敗（且不採計覆蓋）
  const accBase = path.posix.join(testsDir, ACCEPTANCE_DIR);
  const assertionsRel = path.posix.join(testsDir, ASSERTIONS_MODULE);
  const files = [];
  for (const f of listTestFiles(path.join(root, testsDir, ACCEPTANCE_DIR), ANY_TEST_FILE).map(toPosix)) {
    const rel = path.posix.join(accBase, f);
    const layer = acceptanceLayer(f);
    if (layer) files.push({ file: rel, layer });
    else {
      violate(rel, null, '12.2 第 4 點',
        `驗收測試檔的位置或副檔名不符：只能是 ${accBase}/unit/**/*.test.mjs 或 ${accBase}/e2e/**/*.spec.mjs`);
    }
  }
  if (files.length === 0) throw new Error(`${accBase}/ 下沒有任何會被執行的驗收測試檔`);

  const tests = [];
  for (const { file, layer } of files) {
    const a = analyzeSource(readFileSync(path.join(root, file), 'utf8'));
    for (const t of a.tests) tests.push({ ...t, file, layer });
    for (const v of findForbiddenSkips(a)) violate(file, v.line, '12.2 第 8 點', v.message);
    for (const t of a.tests) {
      if (t.kind === 'test' && !t.skeleton && !t.hasAssertion) {
        violate(file, t.line, '12.2 第 9a 點', `非骨架測試的本體沒有 expect…／assert… 呼叫：${JSON.stringify(t.name)}`);
      }
    }
    for (const v of findDuplicateNames(a.tests)) violate(file, v.line, '12.2 第 9b 點', v.message);
    if (layer === 'unit') {
      for (const v of checkAssertImports(a, file, assertionsRel)) violate(file, v.line, '12.2 第 9c 點', v.message);
    }
  }

  // 第 5 點：tests/unit/ 的測試名稱不得含必要編號；第 10 點：--no-skip 時其略過仍失敗
  const unitBase = path.posix.join(testsDir, UNIT_TEST_DIR);
  const unitFiles = listTestFiles(path.join(root, testsDir, UNIT_TEST_DIR), /\.test\.mjs$/).map(toPosix);
  const unitTests = [];
  for (const f of unitFiles) {
    const file = path.posix.join(unitBase, f);
    for (const t of extractTests(readFileSync(path.join(root, file), 'utf8'))) {
      unitTests.push({ ...t, file });
      const ids = requiredIds.filter((id) => containsId(t.name, id));
      if (ids.length) {
        violate(file, t.line, '12.2 第 5 點', `單元測試的名稱含必要編號 ${ids.join('、')}（單元測試不得冒充驗收）：${JSON.stringify(t.name)}`);
      }
    }
  }

  const coverage = checkCoverage({ requiredIds, tests, noSkip });
  const skeletons = tests.filter((t) => t.skeleton);
  const unitSkipped = unitTests.filter((t) => t.skipped);
  const skipFailure = noSkip && (coverage.skippedTotal > 0 || unitSkipped.length > 0);
  const ok = coverage.missing.length === 0 && violations.length === 0 && !skipFailure;
  return {
    ok,
    missing: coverage.missing,
    violations: violations.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : (a.line ?? 0) - (b.line ?? 0))),
    skippedWithIds: coverage.skippedWithIds,
    skippedTotal: coverage.skippedTotal,
    skeletons,
    unitSkipped,
    acceptanceIds,
    nfrIds,
    supplementaryIds,
    requiredIds,
    files: files.map((f) => f.file),
    tests,
    unitFiles: unitFiles.map((f) => path.posix.join(unitBase, f)),
    unitTests,
  };
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
  // 檔名與名稱來自版本庫；名稱以 JSON.stringify 輸出，且每行以固定前綴開頭（不會在行首形成工作流程指令）
  console.log(
    `acceptance-ids：必要編號 ${r.requiredIds.length} 個（需求第 10.2 節驗收 ${r.acceptanceIds.length}、` +
      `第 13 節 NFR ${r.nfrIds.length}、補充驗收 ${r.supplementaryIds.length}）`,
  );
  console.log(`acceptance-ids：掃描驗收測試檔 ${r.files.length} 個、測試名稱 ${r.tests.length} 個；單元測試檔 ${r.unitFiles.length} 個`);
  console.log(`acceptance-ids：名稱含必要編號的骨架 ${r.skippedWithIds.length} 個；驗收測試中略過的 ${r.skippedTotal} 個`);
  if (r.missing.length) {
    console.error(`acceptance-ids：缺少驗收測試的編號（${r.missing.length}）：${r.missing.join('、')}`);
  }
  for (const v of r.violations) {
    console.error(`acceptance-ids：${v.file}${v.line ? `:${v.line}` : ''}  ${v.rule}：${v.message}`);
  }
  if (noSkip) {
    for (const t of r.tests.filter((x) => x.skipped)) {
      console.error(`acceptance-ids：--no-skip：${t.file}:${t.line}  ${JSON.stringify(t.name)} 被略過`);
    }
    for (const t of r.unitSkipped) {
      console.error(`acceptance-ids：--no-skip：${t.file}:${t.line}  ${JSON.stringify(t.name)} 被略過`);
    }
  }
  if (!r.ok) process.exit(1);
  console.log('acceptance-ids：通過');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
