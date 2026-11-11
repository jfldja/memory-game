// 審查紀錄與 PR 說明共用的偵測形式與字元判定（review-process.md 第 4 節「偵測形式」、4.1；DQ-13 (b)、DQ-14 (b)）。
// 只用 Node.js 內建模組（本檔不 import 任何模組）。review-gate.mjs 與 check-pr-body.mjs 都從本檔匯入，
// 兩支檢查不各自實作而不一致（review-process.md 4.1「共用模組」）。本檔列入審查清單 R-14。

/** 重複套用 fn 直到結果不再改變（不動點）。 */
function fixpoint(s, fn) {
  for (let prev = null; prev !== s; ) [prev, s] = [s, fn(s)];
  return s;
}

/**
 * F2′ 的標籤文法（review-process.md 第 4 節 F2′，依 CommonMark 的開始與結束標籤）：
 * 開始標籤 `<名稱 屬性…>`（屬性值可為未加引號、單引號、雙引號；可自我結束 `/>`），結束標籤 `</名稱>`。
 * 引號中的 `>` 屬於屬性值，不結束標籤（4.1 D3）。
 */
const OPEN_TAG = String.raw`<[A-Za-z][A-Za-z0-9-]*(?:\s+[A-Za-z_:][A-Za-z0-9_.:-]*(?:\s*=\s*(?:[^\s"'=<>` + '`' + String.raw`]+|'[^']*'|"[^"]*"))?)*\s*\/?>`;
const CLOSE_TAG = String.raw`<\/[A-Za-z][A-Za-z0-9-]*\s*>`;
/** 完整的 HTML 開始或結束標籤（全域）。 */
export const HTML_TAG = new RegExp(`${OPEN_TAG}|${CLOSE_TAG}`, 'g');
const F2_PATTERN = new RegExp(`<!--|-->|${OPEN_TAG}|${CLOSE_TAG}`, 'g');

/**
 * F2′：刪除 `<!--`、`-->` 兩種分隔符號（保留其間的文字），以及依 F2′ 文法的完整 HTML 標籤；重複到不動點。
 * `<版本>` 這類 `<` 後接非 ASCII 字母的文字不是標籤；不符合文法的「標籤」（例：`<b !>`）不刪（由 X7 判為無效）。
 */
export function stripHtml(s) {
  return fixpoint(String(s), (t) => t.replace(F2_PATTERN, ''));
}

/** F3：連結與圖片 `[文字](網址)`、`![文字](網址)` 換成文字；重複到不動點。 */
export function stripLinks(s) {
  return fixpoint(String(s), (t) => t.replace(/!?\[([^[\]]*)\]\([^()]*\)/g, '$1'));
}

/** F9 的簡體字對應（review-process.md 第 4 節 F9）。 */
export const SIMPLIFIED_TO_TRADITIONAL = Object.freeze({ 结: '結', 针: '針', 对: '對', 审: '審', 阶: '階' });
const SIMPLIFIED = new RegExp(`[${Object.keys(SIMPLIFIED_TO_TRADITIONAL).join('')}]`, 'g');

/**
 * 欄位偵測形式（review-process.md 第 4 節「欄位偵測形式 fieldForm」）：F1～F9 依序各套用一次，
 * F2′、F3 重複到不動點。只用來「找出看似某欄位的行」；合法與否一律以原文的逐字格式比對。
 * @param {string} line
 * @returns {string}
 */
export function fieldForm(line) {
  let s = String(line).normalize('NFKC'); // F1
  s = stripHtml(s); // F2′
  s = stripLinks(s); // F3
  s = s.replace(/\\(?=[!-\/:-@[-`{-~])/g, ''); // F4：ASCII 標點之前的反斜線
  s = s.replace(/[*_`~\s]/g, ''); // F5
  s = s.replace(/\[[xX]?\]/g, ''); // F6：核取方塊（F5 已刪除其中的空白）
  s = s.replace(/^[^\p{L}]+/u, ''); // F7：行首最長的非字母前綴
  s = s.toLowerCase(); // F8
  return s.replace(SIMPLIFIED, (c) => SIMPLIFIED_TO_TRADITIONAL[c]); // F9
}

// ───────────── 拒絕規則的字元判定（review-process.md 4.1 X1～X5；在原文上判定，CRLF 先轉為 LF） ─────────────

/** X1：不可見格式字元（Cf），以及換行、定位字元以外的控制字元（含單獨的 CR）。 */
export const X1_INVISIBLE = /[\p{Cf}\u0000-\u0008\u000B-\u001F\u007F-\u009F]/u;
/** X2：Default_Ignorable_Code_Point（含不屬 Cf 的 Lo、Mn，例：U+3164、U+034F、變體選擇符）。 */
export const X2_DEFAULT_IGNORABLE = /\p{Default_Ignorable_Code_Point}/u;
/** X3：結合符號。 */
export const X3_MARK = /\p{M}/u;
/** X4：U+2800（點字空白）。 */
export const X4_BRAILLE_BLANK = /\u2800/u;
/** X5：字元參照（十進位、十六進位、具名；不論位置、不論是否為有效的具名參照）。 */
export const X5_CHAR_REF = /&(?:#[0-9]+|#[xX][0-9A-Fa-f]+|[A-Za-z][A-Za-z0-9]*);/;

/**
 * X1～X5 中第一個成立的規則（依 X1 → X5 的順序）。text 須已把 CRLF 轉為 LF。
 * @param {string} text
 * @returns {null | 'X1'|'X2'|'X3'|'X4'|'X5'}
 */
export function firstCharRule(text) {
  const s = String(text);
  if (X1_INVISIBLE.test(s)) return 'X1';
  if (X2_DEFAULT_IGNORABLE.test(s)) return 'X2';
  if (X3_MARK.test(s)) return 'X3';
  if (X4_BRAILLE_BLANK.test(s)) return 'X4';
  if (X5_CHAR_REF.test(s)) return 'X5';
  return null;
}

/** X1～X4 的回報原因為「含不可見字元」，X5 為「含字元參照」。 */
export function charRuleReason(rule) {
  return rule === 'X5' ? '含字元參照' : '含不可見字元';
}

// ───────────── 相容偵測（review-process.md 4.1「相容偵測」v0.6.3） ─────────────
//
// legacyFieldForm、legacyIsTableLine 是 PR-1b 版（main fa05bbb）scripts/review-gate.mjs 第 44～80 行的
// fieldForm、isTableLine 與其輔助函式，**逐字複製，不得修改**（唯一的差異：兩個函式宣告前的 `export ` 移除，
// 以免與本檔的 fieldForm 衝突；整段包在函式作用域中）。它們是「PR-1c 有效 ⇒ PR-1b 有效」的相容基準，
// 不是新的偵測規則：review-gate 判定欄位行與表格列時取新偵測與它們的聯集。
// tests/unit/detection.test.mjs 以 tests/unit/fixtures/pr1b/review-gate.mjs（fa05bbb 的逐字複本）核對本段文字與行為。
// 之後修改偵測形式時，同樣以「新偵測 ∪ 修改前偵測」判定，基準改為修改前的版本。
const LEGACY = (() => {
// ── fa05bbb scripts/review-gate.mjs 第 44 行起（逐字） ──
/** 重複套用 fn 直到結果不再改變（不動點）。 */
function fixpoint(s, fn) {
  for (let prev = null; prev !== s; ) [prev, s] = [s, fn(s)];
  return s;
}

/** F2：刪除 `<!--`、`-->` 分隔符號（保留其間文字）與 HTML 標籤；`<版本>` 等 `<` 後非 ASCII 字母者不是標籤。 */
const stripHtml = (s) => fixpoint(s, (t) => t.replace(/<!--|-->|<\/?[A-Za-z][^<>]*>/g, ''));
/** F3：連結與圖片 `[文字](網址)`、`![文字](網址)` 換成文字。 */
const stripLinks = (s) => fixpoint(s, (t) => t.replace(/!?\[([^[\]]*)\]\([^()]*\)/g, '$1'));

/**
 * 欄位偵測形式（review-process.md 第 4 節「欄位偵測形式 fieldForm」，DQ-13 (b)）：F1～F8 依序各套用一次，
 * F2、F3 重複到不動點。只用來「找出看似某欄位的行」；合法與否一律以原文的逐字格式比對。
 */
function fieldForm(line) {
  let s = String(line).normalize('NFKC'); // F1
  s = stripHtml(s); // F2
  s = stripLinks(s); // F3
  s = s.replace(/\\(?=[!-\/:-@[-`{-~])/g, ''); // F4：ASCII 標點之前的反斜線
  s = s.replace(/[*_`~\s]/g, ''); // F5
  s = s.replace(/\[[xX]?\]/g, ''); // F6：核取方塊（F5 已刪除其中的空白）
  s = s.replace(/^[^\p{L}]+/u, ''); // F7：行首最長的非字母前綴
  return s.toLowerCase(); // F8
}

const HTML_TABLE_TAG = /<\/?(?:table|thead|tbody|tr|td|th)(?![\p{L}\p{N}])/iu;

/**
 * 表格列偵測（review-process.md 第 4 節「表格列偵測 isTableLine」）：
 * T1：NFKC 後含 HTML 表格標籤；T2：NFKC、F2 後去除前後空白，刪除行首最長的「非字母且不是 `|`」前綴後以 `|` 開頭。
 */
function isTableLine(line) {
  const s = String(line).normalize('NFKC');
  if (HTML_TABLE_TAG.test(s)) return true; // T1
  return stripHtml(s).trim().replace(/^[^\p{L}|]+/u, '').startsWith('|'); // T2
}
// ── fa05bbb scripts/review-gate.mjs 第 80 行止 ──
  return { fieldForm, isTableLine };
})();

/** PR-1b 版的欄位偵測形式（F1、F2ᴸ、F3～F8；不含 F2′、F9）。相容基準，不得修改。 */
export const legacyFieldForm = LEGACY.fieldForm;
/** PR-1b 版的表格列偵測（T1，以及以 F2ᴸ 計算的 T2）。相容基準，不得修改。 */
export const legacyIsTableLine = LEGACY.isTableLine;
